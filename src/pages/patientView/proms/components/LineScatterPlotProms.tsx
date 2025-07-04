/**
 * Component for Victory line scatter plot
 */

import React, { useState, useEffect, useRef } from 'react';
import FontAwesome from 'react-fontawesome';
import { saveSvgAsPng } from 'save-svg-as-png';
import {
    VictoryChart,
    VictoryLine,
    VictoryScatter,
    VictoryAxis,
    VictoryLegend,
    VictoryTooltip,
    VictoryGroup,
    VictoryLabel,
    VictoryArea,
    VictoryZoomContainer,
} from 'victory';
import { DefaultTooltip } from 'cbioportal-frontend-commons';
import CBIOPORTAL_VICTORY_THEME_PROM from '../utils/cBioPortalThemePROM';
import {
    AVERAGE_KEY,
    INDEX_KEY,
    VAS_KEY,
    STANDARD_RANGE_KEY,
    QUESTIONNAIRE_NAME,
} from '../utils/EQ-5D-5LChartMetadata';
import * as Constants from '../utils/PromChartConstants';
import '../styles.scss';
import {
    Datum,
    DataSet,
    mergeArrays,
    createRangeData,
    normalizeDataSet,
    getOriginalY,
    transformString,
    createCommonXAxisForDataSet,
    convertISOToDDMMYYYY,
} from '../utils/PromChartHelperFunctions';

interface LineScatterPlotProps {
    data: DataSet;
    width?: number;
    height?: number;
    title?: string;
    xLabel: string;
    yLabel: string;
    yTickFormat: string[];
    yRange: [number, number];
    secondYLabel?: string;
    secondYTickFormat?: string[];
    secondYRange?: [number, number];
    standardRange?: [number, number];
    showTooltip?: boolean;
    invertYAxis?: boolean;
}

/**
 * Custom svg component representing an axis with an arrow at the end
 * @param props properties
 * @returns rendered axis
 */
const ArrowAxis = (props: any) => {
    return (
        <svg>
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth={Constants.ARROW_WIDTH}
                    markerHeight={Constants.ARROW_HEIGHT}
                    refX="0"
                    refY={Constants.REF_Y}
                    orient="auto"
                    fill={Constants.AXIS_COLOR}
                >
                    <polygon points={Constants.POLYGON} />
                </marker>
            </defs>
            <line
                x1={props.x1}
                y1={props.y2}
                x2={props.x2}
                y2={props.dimension === 'x' ? props.y2 : props.y1}
                stroke={Constants.AXIS_COLOR}
                stroke-width={Constants.AXIS_STROKE_WIDTH}
                marker-end="url(#arrowhead)"
            />
        </svg>
    );
};

/**
 * Defines the color used for a line
 * @param key string identifying the line
 * @param index number that helps to identify the right color of a pre-defined colors array
 * @returns color as string
 */
const getColor = (key: string, index: number): string => {
    if (key === AVERAGE_KEY) {
        return Constants.averageLayoutValues.color;
    }
    if (key === INDEX_KEY) {
        return Constants.eqLayoutValues.color;
    }
    if (key === VAS_KEY) {
        return Constants.vasLayoutValues.color;
    }
    if (key === STANDARD_RANGE_KEY) {
        return Constants.standardRangeLayoutValues.color;
    } else {
        return Constants.lineColors[index % Constants.lineColors.length];
    }
};

/**
 * Defines the symbol used in the legend
 * @param key string identifying the set of data points
 * @returns symbol as string
 */
const getLegendSymbol = (key: string): string => {
    if (key === AVERAGE_KEY) {
        return Constants.averageLayoutValues.symbol;
    }
    if (key === INDEX_KEY) {
        // negative values ??
        return Constants.eqLayoutValues.symbol;
    }
    if (key === VAS_KEY) {
        return Constants.vasLayoutValues.symbol;
    }
    if (key === STANDARD_RANGE_KEY) {
        return Constants.standardRangeLayoutValues.symbol;
    } else {
        return 'minus';
    }
};

