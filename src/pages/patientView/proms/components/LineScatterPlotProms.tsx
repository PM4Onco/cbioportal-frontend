import React, { useState, useMemo } from 'react';
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
import { key } from 'localforage';

/* Interfaces for data format */

// structure of a singel data point
interface Datum {
    x: number | string | Date;
    y: number | null;
    y0?: number;
}

// structure of input data object: identifier, x/y points
export interface DataSet {
    [key: string]: Datum[];
}

// structure of range data
export interface Range {
    name?: string;
    range: [number, number];
}

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
}

/* Pre-defined constants*/

// colors
const colors = [
    '#0dcaf0',
    '#198754',
    '#fd7e14',
    '#6610f2',
    '#dc3545',
    '#212529',
    '#20c997',
];

// base layout constants
const STROKE_WIDTH = 1;
const TEXT_FONTSIZE = 8;

// fontsize
const TICK_FONTSIZE = TEXT_FONTSIZE;
const AXISLABEL_FONTSIZE = TICK_FONTSIZE + 1;
const TITLE_FONTSIZE = TICK_FONTSIZE + 2;
const LEGEND_FONTSIZE = AXISLABEL_FONTSIZE;

// stroke width
const LINE_STROKE_WIDTH = STROKE_WIDTH / 2;
const GRID_STROKE_WIDTH = 0.75 * STROKE_WIDTH;
const TICK_STROKE_WIDTH = STROKE_WIDTH;
const AXIS_STROKE_WIDTH = LINE_STROKE_WIDTH;

// size
const SCATTER_POINT_SIZE = 4 * LINE_STROKE_WIDTH;
const GRID_SIZE = 5;
const TICK_SIZE = GRID_SIZE + 1;

// grid colors
const AXIS_COLOR = 'gray';
const TICK_COLOR = AXIS_COLOR;
const GRID_COLOR = 'lightgray';

// arrows
const ARROW_HEIGHT = (2 / 3) * 2 * TICK_SIZE + 2 / 3;
const ARROW_WIDTH = 2 * TICK_SIZE + 1;
const REF_Y = ARROW_HEIGHT / 2;
const POLYGON = '0 0, ' + ARROW_WIDTH + ' ' + REF_Y + ', 0 ' + ARROW_HEIGHT;

// custom svg component: axis with arrow at end
const ArrowAxis = (props: any) => {
    return (
        <svg>
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth={ARROW_WIDTH}
                    markerHeight={ARROW_HEIGHT}
                    refX="0"
                    refY={REF_Y}
                    orient="auto"
                    fill={AXIS_COLOR}
                >
                    <polygon points={POLYGON} />
                </marker>
            </defs>
            <line
                x1={props.x1}
                y1={props.y2}
                x2={props.x2}
                y2={props.dimension === 'x' ? props.y2 : props.y1}
                stroke={AXIS_COLOR}
                stroke-width={AXIS_STROKE_WIDTH}
                marker-end="url(#arrowhead)"
            />
        </svg>
    );
};

/* Helper functions */

// functions that returns the smallest and largest x values (used for computing the standard range area plot)
const getXDomain = (
    dataSet: DataSet
): {
    minX: Datum['x'] | null;
    maxX: Datum['x'] | null;
} => {
    const allX: Datum['x'][] = [];

    for (const series of Object.values(dataSet)) {
        for (const { x } of series) {
            allX.push(x);
        }
    }

    if (allX.length === 0) return { minX: null, maxX: null };

    // Normalize to sortable numbers
    const xWithSortKeys = allX.map(originalX => {
        let key: number;

        if (typeof originalX === 'number') {
            key = originalX;
        } else if (typeof originalX === 'string') {
            key = new Date(originalX).getTime(); // fallback for ISO strings
        } else if (originalX instanceof Date) {
            key = originalX.getTime();
        } else {
            throw new Error('Unsupported x type');
        }

        return { originalX, key };
    });

    // Sort by key
    xWithSortKeys.sort((a, b) => a.key - b.key);

    return {
        minX: xWithSortKeys[0].originalX,
        maxX: xWithSortKeys[xWithSortKeys.length - 1].originalX,
    };
};

