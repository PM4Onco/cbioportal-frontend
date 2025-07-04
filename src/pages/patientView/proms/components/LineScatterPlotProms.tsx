import React, { useState, useMemo } from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import FontAwesome from 'react-fontawesome';
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
} from 'victory';

import {
    CBIOPORTAL_VICTORY_THEME,
    axisTickLabelStyles,
    getTextWidth,
    ScatterPlotTooltip,
    ScatterPlotTooltipHelper,
    truncateWithEllipsis,
    wrapText,
} from 'cbioportal-frontend-commons';

import CBIOPORTAL_VICTORY_THEME_PROM from '../utils/cBioPortalThemePROM';

import * as Constants from '../utils/PromChartConstants';

import {
    Datum,
    DataSet,
    Range,
    mergeArrays,
    createRangeData,
    normalizeDataSet,
    getOriginalY,
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
    standardRange?: Range;
    showTooltip?: boolean;
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
    if (key === 'Average') {
        return Constants.averageLayoutValues.color;
    }
    if (key === 'Index') {
        return Constants.eqLayoutValues.color;
    }
    if (key === 'VAS') {
        return Constants.vasLayoutValues.color;
    }
    if (key === 'Standard Range') {
        return Constants.standardRangeLayoutValues.color;
    } else {
        return Constants.lineColors[index % Constants.lineColors.length];
    }
};

const getLegendSymbol = (key: string): string => {
    if (key === 'Average') {
        return Constants.averageLayoutValues.symbol;
    }
    if (key === 'Index') {
        // negative values ??
        return Constants.eqLayoutValues.symbol;
    }
    if (key === 'VAS') {
        return Constants.vasLayoutValues.symbol;
    }
    if (key === 'Standard Range') {
        return Constants.standardRangeLayoutValues.symbol;
    } else {
        return 'minus';
    }
};

const getScatterSymbol = (key: string, origY: number | null): string => {
    if (key === 'Average') {
        return Constants.averageLayoutValues.symbol;
    }
    if (key === 'Index') {
        // negative values ??
        if (origY !== null && origY < 0) {
            return Constants.eqLayoutValues.symbolNegative;
        }
        return Constants.eqLayoutValues.symbol;
    }
    if (key === 'VAS') {
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
    if (key === 'Index' && origY !== null && origY < 0) {
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
    return useMemo(() => {
        const keys = Object.keys(data);

        /* fill label property of data entries */
        for (let key of keys) {
            data[key].forEach((datum: Datum) => {
                datum.labelName = key;
            });
        }

        // add dummy data as first and last element (used for standardRange)
        //if (standardRange) {
        for (let key of keys) {
            let dummyDatumBefore: Datum;
            let dummyDatumAfter: Datum;
            if (data[key].every(datum => typeof datum.x === 'number')) {
                dummyDatumBefore = { x: -Infinity, y: null };
                dummyDatumAfter = { x: Infinity, y: null };
            } else {
                // strings
                dummyDatumBefore = { x: '!', y: null }; // first utf-16 element to ensure sorting won't destroy order
                dummyDatumAfter = { x: '~', y: null }; // last utf-16 element to ensure sorting won't destroy order
            }
            data[key].unshift(dummyDatumBefore);
            data[key].push(dummyDatumAfter);
        }
        //}

        /* normalization */
        // If no second axis, return original data (no normalization needed here)
        if (!secondYRange) {
            return data;
        }

        const newData: DataSet = { ...data };

        // Normalize the first dataset if it exists
        if (keys.length > 0) {
            newData[keys[0]] = normalizeDataSet(data[keys[0]], yRange);
        }
        // Normalize the second dataset if it exists and secondYRange is valid
        if (keys.length > 1 && secondYRange) {
            newData[keys[1]] = normalizeDataSet(data[keys[1]], secondYRange);
        }
        return newData;
    }, [data, yRange, secondYRange]);
};

/* Plot logic */

const LineScatterPlot: React.FC<LineScatterPlotProps> = ({
    data,
    width = 600,
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
}) => {
    // useState hook to show and hide specific datasets
    const [hiddenKeys, setHiddenKeys] = useState<string[]>(['Average']); // datasetes named "Average" are initially not shown

    // TODO: assure yRange has same format as yTickFormat

    const processedData = useProcessedData(data, yRange, secondYRange);

    // transform input: input is object, output array
    const datasets = Object.entries(processedData).map(([key, points], i) => ({
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
    const xTickValues = (data: DataSet): Array<number | string> => {
        const allX: (string | number)[] = [];
        for (const series of Object.values(data)) {
            for (const d of series) {
                if (d.x !== null && d.x !== undefined) {
                    allX.push(d.x);
                }
            }
        }

        // Remove duplicates
        const uniqueX = Array.from(new Set(allX));

        // Sort
        const sortedX = uniqueX.sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number') return a - b;
            return new Date(a).getTime() - new Date(b).getTime(); // for dates saved as strings
        });
        // remove first and last element
        // console.log('Unique Array');
        // console.log(uniqueX);
        // console.log('Sorted Array');
        // console.log(sortedX);
        sortedX.shift();
        sortedX.pop();

        // Return all except first and last
        //return sortedX.slice(1, -1);
        return sortedX;
    };

    const displayTooltip = (datum: Datum, origData: Datum[]): string => {
        if (secondYRange) {
            const originalY = getOriginalY(datum.x, origData);
            return `${datum.labelName}: ${originalY}`;
        }
        return `${datum.labelName}: ${datum.y}`;
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
        standardRangeDataProcessed = useProcessedData(
            standardRangeData,
            yRange,
            secondYRange
        );
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

    // rendering
    return (
        <div /*style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%' }}*/
        >
            {/* <div style={{ width: '1140px' }}> */}
            <VictoryChart
                width={width}
                height={height}
                //containerComponent={<VictoryVoronoiContainer />}
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
                //   containerComponent={
                //   <VictoryZoomContainer responsive={true}
                //     zoomDimension="x"
                //     allowZoom={false}
                //     zoomDomain={{ x: [1, 6] }}
                //     //allowPan={true}
                //     //zoomDomain={this.state.zoomDomain}
                //     //onZoomDomainChange={this.handleZoom.bind(this)}
                //   />
                // }
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
                    //tickFormat={xTickValues(data)}
                    axisLabelComponent={
                        <VictoryLabel dx={0.3 * width - 2} dy={0} />
                    } // dx={0.29 * width} dy={-3 * Constants.TICK_SIZE}
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
                                  name: key,
                                  symbol: {
                                      fill: hiddenKeys.includes(key)
                                          ? 'lightgray'
                                          : color,
                                      type: getLegendSymbol(key),
                                      opacity:
                                          key === 'Standard Range'
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
                                          key === 'Standard Range' &&
                                          !hiddenKeys.includes(key)
                                              ? Constants
                                                    .standardRangeLayoutValues
                                                    .labelOpacity
                                              : 1.0,
                                  },
                              }))
                            : datasets.map(({ key, color }, i) => ({
                                  name: key,
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
        </div>
    );
};

export default LineScatterPlot;
