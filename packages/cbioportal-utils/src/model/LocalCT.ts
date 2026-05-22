// This file is responsible for fetching the local clinical trial data, either from a static JSON file during development or from a server endpoint in production.
declare module '*.json';
import localCTData from './localCT.dev.json'; // dev static JSON

export type clinicalTrial = {
    trialName: string;
    trialUrl?: string;
    inclusionCriteria: string[];
    exclusionCriteria?: string[];
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
        const data = await res.json();
        return data.studies as clinicalTrial[];
    }
};