/* function that merges two arrays where the values of the second are added after a specific position, 
thus the output looks like [first part of first array, second array, remaining of first array]*/
const mergeArrays = (
    array1: any[],
    array2: any[],
    insertPosition: number
): any[] => {
    const arr1 = array1;
    const arr2 = array2;
    const position = insertPosition;

    if (position < 0 || position === null || position === undefined) return [];
    let result = [];

    // if position greater than length of arr1, concate arr2 to arr1 regardless of concrete position
    if (position > arr1.length - 1) {
        for (let i = 0; i < arr1.length + arr2.length; i++) {
            result[i] = i < arr1.length ? arr1[i] : arr2[i - arr2.length];
        }
        return result;
    }

    // add first part of first array
    for (let i = 0; i < position; i++) {
        result[i] = arr1[i];
    }
    // add second array
    for (let i = position; i < position + arr2.length; i++) {
        result[i] = arr2[i - position];
    }
    // add remaining part of first array
    for (let i = position + arr2.length; i < arr2.length + arr1.length; i++) {
        result[i] = arr1[i - arr2.length];
    }
    return result;
};

// functional hook to display standard range in plot

const useStandardRangeData = (
    dataSet: DataSet,
    standardRange: Range
): DataSet => {
    return useMemo(() => {
        const { minX, maxX } = getXDomain(dataSet);

        if (minX === null || maxX === null) return {};

        // if name given in standardRange, use this, otherwise a default name
        const name = standardRange.name ? standardRange.name : 'Standard Range';
        // create DataSet of two elements = four value pairs
        const result: DataSet = {
            [name]: [
                {
                    x: minX,
                    y: standardRange.range[1],
                    y0: standardRange.range[0],
                },
                {
                    x: maxX,
                    y: standardRange.range[1],
                    y0: standardRange.range[0],
                },
            ],
        };

        return result;
    }, [dataSet, standardRange]);
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
}) => {
    // useState hook to show and hide specific datasets
    const [hiddenKeys, setHiddenKeys] = useState<string[]>(['Average']); // datasetes named "Average" are initially not shown

    // TODO: assure yRange has same format as yTickFormat

    // Hook to memoize processed data, applying normalization if a second Y axis is present.
    const useProcessedData = (
        data: DataSet,
        yRange: [number, number],
        secondYRange?: [number, number]
    ): DataSet => {
        return useMemo(() => {
            // If no second axis, return original data (no normalization needed here)
            if (!secondYRange) {
                return data;
            }
            const keys = Object.keys(data);
            const newData: DataSet = { ...data };

            // A standard normalization to [0, 1] would typically use (y - minY) / (maxY - minY).
            const normalizeDataSet = (
                dataSet: Datum[],
                range: [number, number]
            ): Datum[] => {
                const [minY, maxY] = range;

                // If normalization not possible (max is 0 or max equals min), return original data.
                if (maxY === 0 || maxY === minY) {
                    return dataSet;
                }

                // Normalize the y values
                return dataSet.map(datum => ({
                    ...datum,
                    y:
                        typeof datum.y === 'number'
                            ? (datum.y - minY) / (maxY - minY)
                            : null,
                }));
            };

            // Normalize the first dataset if it exists
            if (keys.length > 0) {
                newData[keys[0]] = normalizeDataSet(data[keys[0]], yRange);
            }
            // Normalize the second dataset if it exists and secondYRange is valid
            if (keys.length > 1 && secondYRange) {
                newData[keys[1]] = normalizeDataSet(
                    data[keys[1]],
                    secondYRange
                );
            }
            return newData;
        }, [data, yRange, secondYRange]);
    };

    const processedData = useProcessedData(data, yRange, secondYRange);

    // transform input: input is object, output array
    const datasets = Object.entries(processedData).map(([key, points], i) => ({
        key,
        points,
        color: colors[i % colors.length],
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

    // calculate tick values given the range of the data and the number of ticks
    const tickValues = (range: [number, number], ticks: number): number[] => {
        // if second y axis present, normalize tick values, otherwise keep original range
        const [min, max] = secondYRange ? [0, 1] : range;
        const step = (max - min) / (ticks - 1);
        return Array.from({ length: ticks }, (_, i) => min + i * step);
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
        standardRangeData = useStandardRangeData(data, standardRange);
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
            color: 'black',
            childName: `range-${i}`,
        }));
        mergedDataForLegend = mergeArrays(datasets, standardRangeDataMapped, 1);
    }

    // rendering
    return (
        <div
            className="container"
            style={{ display: 'flex', alignItems: 'flex-start' }}
        >
            <VictoryChart
                width={width}
                height={height}
                /* containerComponent={
                    <VictoryVoronoiContainer />
                  } */
                //theme={CBIOPORTAL_VICTORY_THEME}
                theme={VictoryTheme.clean}
                padding={{
                    top: height / 5,
                    bottom: height / 5,
                    left: width / 5,
                    right: width / 5,
                }} // padding between chart and other Victory components, e. g. legend, title
                domainPadding={{ x: width / 10, y: width / 30 }} // padding between axes and data points (padding around actual plot within the diagram)
                // events
            >
                {/* Chart Title */}
                {title && (
                    <VictoryLabel
                        text={title.toUpperCase()}
                        x={width / 2} // ok
                        y={height / 10} // ok
                        textAnchor="middle"
                        style={{ fontSize: TITLE_FONTSIZE, fontWeight: 'bold' }}
                    />
                )}

                {/* Important: first print Y axis, then X axis */}

                {/* Y Axis */}
                <VictoryAxis
                    dependentAxis
                    orientation="left"
                    axisComponent={<ArrowAxis />}
                    label={yLabel}
                    tickValues={tickValues(yRange, yTickFormat.length)}
                    tickFormat={yTickFormat}
                    axisLabelComponent={
                        <VictoryLabel
                            dx={-TICK_SIZE / 2}
                            dy={-height / 3 + ARROW_HEIGHT + 2}
                            angle={0}
                        />
                    } // ok
                    style={{
                        // axis: { stroke: AXIS_COLOR, strokeWidth: AXIS_STROKE_WIDTH },
                        ticks: {
                            stroke: TICK_COLOR,
                            size: TICK_SIZE,
                            strokeWidth: TICK_STROKE_WIDTH,
                        },
                        tickLabels: { fontSize: TICK_FONTSIZE },
                        axisLabel: { fontSize: AXISLABEL_FONTSIZE },
                        grid: {
                            stroke: GRID_COLOR,
                            size: GRID_SIZE,
                            strokeWidth: GRID_STROKE_WIDTH,
                            strokeDasharray: '10, 5',
                        },
                    }}
                />
                {/* Second Y Axis */}
                {secondYRange && secondYTickFormat && (
                    <VictoryAxis
                        dependentAxis
                        orientation="right"
                        axisComponent={<ArrowAxis />}
                        label={secondYLabel}
                        //tickValues={tickValues(yRange[1], yTickFormat[1].length)}
                        tickValues={tickValues(
                            secondYRange,
                            secondYTickFormat.length
                        )}
                        tickFormat={secondYTickFormat}
                        axisLabelComponent={
                            <VictoryLabel
                                dx={-TICK_SIZE / 2}
                                dy={
                                    -AXISLABEL_FONTSIZE -
                                    height / 3 +
                                    ARROW_HEIGHT +
                                    2
                                }
                                angle={0}
                            />
                        }
                        style={{
                            ticks: {
                                stroke: TICK_COLOR,
                                size: TICK_SIZE,
                                strokeWidth: TICK_STROKE_WIDTH,
                            },
                            tickLabels: { fontSize: TICK_FONTSIZE },
                            axisLabel: { fontSize: AXISLABEL_FONTSIZE },
                        }}
                    />
                )}

                {/* X Axis */}
                <VictoryAxis
                    axisComponent={<ArrowAxis />}
                    label={xLabel}
                    axisLabelComponent={
                        <VictoryLabel dx={0.29 * width} dy={-3 * TICK_SIZE} />
                    } // ok y={-2 * AXISLABEL_FONTSIZE}
                    style={{
                        // axis: { stroke: AXIS_COLOR, strokeWidth: AXIS_STROKE_WIDTH },
                        ticks: {
                            stroke: TICK_COLOR,
                            size: TICK_SIZE,
                            strokeWidth: TICK_STROKE_WIDTH,
                        },
                        tickLabels: { fontSize: TICK_FONTSIZE },
                        axisLabel: { fontSize: AXISLABEL_FONTSIZE },
                    }}
                />

                {/* Plots */}

                {datasets.map(({ key, points, color, childName }) => {
                    const scatterPoints = points.filter(
                        p => p.y !== null && p.y !== undefined
                    ); // filters out points with null or undefined y-value
                    return (
                        <VictoryGroup>
                            {/*data={scatterPoints}*/}
                            <VictoryLine
                                name={childName}
                                data={points}
                                style={{
                                    data: {
                                        stroke: color,
                                        strokeWidth: LINE_STROKE_WIDTH,
                                        visibility: hiddenKeys.includes(key)
                                            ? 'hidden'
                                            : 'visible',
                                    },
                                }}
                                interpolation="linear"
                                //dataComponent={<LineSegment />}
                            />
                            <VictoryScatter
                                name={childName}
                                data={points}
                                size={SCATTER_POINT_SIZE} // size={( { active }: { active: any }) => active ? 2 * SCATTER_POINT_SIZE: SCATTER_POINT_SIZE}
                                symbol={'circle'}
                                style={{
                                    data: {
                                        fill: color,
                                        visibility: hiddenKeys.includes(key)
                                            ? 'hidden'
                                            : 'visible',
                                    },
                                }}
                                //labels={({ datum }: { datum: Datum}) => `(${datum.x}, ${datum.y})`}
                                //labelComponent={<VictoryTooltip />}
                                //dataComponent={<Point />}
                            />
                        </VictoryGroup>
                    );
                })}
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
                                            opacity: 0.04,
                                            visibility: hiddenKeys.includes(key)
                                                ? 'hidden'
                                                : 'visible',
                                        },
                                    }}
                                />
                            );
                        }
                    )}

                {/* Legend */}
                <VictoryLegend
                    title={secondYRange ? null : 'Legend'}
                    orientation={secondYRange ? 'horizontal' : 'vertical'}
                    y={secondYRange ? height / 6 + 2 : height / 6 + 2}
                    x={secondYRange ? width / 5 + 5 : (5 / 6) * width} // Problem bei sehr langen Legendeneinträgen: werden abgeschnitten
                    gutter={standardRange ? width / 5 - 6 : width / 2 - 5} // only for horizontal alignment
                    name="legend"
                    data={
                        standardRange
                            ? mergedDataForLegend.map(({ key, color }) => ({
                                  name: key,
                                  symbol: {
                                      fill: hiddenKeys.includes(key)
                                          ? 'lightgray'
                                          : color,
                                      type:
                                          key == 'Standard Range'
                                              ? 'square'
                                              : 'minus',
                                      opacity:
                                          key === 'Standard Range' ? 0.12 : 1.0,
                                  },
                                  labels: {
                                      fill: hiddenKeys.includes(key)
                                          ? 'lightgray'
                                          : color,
                                      opacity:
                                          key === 'Standard Range' &&
                                          !hiddenKeys.includes(key)
                                              ? 0.8
                                              : 1.0,
                                  },
                              }))
                            : datasets.map(({ key, color }) => ({
                                  name: key,
                                  symbol: {
                                      fill: hiddenKeys.includes(key)
                                          ? 'lightgray'
                                          : color,
                                      type: 'minus',
                                  },
                                  labels: {
                                      fill: hiddenKeys.includes(key)
                                          ? 'lightgray'
                                          : color,
                                  },
                              }))
                    }
                    events={legendEvents}
                    style={{
                        title: {
                            fontSize: LEGEND_FONTSIZE,
                            fontWeight: 'bold',
                        },
                        labels: { fontSize: TICK_FONTSIZE },
                        padding: { bottom: 8, top: 8, left: 4, right: 4 },
                    }}
                />
            </VictoryChart>
        </div>
    );
};

export default LineScatterPlot;
