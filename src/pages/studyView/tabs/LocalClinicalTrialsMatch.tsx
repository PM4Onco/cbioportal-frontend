import * as React from 'react';
import { observer } from 'mobx-react';
import { StudyViewPageStore } from '../StudyViewPageStore';
import {
    Mutation,
    Sample,
    MolecularProfile,
    CBioPortalAPI,
    NumericGeneMolecularData,
    StructuralVariant,
} from 'cbioportal-ts-api-client';
import { useState, useEffect } from 'react';
import {
    getMutationData,
    getCnaData,
    getSvData,
} from 'pages/studyView/StudyViewComparisonUtils';
import CTLazyTable from 'pages/studyView/table/LocalCTTable';
import { getLocalCT, clinicalTrial } from 'cbioportal-utils/src/model/LocalCT';
import { parseOQLQuery } from 'shared/lib/oql/oqlfilter';
import { parse } from 'shared/lib/oql/oql-parser';

// Object that combines all alterations associated with a study and patient/sample information
export declare type CTFilter = {
    patientId: string[];
    sampleId: string[];
    matchedTrialNames: string[]; // e.g., "Soratram", ""
    matchtedTrialURLs: string[];
    hugoGeneSymbols: string[];
    alterationTypes: string[]; // e.g., 'MUTATION', 'COPY_NUMBER_ALTERATION', 'STRUCTURAL_VARIANT'
    alterations: string[]; // e.g. "V600E", "AMP", "FUSION"
    alterationDescriptions: string[]; // e.g., 'Missense_Mutation', 'Amplification', 'BCR-ABL1 Fusion'
};

// Helper function to get CNV type
export declare type NumericGeneMolecularDataWithStatus = NumericGeneMolecularData & {
    copyNumberStatus: 'AMP' | 'DEL' | 'NEUTRAL';
};

// Helper function to obrain StudyViewPageStore encoding metadata on the currently viewed study
interface Props {
    store: StudyViewPageStore;
}

// Search interface for mutations and CNA
interface MutationsPerPatient {
    mutations: Mutation[];
    cnaExt: NumericGeneMolecularDataWithStatus[];
    sv: StructuralVariant[];
    patientIds: Set<string>;
    sampleIds: Set<string>;
}

interface AlterationDatum {
    gene: string;
    sampleId: string;

    alterationType: 'mutation' | 'cna' | 'sv';

    // mutation fields
    proteinChange?: string;
    mutationType?: string;

    // CNA
    cna?: number;

    // fusion / SV
    fusion?: boolean;
    partnerGene?: string;

    // raw data reference (optional)
    raw?: any;
}

// Get client for cBioPortal API calls
const client = new CBioPortalAPI();
/*
export function getFiltersFromTrials(trials: clinicalTrial[] | null) {
    // Parse trial inclusion/exclusion criteria into OQL-like tokens:
    // examples produced: "KRAS:MUT", "BRAF:V600E", "CCNE1:AMP"
    if (!trials) {
        return {
            hugoFilterMutation: [] as string[],
            hugoFilterCNA: [] as string[],
            hugoFilterSV: [] as string[],
        };
    }

    const mutationSet = new Set<string>();
    const cnaSet = new Set<string>();
    const svSet = new Set<string>();

    const normalize = (s: string) => s.trim().replace(/\s+/g, ' ');

    const parseCriterionString = (critStr: string) => {
        // split multiple criteria in one string (comma/semicolon separated)
        const tokens = critStr.split(/[,;]+/).map(t => normalize(t)).filter(Boolean);
        tokens.forEach(token => {
            // token examples: "KRAS:MUT", "BRAF:V600E", "CCNE1:AMP", "TP53:ANY", "GENE1:GENE2:FUSION"
            const parts = token.split(':').map(p => p.trim()).filter(Boolean);
            if (parts.length === 0) return;

            if (parts.length === 1) {
                // single gene — treat as any mutation
                mutationSet.add(`${parts[0]}:ANY`);
                return;
            }

            // If last part indicates CNA
            const last = parts[parts.length - 1].toUpperCase();
            const gene = parts[0];

            if (/(AMP|AMPLIFICATION|GAIN|CNV|COPY)/i.test(last) || last === 'AMP' || last === 'DEL') {
                cnaSet.add(`${gene}:${parts.slice(1).join(':')}`);
            } else if (/(FUSION|TRANSLOCATION|SV|REARRANGEMENT)/i.test(last) || parts.length >= 3) {
                // treat multi-part tokens or explicit fusion markers as structural variants
                svSet.add(`${parts.slice(0, 2).join(':')}:${parts.slice(2).join(':')}`);
            } else {
                // treat as mutation (including specific AA changes like V600E or generic MUT/ANY/WT)
                mutationSet.add(`${gene}:${parts.slice(1).join(':')}`);
            }
        });
    };

    trials.forEach(t => {
        const incl = (t.inclusionCriteria as string[]) || [];
        const excl = (t.exclusionCriteria as string[]) || [];
        incl.forEach(c => c && parseCriterionString(c));
        excl.forEach(c => c && parseCriterionString(c));
    });

    return {
        hugoFilterMutation: Array.from(mutationSet),
        hugoFilterCNA: Array.from(cnaSet),
        hugoFilterSV: Array.from(svSet),
    };
}
*/
export function useMutationsPerPatient(
    store: StudyViewPageStore,
    hugoFilter: string[]
): MutationsPerPatient | null {
    const [data, setData] = useState<MutationsPerPatient | null>(null);

    useEffect(() => {
        async function load() {
            if (
                store.samples.status !== 'complete' ||
                store.molecularProfiles.status !== 'complete'
            ) {
                return;
            }

            // Get all samples and molecular profiles for the study
            const sampleArray: Sample[] = store.samples.result;
            const profiles: MolecularProfile[] = store.molecularProfiles.result;

            // filter profiles for mutations, CNA, and SV
            const mutationProfiles = profiles.filter(
                p =>
                    p.molecularAlterationType === 'MUTATION_EXTENDED' ||
                    p.molecularAlterationType === 'MUTATION_UNCALLED'
            );

            const cnaProfiles = profiles.filter(
                p => p.molecularAlterationType === 'COPY_NUMBER_ALTERATION'
            );

            const svProfiles = profiles.filter(
                p => p.molecularAlterationType === 'STRUCTURAL_VARIANT'
            );

            // Get mutation, CNA, and SV data for the samples and selected genes with a fail-safe that sets data to empty arrays if there are no mutations/CNA/SV in the study, so that we can still render the page and just show no matches, instead of crashing the page

            // SNVs and indels
            let mutations: Mutation[] = [];

            try {
                mutations = await getMutationData(
                    sampleArray,
                    mutationProfiles,
                    hugoFilter
                );
            } catch (error) {
                console.error('No mutations in study:', error);
            }

            // CNAs with copy number status
            let cna: NumericGeneMolecularData[] = [];

            try {
                cna = await getCnaData(sampleArray, cnaProfiles, hugoFilter);
            } catch (error) {
                console.error('No CNA in study:', error);
            }

            let cnaExt: NumericGeneMolecularDataWithStatus[] = [];

            if (cna.length > 0) {
                cnaExt = cna.map(cnaEntry => {
                    let copyNumberStatus: 'AMP' | 'DEL' | 'NEUTRAL';

                    if (cnaEntry.value === 2) {
                        copyNumberStatus = 'AMP';
                    } else if (cnaEntry.value === -2) {
                        copyNumberStatus = 'DEL';
                    } else {
                        copyNumberStatus = 'NEUTRAL';
                    }

                    return {
                        ...cnaEntry,
                        copyNumberStatus,
                    };
                });
            }

            // SVs [== Fusions]
            let sv: StructuralVariant[] = [];

            try {
                sv = await getSvData(sampleArray, svProfiles, hugoFilter);
            } catch (error) {
                // console.error('No SV in study:', error);
            }

            const patientIds = new Set<string>();
            const sampleIds = new Set<string>();

            mutations.forEach(m => {
                patientIds.add(m.patientId);
                sampleIds.add(m.sampleId);
            });

            setData({
                mutations,
                cnaExt,
                sv,
                patientIds,
                sampleIds,
            });
        }

        load();
    }, [store.samples.status, store.molecularProfiles.status, hugoFilter]);

    return data;
}