/**
 * Defines the symbol used in the scatter chart
 * @param key string identifying a set of data points
 * @param origY original non-normalized y value of a Datum
 * @returns symbol as string
 */
const getScatterSymbol = (key: string, origY: number | null): string => {
    if (key === AVERAGE_KEY) {
        return Constants.averageLayoutValues.symbol;
    }
    if (key === INDEX_KEY) {
        if (origY !== null && origY < 0) {
            return Constants.eqLayoutValues.symbolNegative;
        }
        return Constants.eqLayoutValues.symbol;
    }
    if (key === VAS_KEY) {
        return Constants.vasLayoutValues.symbol;
    } else {
        return 'circle';
    }
};

/**
 * Changes the color for negative EQ Index values
 * @param key string identifying the set of data points
 * @param color string representing the default color
 * @param origY original non-normalized y value of a Datum
 * @returns color of a Datum in the scatter plot as string
 */
const getScatterColor = (
    key: string,
    color: string,
    origY: number | null
): string => {
    if (key === INDEX_KEY && origY !== null && origY < 0) {
        return Constants.eqLayoutValues.colorNegative;
    }
    return color;
};

// Hook to memoize processed data, applying normalization if a second Y axis is present + fill label (needed for tooltip)

/**
 * Pre-processes the data before it will be rendered in the chart
 * @param data DataSet, the input data
 * @param yRange tuple representing the minimum and maximum possible y value of the first y axis
 * @param secondYRange tuple representing the minimum and maximum possible y value of a second y axis
 * @returns processed data
 */
const useProcessedData = (
    data: DataSet,
    yRange: [number, number],
    secondYRange?: [number, number]
): DataSet => {
    const keys = Object.keys(data);

    // fill label property of data entries
    for (let key of keys) {
        data[key].forEach((datum: Datum) => {
            datum.labelName = key;
        });
    }

    // find longest sequence of data points
    let maxLength = 0;
    for (let key of keys) {
        if (data[key].length > maxLength) {
            maxLength = data[key].length;
        }
    }
    console.log('maxLength:', maxLength);

    // add dummy data as first and last element (used for standardRange)
    for (let key of keys) {
        let dummyDatumBefore: Datum;
        let dummyDatumAfter: Datum;
        dummyDatumBefore = { x: Constants.DUMMY_DATE_IN_THE_PAST, y: null };
        data[key].unshift(dummyDatumBefore);
        dummyDatumAfter = { x: Constants.DUMMY_DAT_IN_THE_FUTURE, y: null };
        data[key].push(dummyDatumAfter);
    }

    // Normalization
    // If no second axis given, return original data (no normalization needed here)
    if (!secondYRange) {
        return data;
    }

    const newData: DataSet = { ...data };

    // Normalize dataset if it exists
    if (yRange && secondYRange) {
        if (keys.length > 1) {
            newData[keys[0]] = normalizeDataSet(data[keys[0]], yRange);
            newData[keys[1]] = normalizeDataSet(data[keys[1]], secondYRange);
        } else if (keys.length === 1) {
            const range = keys[0] === INDEX_KEY ? yRange : secondYRange;
            newData[keys[0]] = normalizeDataSet(data[keys[0]], range);
        }
    }
    return newData;
};

/**
 * Pre-processes a DataSet which was generated of a given range
 * @param rangeData DataSet containing data points with the range data
 * @param yRange tuple representing the minimum and maximum possible y value
 * @returns processed rangeData
 */
const useProcessedStandardRangeData = (
    rangeData: DataSet,
    yRange: [number, number]
): DataSet => {
    const keys = Object.keys(rangeData);

    // fill label property of data entries
    for (let key of keys) {
        rangeData[key].forEach((datum: Datum) => {
            datum.labelName = key;
        });
    }

    const newRangeData: DataSet = { ...rangeData };

    // Normalize dataset if a range is given
    if (yRange) {
        if (keys.length === 1) {
            newRangeData[keys[0]] = normalizeDataSet(
                rangeData[keys[0]],
                yRange
            );
        }
    }
    return newRangeData;
};

