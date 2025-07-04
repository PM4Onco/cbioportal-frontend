import React, { useState, useEffect } from 'react';
import Timeline from './components/patientTimeline';
// import TimelineWrapper from 'pages/patientView/timeline/TimelineWrapper';
import LineScatterPlot from './components/LineScatterPlotProms';
import {
    DataSet,
    StringDataSet,
    addElementToDataset,
    addElementToStringDataset,
    transformString,
    calculateAverage,
    sortArrayBasedOnComparator,
    isAttributeNumberValueWellDefined,
    isAttributeDateValueWellDefined,
    compareClinicalEvents,
    splitString,
    convertISOToDDMMYYYY,
} from './utils/PromChartHelperFunctions';
import {
    PROM_KEYS,
    AVERAGE_KEY,
    DATE_KEY,
    INDEX_KEY,
    EQ_RANGE,
    VAS_RANGE,
    EQ_VALUES_ALPHA,
    VAS_VALUES_ALPHA,
    VALUES_ALPHA,
    VALUES_RANGE,
    chartTitles,
    questionnaireName,
    eq5d5lInfo,
    currentEqVasDescription,
    scoresDescription,
    healthDetailsDescription,
} from './utils/EQ-5D-5LChartMetadata';
import PieChart from './components/PieChartProms';

import FontAwesome from 'react-fontawesome';

// import SampleManager from 'pages/patientView/SampleManager';
// import { PatientViewPageInner } from 'pages/patientView/PatientViewPage';
// import PatientViewCnaDataStore from 'pages/patientView/copyNumberAlterations/PatientViewCnaDataStore'; // Import type if needed

import { PatientViewPageStore } from 'pages/patientView/clinicalInformation/PatientViewPageStore';
import PatientViewMutationsDataStore from '../mutation/PatientViewMutationsDataStore';
import {
    Grid,
    Row,
    Col,
    Clearfix,
    Tooltip,
    OverlayTrigger,
} from 'react-bootstrap';
//import ReactGridLayout  from 'react-grid-layout';
import 'bootstrap/dist/css/bootstrap.min.css';

import {
    DefaultTooltip,
    placeArrowBottomLeft,
} from 'cbioportal-frontend-commons';

import { ClinicalEvent } from 'cbioportal-ts-api-client';

// import styles from './promStyles.module.scss';
import './styles.scss';

interface PROMsProps {
    patientViewPageStore: PatientViewPageStore;
    sampleManager: any;
    dataStore: PatientViewMutationsDataStore;
}

// Folgende Konstanten sollten auch aus Backend kommen
const standardRange: [number, number] = [0.45, 0.7];
const thresholdsEQ: number[] = [0.2, 0.4, 0.6, 0.8]; // ggf auch für VAS
const thresholdsVAS: number[] = [];

const InfoTooltip = ({
    id,
    children,
    href,
    tooltip,
    placement,
}: {
    id: string;
    children: any;
    href: string;
    tooltip: any;
    placement: string;
}) => {
    return (
        <DefaultTooltip
            placement={placement}
            trigger={['hover', 'focus', 'click']}
            overlay={tooltip}
            arrowContent={<div className="rc-tooltip-arrow-inner" />}
            destroyTooltipOnHide={true}
            //onPopupAlign={placeArrowBottomLeft}
        >
            {children}
        </DefaultTooltip>
    );
};

/* function to convert date to right format */
// function formatDate(date: Date) {
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
//     const year = date
//         .getFullYear()
//         .toString()
//         .slice(-2); // Get the last two digits of the year

//     return `${day}/${month}/${year}`;
// }

