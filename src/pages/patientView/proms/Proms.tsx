import React, { useState, useEffect } from 'react';
import Timeline from './components/patientTimeline';
// import TimelineWrapper from 'pages/patientView/timeline/TimelineWrapper';
import LineScatterPlot from './components/LineScatterPlotProms';
import {
    DataSet,
    Range,
    addElementToDataset,
    transformString,
} from './utils/PromChartHelperFunctions';
import {
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
const standardRange: Range = { name: 'Standard Range', range: [0.45, 0.7] };
const thresholdsEQ = [0.2, 0.4, 0.6, 0.8]; // ggf auch für VAS

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
    /*  return (
        <OverlayTrigger
            overlay={<Tooltip id={id}>{tooltip}</Tooltip>}
            delayShow={300}
            delayHide={150}
            placement={placement}
            >
            {children}
        </OverlayTrigger>
   
  ); */
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

// meta data eq5d5l

/* Sample data sets */
// const sampleData5Dimensions: DataSet = {
//     Mobility: [
//         { x: formatDate(new Date(2025, 0, 1)), y: 1 },
//         { x: formatDate(new Date(2025, 1, 1)), y: 2 },
//         { x: formatDate(new Date(2025, 2, 1)), y: 1 },
//         { x: formatDate(new Date(2025, 3, 1)), y: 4 },
//     ],
//     'Self-Care': [
//         { x: formatDate(new Date(2025, 0, 1)), y: 3 },
//         { x: formatDate(new Date(2025, 1, 1)), y: 5 },
//         { x: formatDate(new Date(2025, 2, 1)), y: 4 },
//         { x: formatDate(new Date(2025, 3, 1)), y: 2 },
//     ],
//     'Usual activities': [
//         { x: formatDate(new Date(2025, 0, 1)), y: 1 },
//         { x: formatDate(new Date(2025, 1, 1)), y: 1 },
//         { x: formatDate(new Date(2025, 2, 1)), y: 2 },
//         { x: formatDate(new Date(2025, 3, 1)), y: 2 },
//     ],
//     'Pain/Discomfort': [
//         { x: formatDate(new Date(2025, 0, 1)), y: 5 },
//         { x: formatDate(new Date(2025, 1, 1)), y: 3 },
//         { x: formatDate(new Date(2025, 2, 1)), y: 1 },
//         { x: formatDate(new Date(2025, 3, 1)), y: 3 },
//     ],
//     'Anxiety/Dipression': [
//         { x: formatDate(new Date(2025, 0, 1)), y: 2 },
//         { x: formatDate(new Date(2025, 1, 1)), y: 2 },
//         { x: formatDate(new Date(2025, 2, 1)), y: 2 },
//         { x: formatDate(new Date(2025, 3, 1)), y: 1 },
//     ],
//     Average: [
//         { x: formatDate(new Date(2025, 0, 1)), y: 2.3 },
//         { x: formatDate(new Date(2025, 1, 1)), y: 3.5 },
//         { x: formatDate(new Date(2025, 2, 1)), y: 1.7 },
//         { x: formatDate(new Date(2025, 3, 1)), y: 2.8 },
//     ],
// };

// const sampleDataEqVas: DataSet = {
//     EQ: [
//         { x: formatDate(new Date(2025, 0, 1)), y: 0.6 },
//         { x: formatDate(new Date(2025, 1, 9)), y: 0.55 },
//         { x: formatDate(new Date(2025, 2, 1)), y: -0.33 },
//         { x: formatDate(new Date(2025, 12, 7)), y: 0.2 },
//         // { x: formatDate(new Date(2026, 0, 1)), y: 0.6 },
//         // { x: formatDate(new Date(2026, 1, 9)), y: 0.55 },
//         // { x: formatDate(new Date(2026, 2, 1)), y: -0.33 },
//         // { x: formatDate(new Date(2026, 12, 7)), y: 0.2 },
//     ],
//     VAS: [
//         { x: formatDate(new Date(2025, 0, 1)), y: 30 },
//         { x: formatDate(new Date(2025, 1, 9)), y: 45 },
//         { x: formatDate(new Date(2025, 2, 1)), y: 73 },
//         { x: formatDate(new Date(2025, 12, 7)), y: 55 },
//         // { x: formatDate(new Date(2026, 0, 1)), y: 30 },
//         // { x: formatDate(new Date(2026, 1, 9)), y: 45 },
//         // { x: formatDate(new Date(2026, 2, 1)), y: 73 },
//         // { x: formatDate(new Date(2026, 12, 7)), y: 55 },
//     ],
// };

// TODO Funktion zum Herauslesen des aktuellen EQ- und VAS-Wertes für PieChart
// Bereich current EQ scores als eigene Komponente -> oberes dorthin auslagern?

/* pre-process given data */
// hook for processing data
const useProcesseData = (data: ClinicalEvent[]): DataSet[] => {
    const promData = data.filter(
        (event: ClinicalEvent) => event.eventType === questionnaireName
    );
    console.log('promData:');
    console.log(promData); // ok
    // assert: alle gleichen uniquePatientKey
    let datasetKeys: string[] = [];
    let dimensionDataset: DataSet = {};
    let eqVasDataset: DataSet = {};
    let scoreDataset: DataSet = {};
    let latestQuestionnaireRelativeDate = 0;
    let latestQuestionnaireAbsoluteDate: string = '';
    let latestScores: [string, number | string][] = [];

    promData[0].attributes.forEach((item: any) => {
        datasetKeys.push(item.key);
    });
    console.log('datasetKeys:', datasetKeys); //ok

    // delete keys which are not needed
    const keysNotToBeDeleted = [
        'MOBILITY',
        'SELF-CARE',
        'USUAL_ACTIVITY',
        'PAIN/DISCOMFORT',
        'ANXIETY/DEPRESSION',
        'AVERAGE',
        'INDEX',
        'VAS',
    ];
    const datasetKeysForPlots = datasetKeys.filter((key: string) =>
        keysNotToBeDeleted.includes(key)
    );
    console.log('datasetKeysForPlots:', datasetKeysForPlots);

    const keysDimensions = datasetKeysForPlots.slice(
        0,
        datasetKeysForPlots.length - 2
    );
    console.log('keysDimensions:', keysDimensions);

    const keysEQVAS = datasetKeysForPlots.slice(
        datasetKeysForPlots.length - 2,
        datasetKeysForPlots.length
    );
    console.log('keysEQVAS:', keysEQVAS);

    datasetKeysForPlots.forEach((key: string) => {
        promData.forEach((event: ClinicalEvent) => {
            const value = event.attributes.find((item: any) => item.key === key)
                ?.value;
            //console.log("value: ", value)
            const date = event.attributes.find(
                (item: any) => item.key === 'DATE'
            )?.value;
            //console.log("date: ", date)
            if (
                value === undefined ||
                date === undefined ||
                isNaN(Number(value))
            ) {
                return;
            }
            if (keysEQVAS.includes(key)) {
                console.log('EQ VAS key:', key);
                addElementToDataset(eqVasDataset, transformString(key), [
                    date,
                    Number(value),
                ]);
                if (
                    event.endNumberOfDaysSinceDiagnosis >=
                    latestQuestionnaireRelativeDate
                ) {
                    latestQuestionnaireRelativeDate =
                        event.endNumberOfDaysSinceDiagnosis;
                    latestScores = latestScores.filter(
                        (score: [string, number]) => score[0] !== key
                    );
                    latestScores.push([key, Number(value)]);
                    latestQuestionnaireAbsoluteDate = date;
                }
            } else if (keysDimensions.includes(key)) {
                console.log('Dimension key:', key);
                addElementToDataset(dimensionDataset, transformString(key), [
                    date,
                    Number(value),
                ]);
            } else {
                return;
            }
        });
    });

    // add date of latest questionnaire to latestScores
    latestScores.push(['DATE', latestQuestionnaireAbsoluteDate]);

    // Transform latestScores to DataSet
    latestScores.forEach((score: [string, number]) => {
        addElementToDataset(scoreDataset, transformString(score[0]), [
            transformString(score[0]),
            score[1],
        ]);
    });

    console.log('dimensionDataset:', dimensionDataset);
    console.log('eqVasDataset:', eqVasDataset);
    console.log('scoreDataset:', scoreDataset);

    return [eqVasDataset, dimensionDataset, scoreDataset];
};

const Proms = ({
    patientViewPageStore,
    sampleManager,
    dataStore,
}: PROMsProps) => {
    const data = patientViewPageStore.clinicalEvents.result;
    console.log('data:');
    console.log(data);

    // process data before displaying it
    const processedDataSets = useProcesseData(data);

    const scoreKeys = Object.keys(processedDataSets[2]);
    console.log('scoreKeys:', scoreKeys);

    // divide data into dimensions and eq/vas

    // mock
    //     const mockData = {
    //         "uniquePatientKey": "VUtFdl8xOnByYWRfZXZhbHVhdGlvbl8yMDI0",
    //         "patientId": "UKEv_1",
    //         "studyId": "prad_evaluation_2024",
    //         "clinicalAttribute": {
    //             "displayName": "TEST",
    //             "description": "Genomic Instability Score",
    //             "datatype": "STRING",
    //             "patientAttribute": true,
    //             "priority": "1",
    //             "clinicalAttributeId": "TEST",
    //             "studyId": "prad_evaluation_2024"
    //         },
    //         "patientAttribute": true,
    //         "clinicalAttributeId": "TEST",
    //         "value": "51"
    //     }

    //     const [data, setData] = useState<any[]>([]);
    //     const [loading, setLoading] = useState<boolean>(true);
    //     const [error, setError] = useState<string | null>(null);

    //   useEffect(() => {
    //     const fetchData = async () => {
    //       try {
    //         const response = await fetch('https://cbioportal.imi.med.fau.de/api/studies/prad_evaluation_2024/patients/UKEv_1/clinical-data?projection=DETAILED');
    //         if (!response.ok) {
    //           throw new Error('Network response was not ok');
    //         }
    //         const result = await response.json();

    //         // Manipulate the data as needed
    //         const manipulatedData = result.map((item: any) => {
    //     //       // Add or modify properties as needed
    //     //     //   if (item.id === someCondition) {
    //     //     //     item.newProperty = 'New Value';
    //     //     //   }
    //         return item;
    //        });
    //        //const manipulatedData = result;

    //         // Add new dummy data
    //         manipulatedData.push(mockData);

    //         setData(manipulatedData);
    //       } catch (error) {
    //         setError(error.message);
    //       } finally {
    //         setLoading(false);
    //       }
    //     };

    //     fetchData();
    //   }, []); // Empty dependency array means this effect runs once on mount

    //   if (loading) {
    //     return <div>Loading...</div>;
    //   }

    //   if (error) {
    //     return <div>Error: {error}</div>;
    //   }

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
                            <p>
                                Date:{' '}
                                {
                                    Object.values(processedDataSets)[2][
                                        scoreKeys[2]
                                    ][0].y
                                }
                            </p>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-evenly',
                                }}
                            >
                                <PieChart
                                    data={
                                        Object.values(processedDataSets)[2][
                                            scoreKeys[0]
                                        ][0]
                                    }
                                    dataRange={EQ_RANGE}
                                    thresholds={thresholdsEQ}
                                />
                                <PieChart
                                    data={
                                        Object.values(processedDataSets)[2][
                                            scoreKeys[1]
                                        ][0]
                                    }
                                    dataRange={VAS_RANGE}
                                />
                            </div>
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
                            <LineScatterPlot
                                data={processedDataSets[0]}
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
                            <LineScatterPlot
                                data={processedDataSets[1]}
                                // width={800}
                                // height={400}
                                title="Health State Detail"
                                xLabel="Date"
                                yLabel={'Problems'}
                                yTickFormat={VALUES_ALPHA}
                                yRange={VALUES_RANGE}
                                showTooltip={true}
                            />
                        </div>
                    </Col>
                </Row>
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
