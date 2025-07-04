import React, { useState, useEffect, useRef } from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
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
    VictoryTheme,
    LineSegment,
    VictoryLabel,
    VictoryArea,
    VictoryVoronoiContainer,
    VictoryZoomContainer,
    VictoryBrushContainer,
} from 'victory';

import {
    CBIOPORTAL_VICTORY_THEME,
    axisTickLabelStyles,
    getTextWidth,
    ScatterPlotTooltip,
    ScatterPlotTooltipHelper,
    truncateWithEllipsis,
    wrapText,
    DownloadControls,
    DefaultTooltip,
} from 'cbioportal-frontend-commons';

import CBIOPORTAL_VICTORY_THEME_PROM from '../utils/cBioPortalThemePROM';
import {
    AVERAGE_KEY,
    INDEX_KEY,
    VAS_KEY,
    STANDARD_RANGE_KEY,
    questionnaireName,
} from '../utils/EQ-5D-5LChartMetadata';

import * as Constants from '../utils/PromChartConstants';
import { parse } from 'date-fns';

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

// Props of LineScatterPlot
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

// custom svg component: axis with arrow at end
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

// functions for required layout

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

const getScatterSymbol = (key: string, origY: number | null): string => {
    if (key === AVERAGE_KEY) {
        return Constants.averageLayoutValues.symbol;
    }
    if (key === INDEX_KEY) {
        // negative values ??
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
const useProcessedData = (
    data: DataSet,
    yRange: [number, number],
    secondYRange?: [number, number]
): DataSet => {
    //return useMemo(() => {
    const keys = Object.keys(data);

    /* fill label property of data entries */
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
    //if (standardRange) {
    for (let key of keys) {
        let dummyDatumBefore: Datum;
        let dummyDatumAfter: Datum;
        dummyDatumBefore = { x: Constants.DUMMY_DATE_IN_THE_PAST, y: null };
        data[key].unshift(dummyDatumBefore);
        //if (data[key].length > maxLength) {
        dummyDatumAfter = { x: Constants.DUMMY_DAT_IN_THE_FUTURE, y: null };
        data[key].push(dummyDatumAfter);
        //}

        // data[key].unshift(dummyDatumBefore);
        // data[key].push(dummyDatumAfter);
    }
    //}

    /* normalization */
    // If no second axis, return original data (no normalization needed here)
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
    //}, [data, yRange, secondYRange]);
};

const useProcessedStandardRangeData = (
    rangeData: DataSet,
    yRange: [number, number]
): DataSet => {
    const keys = Object.keys(rangeData);

    /* fill label property of data entries */
    for (let key of keys) {
        rangeData[key].forEach((datum: Datum) => {
            datum.labelName = key;
        });
    }

    /* normalization */

    const newRangeData: DataSet = { ...rangeData };

    // Normalize dataset if it exists
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

/* Plot logic */

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
    // State for dropdown visibility
    // const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    // Ref for dropdown to detect outside clicks
    // const dropdownRef = useRef<HTMLDivElement>(null);

    const exportFileName = title
        ? `${questionnaireName}_${title.toLowerCase()}`
        : `${questionnaireName}_chart`;

    // TODO: assure yRange has same format as yTickFormat

    const processedData = useProcessedData(data, yRange, secondYRange);
    console.log('processedData for LineScatterPlot:', processedData);

    const augmentedData = createCommonXAxisForDataSet(processedData);
    console.log('augmentedData for LineScatterPlot:', augmentedData);

    // transform input: input is object, output array
    const datasets = Object.entries(augmentedData).map(([key, points], i) => ({
        key,
        points,
        color: getColor(key, i),
        childName: `dataset-${i}`,
    }));

    // adds/removes identifier of a dataset to/from hiddenKeys
    const toggleKey = (key: string) => {
        setHiddenKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    // Function to compute zoom domain based on data length
    const updateZoomDomain = (data: any[]) => {
        console.log('In updateZoomDomain; data.length', data.length);
        console.log(data);
        if (!data || data.length === 0) return;

        // const xValues = data.map(d => d.x);
        // const minX = Math.min(...xValues);
        // const maxX = Math.max(...xValues);
        let maxNumberOfPoints = 0;
        for (let i = 0; i < data.length; i++) {
            if (data[i].points.length > maxNumberOfPoints) {
                maxNumberOfPoints = data[i].points.length;
            }
        }
        // Example logic: Show full range if data length <= 5, else show last 3 data points
        if (
            maxNumberOfPoints >
            Constants.MAX_NUMBER_OF_QUESTIONNAIRES_VISIBLE + 2
        ) {
            setZoomDomain([
                1,
                Constants.MAX_NUMBER_OF_QUESTIONNAIRES_VISIBLE + 2,
            ]);
        } /* else {
      const lastThreePoints = xValues.slice(-3); // Last 3 points
      setZoomDomain({ x: [Math.min(...lastThreePoints), maxX] });
    } */
    };

    // Update zoom domain when data prop changes
    useEffect(() => {
        updateZoomDomain(datasets);
    }, []);

    // Close dropdown when clicking outside
    //   useEffect(() => {
    //     const handleClickOutside = (event: MouseEvent) => {
    //       if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
    //         setIsDropdownOpen(false);
    //       }
    //     };
    //     document.addEventListener('mousedown', handleClickOutside);
    //     return () => document.removeEventListener('mousedown', handleClickOutside);
    //   }, []);

    // events executed when clicked on legend -> toggle visibility of legend entry and line-scatter plot
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

    /*  const toggleStrokeWidth = (strokeWidth: number, color: string) => {
        if (strokeWidth === STROKE_WIDTH + 1) {
          return null;
        } else {
          return {
            style: {
              strokeWidth: STROKE_WIDTH + 1,
              stroke: color,
            },
          };
        }
      }; */

    // calculate tick values given the range of the data and the number of ticks
    const yTickValues = (range: [number, number], ticks: number): number[] => {
        // if second y axis present, normalize tick values, otherwise keep original range
        const [min, max] = secondYRange ? [0, 1] : range;
        const step = (max - min) / (ticks - 1);
        return Array.from({ length: ticks }, (_, i) => min + i * step);
    };

    // tick values for x-axis without the dummy ticks
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

        // convert to date
        // uniqueX.forEach((d, i) => {
        //     uniqueX[i] = parse(d, "dd/MM/yyyy", new Date()).toISOString();
        //     //const year = parsedISODate.getFullYear();
        //     //const month = parsedISODate.getMonth();
        //     //const day = parsedISODate.getDate();
        //     //uniqueX[i] = day + '/' + (month + 1).toString() + '/' + year;
        // });

        // Sort
        const sortedX = uniqueX.sort((a, b) => {
            return new Date(a).getTime() - new Date(b).getTime(); // for dates saved as strings
        });
        console.log('sortedX:', sortedX);

        // Convert to right format again
        // sortedX.forEach((d, i) => {
        //     const date = new Date(d);
        //     const day = date.getDate();
        //     const month = date.getMonth() + 1;
        //     const year = date.getFullYear();
        //     sortedX[i] = day + '/' + month + '/' + year;
        // })

        // remove first and last element
        // console.log('Unique Array');
        // console.log(uniqueX);
        // console.log('Sorted Array');
        // console.log(sortedX);
        sortedX.shift();
        sortedX.pop();
        console.log('sortedX without first and last:', sortedX);

        // Return all except first and last
        //return sortedX.slice(1, -1);

        return sortedX;
    };

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

    // Export chart as SVG
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

    // Export chart as PNG
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

    // helpers for showing standard range
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

    // Toggle dropdown visibility
    //   const toggleDropdown = () => {
    //     setIsDropdownOpen((prev) => !prev);
    //   };

    // rendering
    return (
        <div
            style={{
                display: 'flex',
            }}

            /* style={{ overflowX: 'auto', overflowY: 'hidden', width: '600px' }} */
        >
            {/* <div style={{ width: '1140px' }}> */}
            <VictoryChart
                width={width}
                height={height}
                // containerComponent={<VictoryVoronoiContainer />}
                theme={CBIOPORTAL_VICTORY_THEME_PROM}
                //theme={VictoryTheme.clean}
                padding={{
                    top: height / 5,
                    bottom: height / 5,
                    left: width / 5,
                    right: width / 5,
                }} // padding between chart and other Victory components, e. g. legend, title
                domainPadding={{ x: 5, y: height / 10 }} // padding between axes and data points (padding around actual plot within the diagram)
                // events
                containerComponent={
                    <VictoryZoomContainer
                        responsive={true}
                        zoomDimension="x"
                        allowZoom={false}
                        zoomDomain={{ x: zoomDomain }}
                        allowPan={true}
                        //zoomDomain={this.state.zoomDomain}
                        //onZoomDomainChange={this.handleZoom.bind(this)}
                        containerRef={chartRef}
                    />
                }
            >
                {/* Chart Title */}
                {/* {title && (
                    <VictoryLabel
                        text={title.toUpperCase()}
                        x={width / 2}
                        y={height / 10}
                        textAnchor="middle"
                        padding={{bottom: 10}}
                    />
                )} */}

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
                            dx={-3 * Constants.TICK_SIZE - 2} //-Constants.TICK_SIZE / 2
                            dy={-height / 3 + Constants.ARROW_HEIGHT - 1} // -height / 3 + Constants.ARROW_HEIGHT + 2
                            angle={0}
                        />
                    } // ok
                    // theme
                    /* style={{
                        ticks: {
                            stroke: Constants.TICK_COLOR,
                            size: Constants.TICK_SIZE,
                            strokeWidth: Constants.TICK_STROKE_WIDTH,
                        },
                        tickLabels: { fontSize: Constants.TICK_FONTSIZE },
                        axisLabel: { fontSize: Constants.AXISLABEL_FONTSIZE },
                        grid: {
                            stroke: Constants.GRID_COLOR,
                            size: Constants.GRID_SIZE,
                            strokeWidth: Constants.GRID_STROKE_WIDTH,
                            strokeDasharray: '10, 5',
                        },
                    }} */
                />
                {/* Second Y Axis */}
                {secondYRange && secondYTickFormat && (
                    <VictoryAxis
                        dependentAxis
                        orientation="right"
                        axisComponent={<ArrowAxis />}
                        label={secondYLabel}
                        //tickValues={tickValues(yRange[1], yTickFormat[1].length)}
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
                                } // -Constants.AXISLABEL_FONTSIZE - height / 3 + Constants.ARROW_HEIGHT + 2
                                angle={0}
                            />
                        }
                        // theme
                        style={{ grid: { strokeOpacity: 0 } }}
                        /* style={{
                            ticks: {
                                stroke: Constants.TICK_COLOR,
                                size: Constants.TICK_SIZE,
                                strokeWidth: Constants.TICK_STROKE_WIDTH,
                            },
                            tickLabels: { fontSize: Constants.TICK_FONTSIZE },
                            axisLabel: { fontSize: Constants.AXISLABEL_FONTSIZE },
                        }} */
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
                    } // dx={0.3 * width - 2} dy={-3 * Constants.TICK_SIZE}
                    // theme
                    style={{ grid: { strokeOpacity: 0 } }}
                    /* style={{
                        ticks: {
                            stroke: Constants.TICK_COLOR,
                            size: Constants.TICK_SIZE,
                            strokeWidth: Constants.TICK_STROKE_WIDTH,
                        },
                        tickLabels: { fontSize: Constants.TICK_FONTSIZE },
                        axisLabel: { fontSize: Constants.AXISLABEL_FONTSIZE },
                    }} */
                />

                {/* Label for standard Range MUST USE NORMALZED RANGE*/}
                {/* {standardRange && 
                    <VictoryLabel
                        //textAnchor="inherit"
                        style={{ fontSize: LABEL_FONTSIZE, opacity: 0.9 }}
                        x={standardRange.name ? 0.7 * width - standardRange.name.length * 4 : 0.7 * width - 40}
                        y={(yTickFormat.length + 1)/yTickFormat.length * standardRange.range[0] * height + 1}
                        text={standardRange.name}
                    />      
                } */}

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
                                        //strokeWidth: Constants.LINE_STROKE_WIDTH, //theme
                                        visibility: hiddenKeys.includes(key)
                                            ? 'hidden'
                                            : 'visible',
                                    },
                                }}
                                interpolation="linear"
                                //dataComponent={<LineSegment />}
                                /* events={!hiddenKeys.includes(key) ? [
                                    {
                                      target: "data",
                                      eventHandlers: {
                                        onClick: () => {
                                          return [
                                            {
                                              eventKey: "all",
                                              mutation: (props: any) =>
                                                toggleStrokeWidth(
                                                  props.style
                                                    ?.strokeWidth, color
                                                ),
                                            },
                                          ];
                                        },
                                      },
                                    },
                                  ] : null} */
                            />
                            <VictoryScatter
                                name={childName}
                                data={points}
                                sortOrder="ascending"
                                sortKey="x"
                                scale={{ x: 'time' }}
                                //size={Constants.SCATTER_POINT_SIZE} //theme // size={( { active }: { active: any }) => active ? 2 * SCATTER_POINT_SIZE: SCATTER_POINT_SIZE}
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
                                labelComponent={
                                    <VictoryTooltip
                                        dy={-7}
                                        // theme
                                        /* cornerRadius={5}
                                        flyoutPadding={{
                                            top: 4,
                                            bottom: 4,
                                            left: 6,
                                            right: 6,
                                        }}
                                        flyoutStyle={{
                                            fill: 'white',
                                            stroke: 'gray',
                                        }}
                                        pointerWidth={5}
                                        style={{
                                            fontSize: Constants.LABEL_FONTSIZE,
                                            fill: '#333',
                                        }} */
                                    />
                                }
                                //dataComponent={<Point />}
                            />
                        </VictoryGroup>
                    );
                })}

                {/* Legend */}
                <VictoryLegend
                    title={secondYRange ? null : 'Legend'}
                    orientation={secondYRange ? 'horizontal' : 'vertical'}
                    y={secondYRange ? 16 : height / 6 + 2} // height / 6 + 2 : height / 6 + 2
                    x={secondYRange ? width / 5 + 15 : (5 / 6) * width} // secondYRange ? width / 5 + 5 : (5 / 6) * width
                    gutter={20} // theme // only for horizontal alignment standardRang ? width / 5 - 6 : width / 2 - 5
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

                    // theme
                    /* style={{
                        title: {
                            fontSize: Constants.LEGEND_FONTSIZE,
                            fontWeight: 'bold',
                        },
                        labels: { fontSize: Constants.TICK_FONTSIZE },
                        padding: { bottom: 8, top: 8, left: 4, right: 4 },
                    }} */
                />
            </VictoryChart>
            {/* </div> */}

            <div className="column-download-buttons">
                {/*   <button onClick={() => exportAsSVG(`${exportFileName}.svg`)}>Export as SVG</button>
                    <button onClick={() => exportAsPNG(`${exportFileName}.png`)}>Export as PNG</button>
 */}
                {/* <DownloadControls
                        buttons={['PDF', 'PNG', 'SVG']}
                        filename="timeline"
                        dontFade={true}
                        type={'button'}
                        style={{ marginLeft: 7 }}
                    /> */}

                {/*  <div ref={dropdownRef}>  */}
                {/* className */}
                {/*    <DefaultTooltip
                            overlay={<span>Export PNG or SVG</span>}
                            placement='top'
                        >
 <button
          onClick={toggleDropdown}
          className="btn btn-default btn-xs"
        >
          
                                        <FontAwesome name="cloud-download" />
                                    
        </button>
                        </DefaultTooltip> */}

                {/* {isDropdownOpen && ( */}
                <React.Fragment>
                    <div>
                        {' '}
                        {/* className */}
                        <DefaultTooltip
                            overlay={<span>Download SVG</span>}
                            placement="right"
                        >
                            <button
                                onClick={() =>
                                    exportAsSVG(`${exportFileName}.svg`)
                                }
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
                                onClick={() =>
                                    exportAsPNG(`${exportFileName}.png`)
                                }
                                className="btn btn-default btn-xs download-button"
                            >
                                <FontAwesome name="cloud-download" /> PNG
                            </button>
                        </DefaultTooltip>
                    </div>
                </React.Fragment>
                {/* )} */}
                {/* </div> */}
            </div>
        </div>
    );
};

export default LineScatterPlot;