/* pre-process given data */
// hook for processing data
const useProcessedData = (data: ClinicalEvent[]): DataSet[] => {
    const promData = data.filter(
        (event: ClinicalEvent) => event.eventType === questionnaireName
    );
    console.log('promData:');
    console.log(promData);

    let datasetKeys: string[] = [];
    let dimensionDataset: DataSet = {};
    let eqVASDataset: DataSet = {};
    let currentScoreDataset: DataSet = {};
    let latestScores: [string, number | string | null][] = [];
    let latestScoreDates: string[] = [];
    let latestScoreDatesKeys: string[] = [];
    let latestScoresDate = '';

    //let useRelativeDates = false;

    // Write out all keys provided in promData set
    promData.forEach((event: ClinicalEvent) => {
        event.attributes.forEach((item: any) => {
            if (!datasetKeys.includes(item.key)) {
                datasetKeys.push(item.key);
            }
        });
    });
    console.log('datasetKeys:', datasetKeys); //ok

    const datasetKeysForPlots = datasetKeys.filter((key: string) =>
        PROM_KEYS.includes(key)
    );
    // Add key for average
    if (AVERAGE_KEY !== undefined) {
        datasetKeysForPlots.push(AVERAGE_KEY);
    }
    console.log('datasetKeysForPlots:', datasetKeysForPlots);

    let keysForDimensionPlot = datasetKeysForPlots.filter((key: string) => {
        const dimensionKeys = PROM_KEYS.slice(0, PROM_KEYS.length - 2);
        return dimensionKeys.includes(key);
    });
    console.log('keysForDimensionPlot:', keysForDimensionPlot);

    let keysForEQVASPlot = datasetKeysForPlots.filter((key: string) => {
        const eqVasKeys = PROM_KEYS.slice(
            PROM_KEYS.length - 2,
            PROM_KEYS.length
        );
        return eqVasKeys.includes(key);
    });

    console.log('keysForEQVASPlot:', keysForEQVASPlot);

    // sort promData according to startdate in ascending order
    promData.sort(compareClinicalEvents);
    console.log('promData sorted:', promData);

    promData.forEach((event: ClinicalEvent, index: number) => {
        let valuesForAverageCalculation: number[] = [];
        datasetKeysForPlots.forEach((key: string) => {
            let value = event.attributes.find((item: any) => item.key === key)
                ?.value;
            //console.log("value: ", value)

            let date = event.attributes.find(
                (item: any) => item.key === DATE_KEY
            )?.value;
            //console.log("date: ", date)

            // Check if date is not found or maldefined
            if (!isAttributeDateValueWellDefined(date)) {
                // || useRelativeDates
                return;
                //date = event.startNumberOfDaysSinceDiagnosis.toString();
                //useRelativeDates = true;
            } else {
                // format date
                // date is always non-null
                const realDate: string = date ? date : '';
                //const parsedDate = Date.parse(realDate);
                if (!isNaN(Date.parse(realDate))) {
                    const parsedDate = new Date(realDate);
                    const year = parsedDate.getFullYear();
                    const month = parsedDate.getMonth();
                    const day = parsedDate.getDate();
                    // date = day + '/' + (month + 1).toString() + '/' + year;
                    date = new Date(Date.UTC(year, month, day))
                        .toISOString()
                        .split('T')[0];
                    console.log('date:', date);
                }
            }

            // Check value (not for AVERAGE since this may not exist)
            if (
                (key !== AVERAGE_KEY &&
                    !isAttributeNumberValueWellDefined(value)) ||
                !date
            ) {
                return;
            }
            if (keysForEQVASPlot.includes(key)) {
                console.log('EQ VAS key:', key);
                addElementToDataset(eqVASDataset, key, [date, Number(value)]);
            } else if (keysForDimensionPlot.includes(key)) {
                console.log('Dimension key:', key);
                // push values of dimensions to array of which the average may be calculated
                if (AVERAGE_KEY !== undefined) {
                    if (key !== AVERAGE_KEY) {
                        valuesForAverageCalculation.push(Number(value));
                    }
                    // calculate average
                    else {
                        // try to compute average dynamically if all values for dimensions are given
                        console.log(
                            'valuesForAverageCalculation:',
                            valuesForAverageCalculation
                        );
                        //if (valuesForAverageCalculation.length === 5) {
                        value = calculateAverage(
                            valuesForAverageCalculation
                        )?.toString();
                        //    valuesForAverageCalculation = [];
                        //} else {
                        //    return;
                        //}
                    }

                    addElementToDataset(dimensionDataset, key, [
                        date,
                        Number(value),
                    ]);
                }
            } else {
                return;
            }
        });
    });

    // get latest EQ and VAS score
    const keysOfEqVASDataset = Object.keys(eqVASDataset);
    //let greatestCommonScoreIndex = Infinity;

    for (let key of keysOfEqVASDataset) {
        // if (eqVASDataset[key].length - 1 < greatestCommonScoreIndex) {
        //     greatestCommonScoreIndex = eqVASDataset[key].length - 1;
        // }
        // push last defined date to latestScoreDates
        for (let i = eqVASDataset[key].length - 1; i >= 0; i--) {
            if (
                eqVASDataset[key][i].y !== undefined &&
                eqVASDataset[key][i].y !== null
            ) {
                latestScoreDates.push(eqVASDataset[key][i].x);
                latestScoreDatesKeys.push(key);
                latestScores.push([key, eqVASDataset[key][i].y]);
                break;
            }
        }
    }
    //}
    //if (greatestCommonScoreIndex < Infinity) {
    // for (let i = greatestCommonScoreIndex; i >= 0; i--) {
    //     let oneKeyNotDefined = false;
    //     for (let key of keysOfEqVASDataset) {
    //         if (eqVASDataset[key][i].y === undefined || eqVASDataset[key][i].y === null) {
    //             oneKeyNotDefined = true;
    //         }
    //     }
    //     if (!oneKeyNotDefined) {
    //         // const allEntriesEqual = keysOfEqVASDataset.length > 0 && keysOfEqVASDataset.every(key => eqVASDataset[key][i].x === eqVASDataset[keysOfEqVASDataset[0]][i].x);
    //         //if (allEntriesEqual) {
    //             for (let key of keysOfEqVASDataset) {
    //                 latestScores.push([key, eqVASDataset[key][i].y]);
    //                 latestScoreDates.push(eqVASDataset[key][i].x);
    //             }
    //             //latestScoresDate = eqVASDataset[keysOfEqVASDataset[0]][i].x.toString();
    //             break;
    //         //}

    //     }
    // }

    if (latestScoreDates.length > 0 && latestScores.length > 0) {
        const commonDate = latestScoreDates.every(
            date => date === latestScoreDates[0]
        );
        if (commonDate) {
            latestScoresDate = convertISOToDDMMYYYY(latestScoreDates[0]);
            // add date of latest questionnaire to latestScores
            latestScores.push(['DATE', latestScoresDate]);
        } else {
            let mergedScoreArrays: string[] = [];
            for (
                let i = 0;
                i <
                Math.min(latestScoreDates.length, latestScoreDatesKeys.length);
                i++
            ) {
                mergedScoreArrays.push(
                    convertISOToDDMMYYYY(latestScoreDates[i]) +
                        ' (' +
                        transformString(latestScoreDatesKeys[i]) +
                        ')'
                );
            }
            latestScores.push(['DATES', mergedScoreArrays.join(', ')]);
        }

        // Transform latestScores to DataSet
        latestScores.forEach((score: [string, number]) => {
            addElementToDataset(currentScoreDataset, score[0], [
                score[0],
                score[1],
            ]);
        });
    }

    //}

    console.log('dimensionDataset:', dimensionDataset);
    console.log('eqVasDataset in processData:', eqVASDataset);
    console.log('currentScoreDataset:', currentScoreDataset);

    return [eqVASDataset, dimensionDataset, currentScoreDataset];
};

