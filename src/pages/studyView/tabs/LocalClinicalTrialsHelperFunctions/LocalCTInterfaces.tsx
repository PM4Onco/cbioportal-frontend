// This file defines TypeScript interfaces for the local clinical trials feature, including data structures for mutations, copy number alterations, structural variants, and filters for age and OQL criteria. These interfaces are used to ensure type safety when working with local clinical trial data in the application.
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

// This interface defines the structure of an alteration, which can be a mutation, copy number alteration, or structural variant, and includes relevant information such as gene, patient ID, sample ID, alteration type, and specific details depending on the alteration type.
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

// This interface defines the structure of the age filter that can be applied to clinical trial matching, including minimum and maximum age, as well as optional trial information for context.
export interface AgeFilter {
    min_age?: number;
    max_age?: number;
    trialName?: string;
    trialURL?: string;
}

// This interface defines the structure of the OQL filter that will be used to match patient alterations against trial criteria, including gene, alteration type, criterion type (inclusion or exclusion), and optional trial information.
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

// This interface defines the structure of the final result row that will be displayed in the local clinical trials matching table, including patient and sample information, trial details, and molecular alteration data.
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