const LocalClinicalTrialsMatch: React.FC<Props> = observer(({ store }) => {
    const [trials, setTrials] = useState<clinicalTrial[] | null>(null);

    useEffect(() => {
        const loadTrials = async () => {
            try {
                const data = await getLocalCT();
                setTrials(data);
            } catch (err) {
                console.error('Error loading clinical trials:', err);
            }
        };
        loadTrials();
    }, []);

    console.log('Trials:', trials);

    /*
    const { hugoFilterMutation, hugoFilterCNA, hugoFilterSV } = getFiltersFromTrials(trials) || {
        hugoFilterMutation: [],
        hugoFilterCNA: [],
        hugoFilterSV: [],
    };

    console.log("Mutations:", hugoFilterMutation)
    console.log("CNA:", hugoFilterCNA)
    console.log("Fusions:", hugoFilterSV)
*/
    // Make hugoFilters for OQL queries
    //

    const [hugoFilter] = useState<string[]>([
        'EPAS1',
        'FH',
        'SDHA',
        'SDHB',
        'SDHC',
        'SDHD',
        'SDHAF2',
        'EGLN1',
        'EGLN2',
        'MDH1',
        'MDH2',
        'ELOC',
    ]);

    const [OQLFilter] = useState<string[]>([
        'BRAF:G460R',
        'BRAF:G466A',
        'BRAF:G466R',
        'BRAF:G466V',
        'BRAF:G466E',
        'BRAF:N581S',
        'BRAF:N581T',
        'BRAF:N581I',
        'BRAF:N581D',
        'BRAF:D594E',
        'BRAF:D594G',
        'BRAF:D594N',
        'BRAF:D594H',
        'BRAF:A598T',
        'BRAF:G596R',
        'CCNE1:AMP',
    ]);

    const [OQL] = useState<string>('BRAF:V600E');

    const parsedOql = parseOQLQuery(OQL);
    console.log('OQL:', parsedOql);

    const mutationsPerPatient = useMutationsPerPatient(store, hugoFilter);

    if (!mutationsPerPatient) {
        return <div>Loading Clinical Trial Matches</div>;
    }

    const filteredMutations = mutationsPerPatient.mutations.filter(m =>
        hugoFilter.includes(m.gene?.hugoGeneSymbol || '')
    );

    const oqlfilteredMutations = mutationsPerPatient.mutations.filter(m => []);

    const filteredCna = mutationsPerPatient.cnaExt.filter(c =>
        hugoFilter.includes(c.gene?.hugoGeneSymbol || '')
    );

    const filteredSV = mutationsPerPatient.sv.filter(sv =>
        hugoFilter.includes(sv.site1HugoSymbol || sv.site2HugoSymbol || '')
    );

    return (
        <div style={{ padding: 12 }}>
            <CTLazyTable
                filteredMutations={filteredMutations}
                filteredCna={filteredCna}
                filteredSV={filteredSV}
            />
        </div>
    );
});

export default LocalClinicalTrialsMatch;
