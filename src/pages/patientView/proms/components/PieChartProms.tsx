import React, { useState, useMemo, useEffect } from 'react';
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
    VictoryPie,
    VictoryContainer,
} from 'victory';

import * as Constants from '../utils/PromChartConstants';

import { Datum, transformString } from '../utils/PromChartHelperFunctions';

import CBIOPORTAL_VICTORY_THEME_PROM from '../utils/cBioPortalThemePROM';

/* Interfaces for data format */

// Props of PieChart
interface PieChartProps {
    data: Datum;
    width?: number;
    height?: number;
    dataRange: [number, number];
    thresholds?: number[];
}

/* Pre-defined constants*/

// colors
//const colors = ['#ff9800 ', 'lightgray'];

// create array of length 2 (two parts of pie chart)
const processData = (data: Datum, range: [number, number]): Datum[] => {
    let newData: Datum[] = [];

    newData[0] = data;
    newData[1] = { x: '', y: data.y !== null ? range[1] - data.y : range[1] };

    return newData;
};

const getColors = (
    y: number,
    thresholds: number[] | null | undefined,
    thresholdColorScale: string[],
    defaultColorScale: string[]
): string[] => {
    // Voraussetzungen: defautlColorScale.length === 2

    if (
        thresholds === null ||
        thresholds === undefined ||
        thresholds.length === 0 ||
        thresholdColorScale.length === 0
    ) {
        return defaultColorScale;
    }

    // for given y, find index of nearest smaller number of thresholds
    let colorIndex = thresholds.length;
    for (let j = 0; j < thresholds.length; j++) {
        if (thresholds[j] > y) {
            colorIndex = j;
            break;
        }
    }

    let color: string;

    // deals with the case if length of thresholds is greater or equal than lenght of colors corr. to thresholds
    if (
        thresholdColorScale.length > thresholds.length ||
        colorIndex < thresholdColorScale.length
    ) {
        // everything ok
        color = thresholdColorScale[colorIndex];
    } else {
        color = thresholdColorScale[thresholdColorScale.length - 1]; // choose last color
    }

    const newColors = [...defaultColorScale];
    newColors.shift();
    newColors.unshift(color);

    return newColors;
};

/* Plot logic */

const PieChart: React.FC<PieChartProps> = ({
    data,
    width = 125, //125
    height = 150, // 150
    dataRange,
    thresholds,
}) => {
    // viewBox path
    const viewBoxPath = '0 0 ' + width + ' ' + height;

    const processedData = processData(data, dataRange);

    // rendering
    return (
        <div
        /* className="container"
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }} */
        >
            <svg viewBox={viewBoxPath} width={width} height={height}>
                {/* Pie Chart */}
                <VictoryPie
                    theme={CBIOPORTAL_VICTORY_THEME_PROM}
                    containerComponent={<VictoryContainer />}
                    standalone={false}
                    radius={width / 3}
                    width={width}
                    height={width}
                    innerRadius={width / 4}
                    labels={[]}
                    data={processedData}
                    colorScale={getColors(
                        data.y !== null ? data.y : NaN,
                        thresholds,
                        Constants.thresholdColorScale,
                        Constants.defaultPieColors
                    )}
                    padAngle={3}
                />

                {/* Labels for name and value*/}
                {/* value in the middle of the doughnut chart*/}
                <VictoryLabel
                    textAnchor="middle"
                    style={{
                        fontSize: Constants.LABEL_TITLE_FONTSIZE,
                        fontWeight: 'bold',
                        fill:
                            data.y !== null && data.y < 0
                                ? Constants.eqLayoutValues.colorNegative
                                : Constants.cBioPortalFontColor,
                    }}
                    x={width / 2}
                    y={width / 2}
                    text={
                        data.y !== null
                            ? //data.y.toString().includes('.')
                              // ? data.y//.toFixed(2)
                              //:
                              data.y
                            : 'N/A'
                    }
                />

                {/* name below chart */}
                <VictoryLabel
                    textAnchor="middle"
                    style={{
                        fontSize: Constants.LABEL_TITLE_FONTSIZE,
                        fill: Constants.cBioPortalFontColor,
                    }}
                    x={width / 2}
                    y={height - 20} // - 3 * Constants.LABEL_TITLE_FONTSIZE
                    text={transformString(data.x.toString())}
                />
            </svg>
        </div>
    );
};

export default PieChart;