const LineScatterPlot: React.FC<LineScatterPlotProps> = ({
    data,
    width = 580,
    height = 200,
    title,
    xLabel,
    yLabel,
    yTickFormat,
    yRange,
    secondYLabel,
    secondYTickFormat,
    secondYRange,
    standardRange,
    showTooltip = true,
    invertYAxis = false,
}) => {
    // useState hook to show and hide specific datasets
    const [hiddenKeys, setHiddenKeys] = useState<string[]>([AVERAGE_KEY]); // datasetes named "Average" are initially not shown
    const [zoomDomain, setZoomDomain] = useState<[number, number]>();
    // Ref for VictoryZoomContainer
    const chartRef = useRef<HTMLDivElement>(null);
    // File names for the svg and png images of the chart
    const exportFileName = title
        ? `${QUESTIONNAIRE_NAME}_${title.toLowerCase()}`
        : `${QUESTIONNAIRE_NAME}_chart`;

    // chart data
    const processedData = useProcessedData(data, yRange, secondYRange);
    console.log('processedData for LineScatterPlot:', processedData);

    const augmentedData = createCommonXAxisForDataSet(processedData);
    console.log('augmentedData for LineScatterPlot:', augmentedData);

    // Transform augmentedData: input is object, output will be array
    const datasets = Object.entries(augmentedData).map(([key, points], i) => ({
        key,
        points,
        color: getColor(key, i),
        childName: `dataset-${i}`,
    }));

    /**
     * Adds(removes an identifier of a data set to/from hiddenKeys
     * @param key string identifying the data set
     */
    const toggleKey = (key: string) => {
        setHiddenKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    /**
     * Computes the zoom domain of the line chart based on the length of the displayed data
     * @param data array, the data to be displayed
     */
    const updateZoomDomain = (data: any[]) => {
        console.log('In updateZoomDomain; data.length', data.length);
        console.log(data);
        if (!data || data.length === 0) return;

        // determine the length of the input data
        let maxNumberOfPoints = 0;
        for (let i = 0; i < data.length; i++) {
            if (data[i].points.length > maxNumberOfPoints) {
                maxNumberOfPoints = data[i].points.length;
            }
        }
        // Zoom in if data has too many entries to be nicely displayed together
        if (
            maxNumberOfPoints >
            Constants.MAX_NUMBER_OF_QUESTIONNAIRES_VISIBLE + 2
        ) {
            setZoomDomain([
                1,
                Constants.MAX_NUMBER_OF_QUESTIONNAIRES_VISIBLE + 2,
            ]);
        }
    };

    // Update zoom domain when data prop changes
    useEffect(() => {
        updateZoomDomain(datasets);
    }, []);

    // Events executed when clicked on legend
    // Toggle visibility of legend entry and line-scatter
    const legendEvents = [
        {
            target: ['data', 'labels'],
            eventHandlers: {
                onClick: (_: any, props: any) => {
                    const dataset = standardRange
                        ? mergedDataForLegend[props.index]
                        : datasets[props.index];
                    toggleKey(dataset.key);
                    return [];
                },
            },
        },
    ];

    /**
     * Calculates tick values given the range of the data and the number of ticks
     * @param range tuple representing the minimum and maximum possible y value
     * @param ticks number of ticks on the axis
     * @returns number[] array of tick values
     */
    const yTickValues = (range: [number, number], ticks: number): number[] => {
        // if second y axis present, normalize tick values, otherwise keep original range
        const [min, max] = secondYRange ? [0, 1] : range;
        const step = (max - min) / (ticks - 1);
        return Array.from({ length: ticks }, (_, i) => min + i * step);
    };

    /**
     * Calculates x tick values for a DataSet
     * @param data DataSet
     * @returns string array with x tick values
     */
    const xTickValues = (data: DataSet): Array<string> => {
        const allX: string[] = [];
        for (const series of Object.values(data)) {
            for (const d of series) {
                if (d.x !== null && d.x !== undefined) {
                    allX.push(d.x);
                }
            }
        }
        console.log('allX:', allX);

        // Remove duplicates
        const uniqueX = Array.from(new Set(allX));

        // Sort
        const sortedX = uniqueX.sort((a, b) => {
            return new Date(a).getTime() - new Date(b).getTime(); // for dates saved as strings
        });
        console.log('sortedX:', sortedX);

        // Remove first and last element (dummy elements)
        sortedX.shift();
        sortedX.pop();
        console.log('sortedX without first and last:', sortedX);

        return sortedX;
    };

    /**
     * Defines the text of the tooltip for the scatter points
     * @param datum Datum, the scatter point
     * @param origData Datum with the original unnormalized y value
     * @returns text for the tooltip
     */
    const displayTooltip = (datum: Datum, origData: Datum[]): string => {
        if (secondYRange) {
            const originalY = getOriginalY(datum.x, origData);
            return datum.labelName
                ? `${transformString(datum.labelName)}: ${originalY}`
                : `${originalY}`;
        }
        return datum.labelName
            ? `${transformString(datum.labelName)}: ${datum.y}`
            : `${datum.labelName}: ${datum.y}`;
    };

    /**
     * Exports the Vicotry chart to SVG
     * @param filename name of the file to be saved
     */
    const exportAsSVG = (filename = 'chart.svg') => {
        if (!chartRef.current) {
            alert('Chart not rendered yet!');
            return;
        }

        const svgElement = chartRef.current.querySelector('svg');
        if (!svgElement) {
            alert('SVG element not found!');
            return;
        }

        // Temporarily reset zoom to full range
        const originalZoom = zoomDomain;
        setZoomDomain(undefined);

        setTimeout(() => {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgElement);
            const blob = new Blob([svgString], {
                type: 'image/svg+xml;charset=utf-8',
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            // Restore original zoom
            setZoomDomain(originalZoom);
        }, 10);
    };

    /**
     * Exports the Vicotry chart to a PNG file
     * @param filename name of the file to be saved
     */
    const exportAsPNG = (filename = 'chart.png') => {
        if (!chartRef.current) {
            alert('Chart not rendered yet!');
            return;
        }

        const svgElement = chartRef.current.querySelector('svg');
        if (!svgElement) {
            alert('SVG element not found!');
            return;
        }

        // Temporarily reset zoom to full range
        const originalZoom = zoomDomain;
        setZoomDomain(undefined);
        // Export
        saveSvgAsPng(svgElement, filename, {
            scale: 3,
            backgroundColor: '#fff',
        });
        // Wait for re-render
        setTimeout(() => {
            // Restore original zoom
            setZoomDomain(originalZoom);
        }, 10);
    };

    // Helpers for showing standard range
    let standardRangeData: DataSet;
    let standardRangeDataProcessed: DataSet;
    let standardRangeDataMapped: {
        key: string;
        points: Datum[];
        color: string;
        childName: string;
    }[] = [];
    let mergedDataForLegend: {
        key: string;
        points: Datum[];
        color: string;
        childName: string;
    }[] = [];

    if (standardRange) {
        standardRangeData = createRangeData(data, standardRange);
        console.log('standardRangeData:', standardRangeData); //OK
        standardRangeDataProcessed = useProcessedStandardRangeData(
            standardRangeData,
            yRange
        );
        console.log('standardRangeDataProcessed:', standardRangeDataProcessed);
        standardRangeDataMapped = Object.entries(
            standardRangeDataProcessed
        ).map(([key, points], i) => ({
            key,
            points,
            color: getColor(key, i),
            childName: `range-${i}`,
        }));
        mergedDataForLegend = mergeArrays(datasets, standardRangeDataMapped, 2);
    }

    // Rendering
    return (
        <div
            style={{
                display: 'flex',
            }}
        >
            <VictoryChart
                width={width}
                height={height}
                theme={CBIOPORTAL_VICTORY_THEME_PROM}
                padding={{
                    top: height / 5,
                    bottom: height / 5,
                    left: width / 5,
                    right: width / 5,
                }} // padding between chart and other Victory components, e. g. legend, title
                domainPadding={{ x: 5, y: height / 10 }} // padding between axes and data points (padding around actual plot within the diagram)
                // Zoom functionality
                containerComponent={
                    <VictoryZoomContainer
                        responsive={true}
                        zoomDimension="x"
                        allowZoom={false}
                        zoomDomain={{ x: zoomDomain }}
                        allowPan={true}
                        containerRef={chartRef}
                    />
                }
            >
                {/* Important: first print Y axis, then X axis */}
                {/* Y Axis */}
                <VictoryAxis
                    dependentAxis
                    invertAxis={invertYAxis}
                    orientation="left"
                    axisComponent={<ArrowAxis />}
                    label={yLabel}
                    tickValues={yTickValues(yRange, yTickFormat.length)}
                    tickFormat={yTickFormat}
                    axisLabelComponent={
                        <VictoryLabel
                            dx={-3 * Constants.TICK_SIZE - 2}
                            dy={-height / 3 + Constants.ARROW_HEIGHT - 1}
                            angle={0}
                        />
                    }
                />
                {/* Second Y Axis */}
                {secondYRange && secondYTickFormat && (
                    <VictoryAxis
                        dependentAxis
                        orientation="right"
                        axisComponent={<ArrowAxis />}
                        label={secondYLabel}
                        tickValues={yTickValues(
                            secondYRange,
                            secondYTickFormat.length
                        )}
                        tickFormat={secondYTickFormat}
                        axisLabelComponent={
                            <VictoryLabel
                                dx={3 * Constants.TICK_SIZE - 1}
                                dy={
                                    -Constants.AXISLABEL_FONTSIZE -
                                    height / 3 +
                                    Constants.ARROW_HEIGHT -
                                    1
                                }
                                angle={0}
                            />
                        }
                        style={{ grid: { strokeOpacity: 0 } }}
                    />
                )}

                {/* X Axis */}
                <VictoryAxis
                    axisComponent={<ArrowAxis />}
                    label={xLabel}
                    tickValues={xTickValues(processedData)}
                    tickFormat={(t: string) => `${convertISOToDDMMYYYY(t)}`}
                    axisLabelComponent={
                        <VictoryLabel
                            dx={0.33 * width - Constants.ARROW_HEIGHT}
                            dy={Constants.XLABEL_YOFFSET}
                        />
                    }
                    style={{ grid: { strokeOpacity: 0 } }}
                />

                {/* Plots */}

                {standardRange &&
                    standardRangeDataMapped.map(
                        ({ key, points, color, childName }) => {
                            return (
                                <VictoryArea
                                    name={childName}
                                    data={points}
                                    style={{
                                        data: {
                                            fill: color,
                                            opacity:
                                                Constants
                                                    .standardRangeLayoutValues
                                                    .areaOpacity,
                                            visibility: hiddenKeys.includes(key)
                                                ? 'hidden'
                                                : 'visible',
                                        },
                                    }}
                                />
                            );
                        }
                    )}

                {datasets.map(({ key, points, color, childName }, i) => {
                    const scatterPoints = points.filter(
                        p => p.y !== null && p.y !== undefined
                    ); // filters out points with null or undefined y value
                    return (
                        <VictoryGroup data={scatterPoints}>
                            <VictoryLine
                                name={childName}
                                data={points}
                                style={{
                                    data: {
                                        stroke: color,
                                        visibility: hiddenKeys.includes(key)
                                            ? 'hidden'
                                            : 'visible',
                                    },
                                }}
                                interpolation="linear"
                            />
                            <VictoryScatter
                                name={childName}
                                data={points}
                                sortOrder="ascending"
                                sortKey="x"
                                scale={{ x: 'time' }}
                                symbol={(d: Datum) =>
                                    getScatterSymbol(
                                        key,
                                        getOriginalY(d.x, data[key])
                                    )
                                } // different scatter symbol for negative EQ values, use original data
                                style={{
                                    data: {
                                        fill: (d: Datum) =>
                                            getScatterColor(
                                                key,
                                                color,
                                                getOriginalY(d.x, data[key])
                                            ), // different color for negative EQ values, use original data
                                        visibility: hiddenKeys.includes(key)
                                            ? 'hidden'
                                            : 'visible',
                                    },
                                }}
                                labels={
                                    !hiddenKeys.includes(key) && showTooltip
                                        ? (d: Datum) =>
                                              displayTooltip(d, data[key])
                                        : null
                                }
                                labelComponent={<VictoryTooltip dy={-7} />}
                            />
                        </VictoryGroup>
                    );
                })}

                {/* Legend */}
                <VictoryLegend
                    title={secondYRange ? null : 'Legend'}
                    orientation={secondYRange ? 'horizontal' : 'vertical'}
                    y={secondYRange ? 16 : height / 6 + 2}
                    x={secondYRange ? width / 5 + 15 : (5 / 6) * width}
                    gutter={20} // only for horizontal alignment
                    name="legend"
                    data={
                        standardRange
                            ? mergedDataForLegend.map(({ key, color }, i) => ({
                                  name: transformString(key),
                                  symbol: {
                                      fill: hiddenKeys.includes(key)
                                          ? 'lightgray'
                                          : color,
                                      type: getLegendSymbol(key),
                                      opacity:
                                          key === STANDARD_RANGE_KEY
                                              ? Constants
                                                    .standardRangeLayoutValues
                                                    .symbolOpacity
                                              : 1.0,
                                  },
                                  labels: {
                                      fill: hiddenKeys.includes(key)
                                          ? 'lightgray'
                                          : color,
                                      opacity:
                                          key === STANDARD_RANGE_KEY &&
                                          !hiddenKeys.includes(key)
                                              ? Constants
                                                    .standardRangeLayoutValues
                                                    .labelOpacity
                                              : 1.0,
                                  },
                              }))
                            : datasets.map(({ key, color }, i) => ({
                                  name: transformString(key),
                                  symbol: {
                                      fill: hiddenKeys.includes(key)
                                          ? 'lightgray'
                                          : color,
                                      type: getLegendSymbol(key),
                                  },
                                  labels: {
                                      fill: hiddenKeys.includes(key)
                                          ? 'lightgray'
                                          : color,
                                  },
                              }))
                    }
                    events={legendEvents}
                />
            </VictoryChart>

            <div className="column-download-buttons">
                <div>
                    {' '}
                    <DefaultTooltip
                        overlay={<span>Download SVG</span>}
                        placement="right"
                    >
                        <button
                            onClick={() => exportAsSVG(`${exportFileName}.svg`)}
                            className="btn btn-default btn-xs download-button"
                        >
                            <FontAwesome name="cloud-download" /> SVG
                        </button>
                    </DefaultTooltip>
                </div>
                <div>
                    <DefaultTooltip
                        overlay={<span>Download PNG</span>}
                        placement="right"
                    >
                        <button
                            onClick={() => exportAsPNG(`${exportFileName}.png`)}
                            className="btn btn-default btn-xs download-button"
                        >
                            <FontAwesome name="cloud-download" /> PNG
                        </button>
                    </DefaultTooltip>
                </div>
            </div>
        </div>
    );
};

export default LineScatterPlot;
