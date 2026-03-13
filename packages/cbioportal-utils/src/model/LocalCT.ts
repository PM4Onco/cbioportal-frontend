declare module '*.json';
import localCTData from './localCT.dev.json'; // dev static JSON

export type clinicalTrial = {
    studyName: string;
    studyUrl: string;
    inclusionCriteria: string[];
    exclusionCriteria: string[];
    min_age?: number;
    max_age?: number;
};

export const getLocalCT = async (): Promise<clinicalTrial[]> => {
    const isDev =
        window.location.hostname === 'localhost' &&
        window.location.port === '3000';

    if (isDev) {
        return localCTData.studies as clinicalTrial[];
    } else {
        const res = await fetch('/localCT.json', { credentials: 'include' });
        if (!res.ok) {
            throw new Error(`Failed to load localCT.json: ${res.statusText}`);
        }
        return (await res.json()) as clinicalTrial[];
    }
};
