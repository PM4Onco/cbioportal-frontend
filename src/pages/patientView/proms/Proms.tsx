import React from 'react';
import Timeline from './components/patientTimeline';
import LineScatterPlot, {
    DataSet,
    Range,
} from './components/LineScatterPlotProms';
import PieChart, { DataPair } from './components/PieChartProms';

import SampleManager from 'pages/patientView/SampleManager';
import { PatientViewPageInner } from 'pages/patientView/PatientViewPage';
import PatientViewCnaDataStore from 'pages/patientView/copyNumberAlterations/PatientViewCnaDataStore'; // Import type if needed

import { PatientViewPageStore } from 'pages/patientView/clinicalInformation/PatientViewPageStore';
import PatientViewMutationsDataStore from '../mutation/PatientViewMutationsDataStore';

interface PROMsProps {
    patientViewPageStore: PatientViewPageStore;
    sampleManager: any;
    dataStore: PatientViewMutationsDataStore;
}

/* function to convert date to right format */
function formatDate(date: Date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = date
        .getFullYear()
        .toString()
        .slice(-2); // Get the last two digits of the year

    return `${day}/${month}/${year}`;
}

// meta data eq5d5l
// 5 Dimensions
const VALUES_ALPHA = ['Extreme', 'Severe', 'Moderate', 'Slight', 'No'];
const VALUES_NUMERIC = [1, 2, 3, 4, 5];
const VALUES_RANGE: [number, number] = [1, 5];
// EQ and VAS
const EQ_VALUES_NUMERIC = [0, 0.25, 0.5, 0.75, 1];
const EQ_RANGE: [number, number] = [0, 1];
const EQ_VALUES_ALPHA = [
    '(worst health) 0',
    '0.25',
    '0.5',
    '0.75',
    '(best health) 1',
];
const VAS_VALUES_NUMERIC = [0, 25, 50, 75, 100];
const VAS_RANGE: [number, number] = [0, 100];
const VAS_VALUES_ALPHA = [
    '0 (worst health)',
    '25',
    '50',
    '75',
    '100 (best health)',
];

/* Sample data sets */
const sampleData5Dimensions: DataSet = {
    Mobility: [
        { x: formatDate(new Date(2023, 0, 1)), y: 1 },
        { x: formatDate(new Date(2023, 1, 1)), y: 2 },
        { x: formatDate(new Date(2023, 2, 1)), y: 1 },
        { x: formatDate(new Date(2023, 3, 1)), y: 4 },
    ],
    'Self-Care': [
        { x: formatDate(new Date(2023, 0, 1)), y: 3 },
        { x: formatDate(new Date(2023, 1, 1)), y: 5 },
        { x: formatDate(new Date(2023, 2, 1)), y: 4 },
        { x: formatDate(new Date(2023, 3, 1)), y: 2 },
    ],
    'Usual activities': [
        { x: formatDate(new Date(2023, 0, 1)), y: 1 },
        { x: formatDate(new Date(2023, 1, 1)), y: 1 },
        { x: formatDate(new Date(2023, 2, 1)), y: 2 },
        { x: formatDate(new Date(2023, 3, 1)), y: 2 },
    ],
    'Pain/Discomfort': [
        { x: formatDate(new Date(2023, 0, 1)), y: 5 },
        { x: formatDate(new Date(2023, 1, 1)), y: 3 },
        { x: formatDate(new Date(2023, 2, 1)), y: 1 },
        { x: formatDate(new Date(2023, 3, 1)), y: 3 },
    ],
    'Anxiety/Dipression': [
        { x: formatDate(new Date(2023, 0, 1)), y: 2 },
        { x: formatDate(new Date(2023, 1, 1)), y: 2 },
        { x: formatDate(new Date(2023, 2, 1)), y: 2 },
        { x: formatDate(new Date(2023, 3, 1)), y: 1 },
    ],
    Average: [
        { x: formatDate(new Date(2023, 0, 1)), y: 2.3 },
        { x: formatDate(new Date(2023, 1, 1)), y: 3.5 },
        { x: formatDate(new Date(2023, 2, 1)), y: 1.7 },
        { x: formatDate(new Date(2023, 3, 1)), y: 2.8 },
    ],
};

const sampleDataEqVas: DataSet = {
    EQ: [
        { x: formatDate(new Date(2023, 0, 1)), y: 0.6 },
        { x: formatDate(new Date(2023, 1, 1)), y: 0.55 },
        { x: formatDate(new Date(2023, 2, 1)), y: 0.33 },
        { x: formatDate(new Date(2023, 3, 1)), y: 1.0 },
    ],
    VAS: [
        { x: formatDate(new Date(2023, 0, 1)), y: 30 },
        { x: formatDate(new Date(2023, 1, 1)), y: 45 },
        { x: formatDate(new Date(2023, 2, 1)), y: 73 },
        { x: formatDate(new Date(2023, 3, 1)), y: 55 },
    ],
};

const standardRange: Range = { name: 'Standard Range', range: [0.45, 0.7] };

const pieData: DataPair = { x: 'Index', y: 0.4 };
const pieData2: DataPair = { x: 'VAS', y: 80 };

// TODO Funktion zum Herauslesen des aktuellen EQ- und VAS-Wertes für PieChart
// Bereich current EQ scores als eigene Komponente -> oberes dorthin auslagern?

/* pre-process given data */
// hook for processing data
const useProcesseData = (datasets: DataSet) => {
    // logic here

    return datasets;
};

const Proms = ({
    patientViewPageStore,
    sampleManager,
    dataStore,
}: PROMsProps) => {
    // process data before displaying it
    const processedData = useProcesseData(sampleData5Dimensions);

    return (
        <div>
            <h2>Patient-Reported Outcome Measures</h2>

            {/* Container einbauen */}

            <div
                className="container"
                style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                }}
            >
                {/* Pie Chart */}
                <PieChart data={pieData} dataRange={EQ_RANGE} />
                <PieChart data={pieData2} dataRange={VAS_RANGE} />
            </div>

            {/* EQ vs VAS */}
            <LineScatterPlot
                data={sampleDataEqVas}
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
            />

            {/* 5 Dimensions */}
            <LineScatterPlot
                data={processedData}
                // width={800}
                // height={400}
                title="Health State Detail"
                xLabel="Date"
                yLabel={'Problems'}
                yTickFormat={VALUES_ALPHA}
                yRange={VALUES_RANGE}
            />

            <Timeline
                patientViewPageStore={patientViewPageStore}
                sampleManager={sampleManager}
                dataStore={dataStore}
            />
        </div>
    );
};

export default Proms;
