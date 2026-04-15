import {
    Mutation,
    Gene,
    NumericGeneMolecularData,
    StructuralVariant,
} from 'cbioportal-ts-api-client';

// Helper function to get CNV type
export declare type NumericGeneMolecularDataWithStatus = NumericGeneMolecularData & {
    copyNumberStatus: 'AMP' | 'GAIN' | 'HETLOSS' | 'HOMDEL' | 'NEUTRAL';
};

// Search interface for mutations and CNA
export interface MutationsPerPatient {
    mutations: Mutation[];
    cnaExt: NumericGeneMolecularDataWithStatus[];
    sv: StructuralVariant[];
}

export interface Alteration {
    gene: Gene;
    patientId: string;
    sampleId: string;

    alterationType:
        | 'Mutation'
        | 'Copy Number Alteration'
        | 'Structural Variant';

    // mutation fields
    proteinChange?: string;
    mutationType?: string;

    // CNA
    cna?: number;

    // fusion / SV
    fusion?: boolean;
    partnerGene?: Gene;
}

export interface AgeFilter {
    min_age?: number;
    max_age?: number;
    trialName?: string;
    trialURL?: string;
}

export interface OQLFilter {
    gene: string;
    alterationType:
        | 'Mutation'
        | 'Copy Number Alteration'
        | 'Structural Variant';
    criterionType: 'incl' | 'excl';
    trialName?: string;
    trialURL?: string;

    proteinChange?: string;
    mutationType?: string;

    cnaType?: string;

    fusionPartner?: string;
}

export interface FinalResultRow {
    studyId: string;
    patientId: string;
    age: string;
    ageNotes?: string;
    sampleId: string;
    trial: string;
    trialURL: string;
    gene: string;
    alterationType: Alteration['alterationType'];
    mutationType: string;
    alteration: string;
}