function StringWithLineBreaks({ text }: { text: string }) {
    const lines = splitString(text, ',');

    return (
        <React.Fragment>
            {lines.map((line, index) => (
                <span key={index}>
                    {line}
                    {index < lines.length - 1 && ','}
                    {index < lines.length - 1 && <br />}
                </span>
            ))}
        </React.Fragment>
    );
}

const Proms = ({
    patientViewPageStore,
    sampleManager,
    dataStore,
}: PROMsProps) => {
    const data = patientViewPageStore.clinicalEvents.result;
    console.log('data:');
    console.log(data);

    // process data before displaying it

    // console.log('scoreKeys:', Object.keys(processedDataSets[2]));
    const processedDataSets = useProcessedData(data);
    const scoreKeys = Object.keys(processedDataSets[0]);
    const dimensionKeys = Object.keys(processedDataSets[1]);
    const currentScoreKeys = Object.keys(processedDataSets[2]); // assert length === 3

    // sort keys
    const promKeysTransformed = PROM_KEYS.map((key: string) => {
        return key;
    });
    const sortedScoreKeys = sortArrayBasedOnComparator(
        scoreKeys,
        promKeysTransformed
    );
    console.log('sortedScoreKeys:', sortedScoreKeys);
    const sortedDimensionKeys = sortArrayBasedOnComparator(
        dimensionKeys,
        promKeysTransformed
    );
    console.log('sortedDimensionKeys:', sortedDimensionKeys);
    const sortedCurrentScoreKeys = sortArrayBasedOnComparator(
        currentScoreKeys,
        promKeysTransformed
    );
    console.log('sortedScoreKeys:', sortedCurrentScoreKeys);

    console.log('processedDataSets:');
    console.log(processedDataSets[0]);
    console.log(processedDataSets[1]);
    console.log(processedDataSets[2]);

    // Sort keys

    const eqVASDataset: DataSet = {};
    for (let i = 0; i < sortedScoreKeys.length; i++) {
        eqVASDataset[sortedScoreKeys[i]] =
            processedDataSets[0][sortedScoreKeys[i]];
    }

    const dimensionDataset: DataSet = {};
    for (let i = 0; i < sortedDimensionKeys.length; i++) {
        dimensionDataset[sortedDimensionKeys[i]] =
            processedDataSets[1][sortedDimensionKeys[i]];
    }

    const currentScoreDataset: DataSet = processedDataSets[2];

    console.log('Transformed and sorted data sets:');
    console.log(eqVASDataset);
    console.log(dimensionDataset);
    console.log(currentScoreDataset);

    const currentScoreDates = currentScoreDataset[
        sortedCurrentScoreKeys[sortedCurrentScoreKeys.length - 1]
    ]
        ? currentScoreDataset[
              sortedCurrentScoreKeys[sortedCurrentScoreKeys.length - 1]
          ][0].y
        : null;
    const currentScoreDatesString = currentScoreDates
        ? currentScoreDates.toString()
        : '';
    // const currentScoreDatesString = currentScoreDates
    //     ? convertISOToDDMMYYYY(currentScoreDates.toString())
    //     : '';

    return (
        <div className="proms">
            <h2>Patient-Reported Outcome Measures</h2>

            <div className="questionnaire-title">
                Questionnaire: {questionnaireName} (
                <a href={eq5d5lInfo} target="_blank" rel="opener">
                    Info
                </a>
                )
            </div>
            {/* <div className="container-fluid"> */}

            <Grid fluid>
                <Row className="prom-grid">
                    <Col md={12} lg={3}>
                        <div className="proms-container-small">
                            <div className="chart-heading-container-left">
                                <div className="chart-heading">
                                    {chartTitles[0]}
                                </div>
                                <InfoTooltip
                                    tooltip={currentEqVasDescription}
                                    href="#"
                                    id="currentEqVas"
                                    placement="right"
                                >
                                    <div className="icon-wrapper">
                                        <FontAwesome name="info-circle" />
                                    </div>
                                </InfoTooltip>
                            </div>
                            {sortedCurrentScoreKeys &&
                                sortedCurrentScoreKeys.length > 1 && (
                                    <p>
                                        {transformString(
                                            currentScoreDataset[
                                                sortedCurrentScoreKeys[
                                                    sortedCurrentScoreKeys.length -
                                                        1
                                                ]
                                            ][0].x
                                        )}
                                        {': '}
                                        <StringWithLineBreaks
                                            text={currentScoreDatesString}
                                        />
                                    </p>
                                )}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-evenly',
                                }}
                            >
                                {sortedCurrentScoreKeys &&
                                    sortedCurrentScoreKeys.length > 1 && (
                                        <React.Fragment>
                                            <PieChart
                                                data={
                                                    currentScoreDataset[
                                                        sortedCurrentScoreKeys[0]
                                                    ][0]
                                                }
                                                dataRange={
                                                    sortedCurrentScoreKeys.includes(
                                                        INDEX_KEY
                                                    )
                                                        ? EQ_RANGE
                                                        : VAS_RANGE
                                                }
                                                thresholds={
                                                    sortedCurrentScoreKeys.includes(
                                                        INDEX_KEY
                                                    )
                                                        ? thresholdsEQ
                                                        : thresholdsVAS
                                                }
                                            />
                                            {sortedCurrentScoreKeys.length ===
                                                2 &&
                                                (sortedCurrentScoreKeys.includes(
                                                    INDEX_KEY
                                                ) ? (
                                                    <div>
                                                        No VAS score <br />{' '}
                                                        available
                                                    </div>
                                                ) : (
                                                    <div>
                                                        No EQ index <br />{' '}
                                                        available
                                                    </div>
                                                ))}
                                        </React.Fragment>
                                    )}
                                {sortedCurrentScoreKeys &&
                                    sortedCurrentScoreKeys.length > 2 && (
                                        <PieChart
                                            data={
                                                currentScoreDataset[
                                                    sortedCurrentScoreKeys[1]
                                                ][0]
                                            }
                                            dataRange={VAS_RANGE}
                                        />
                                    )}
                            </div>
                            {!sortedCurrentScoreKeys ||
                                (sortedCurrentScoreKeys.length === 0 && (
                                    <p>
                                        Neither EQ indices nor VAS scores are
                                        available for this patient.
                                    </p>
                                ))}
                        </div>
                    </Col>

                    <Col md={12} lg={9}>
                        <div className="proms-container-large">
                            <div className="chart-heading-container-center">
                                <div className="chart-heading__capitalLettersCentered flex-width-container">
                                    {chartTitles[1]}
                                </div>
                                <InfoTooltip
                                    tooltip={scoresDescription}
                                    href="#"
                                    id="scores"
                                    placement="left"
                                >
                                    <div className="icon-wrapper-no-bot-margin">
                                        <FontAwesome name="info-circle" />
                                    </div>
                                </InfoTooltip>
                            </div>

                            {/* EQ vs VAS */}
                            {eqVASDataset &&
                                Object.keys(eqVASDataset).length > 0 && (
                                    <LineScatterPlot
                                        data={eqVASDataset}
                                        // width={800}
                                        // height={400}
                                        title="Scores"
                                        xLabel="Date"
                                        yLabel="EQ Index"
                                        yTickFormat={EQ_VALUES_ALPHA}
                                        yRange={EQ_RANGE}
                                        secondYLabel="EQ VAS"
                                        secondYTickFormat={VAS_VALUES_ALPHA}
                                        secondYRange={VAS_RANGE}
                                        standardRange={standardRange}
                                        showTooltip={true}
                                    />
                                )}
                            {!eqVASDataset ||
                                (Object.keys(eqVASDataset).length === 0 && (
                                    <p>
                                        Neither EQ indices nor VAS scores are
                                        available for this patient.
                                    </p>
                                ))}
                        </div>
                    </Col>
                </Row>

                <Row className="prom-grid">
                    <Col md={12} lg={9} lgOffset={3}>
                        <div className="proms-container-large">
                            <div className="chart-heading-container-center">
                                <div className="chart-heading__capitalLettersCentered flex-width-container">
                                    {chartTitles[2]}
                                </div>
                                <InfoTooltip
                                    tooltip={healthDetailsDescription}
                                    href="#"
                                    id="healthDetails"
                                    placement="left"
                                >
                                    <div className="icon-wrapper-no-bot-margin">
                                        <FontAwesome name="info-circle" />
                                    </div>
                                </InfoTooltip>
                            </div>
                            {/* 5 Dimensions */}
                            {dimensionDataset &&
                                Object.keys(dimensionDataset).length > 0 && (
                                    <LineScatterPlot
                                        data={dimensionDataset}
                                        // width={800}
                                        // height={400}
                                        title="Health State Detail"
                                        xLabel="Date"
                                        yLabel={'Problems'}
                                        yTickFormat={VALUES_ALPHA}
                                        yRange={VALUES_RANGE}
                                        showTooltip={true}
                                    />
                                )}
                            {!dimensionDataset ||
                                (Object.keys(dimensionDataset).length === 0 && (
                                    <p>
                                        No health state data is applicable for
                                        this patient.
                                    </p>
                                ))}
                        </div>
                    </Col>
                </Row>
                {sampleManager && dataStore && (
                    <Row className="prom-grid">
                        <Col md={12} lg={9} lgOffset={3}>
                            <div className="proms-container-large">
                                <Timeline
                                    patientViewPageStore={patientViewPageStore}
                                    sampleManager={sampleManager}
                                    dataStore={dataStore}
                                />
                            </div>
                        </Col>
                    </Row>
                )}
            </Grid>
            {/* </div> */}
            <div>
                {/* <h1>Your Data</h1>
      <ul>
        {data.map((item) => (
          <li key={item.clinicalAttributeId}>{item.value}</li>
        ))}
      </ul> */}
            </div>
        </div>
    );
};

export default Proms;
