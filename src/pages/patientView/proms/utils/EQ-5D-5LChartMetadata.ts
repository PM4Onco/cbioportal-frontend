/* meta data for EQ-5D-5L questionnaire as constants */
// 5 Dimensions
export const VALUES_ALPHA = ['Extreme', 'Severe', 'Moderate', 'Slight', 'No'];
export const VALUES_RANGE: [number, number] = [1, 5];
// EQ and VAS
export const EQ_RANGE: [number, number] = [0, 1];
export const EQ_VALUES_ALPHA = [
    '(worst health) 0',
    '0.25',
    '0.5',
    '0.75',
    '(best health) 1',
];
export const VAS_RANGE: [number, number] = [0, 100];
export const VAS_VALUES_ALPHA = [
    '0 (worst health)',
    '25',
    '50',
    '75',
    '100 (best health)',
];

export const questionnaireName = 'EQ-5D-5L';
export const chartTitles = [
    'Current EQ-Score',
    'Scores',
    'Health State Detail',
];
export const eq5d5lInfo =
    'https://euroqol.org/information-and-support/euroqol-instruments/eq-5d-5l/';
export const scoresDescription = 'Lorem ipsum Standard range toggle legend';
export const healthDetailsDescription = 'Lorem ipsum dimensions toogle legend';
export const currentEqVasDescription = 'Lorem ipsum eq and vas';
