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

export declare type LocalCTMatchData = {
    matchedTrialNames: string[]; // e.g., "Soratram", ""
    matchtedTrialURLs: string[]; // e.g. "https://clinicaltrials.gov/ct2/show/NCT03434379", "https://www.quickqueck.de/detail/228/"
    min_age: number; // e.g., 18
    max_age: number; // e.g., 99
    inclusionCriteria: string[]; // e.g., "BRAF:MUT", "BRAF:V600E", "CCNE1:DEL"
    exclusionCriteria: string[]; // e.g., "TP53:MUT", "TP53:ANY", "TP53:WT"
};

export declare type CTFilter = {
    patientId: string[];
    sampleId: string[];
    matchedTrialNames: string[]; // e.g., "Soratram", ""
    matchtedTrialURLs: string[];
    hugoGeneSymbols: string[];
    alterationTypes: string[]; // e.g., 'MUTATION', 'COPY_NUMBER_ALTERATION', 'STRUCTURAL_VARIANT'
    alterations: string[]; // e.g. "V600E", "AMP", "BCR-ABL1 Fusion"
    alterationDescriptions: string[]; // e.g., 'Missense_Mutation', 'Amplification', 'Fusion'
};

export declare type NumericGeneMolecularDataWithStatus = NumericGeneMolecularData & {
    copyNumberStatus: 'AMP' | 'DEL' | 'NEUTRAL';
};

interface Props {
    store: StudyViewPageStore;
}

interface MutationsPerPatient {
    mutations: Mutation[];
    cnaExt: NumericGeneMolecularDataWithStatus[];
    sv: StructuralVariant[];
    patientIds: Set<string>;
    sampleIds: Set<string>;
}

const client = new CBioPortalAPI();

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

            const sampleArray: Sample[] = store.samples.result;
            const profiles: MolecularProfile[] = store.molecularProfiles.result;

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

            let cna: NumericGeneMolecularData[] = [];

            try {
                cna = await getCnaData(sampleArray, cnaProfiles, hugoFilter);
            } catch (error) {
                console.error('No CNA in study:', error);
            }

            let sv: StructuralVariant[] = [];

            try {
                sv = await getSvData(sampleArray, svProfiles, hugoFilter);
            } catch (error) {
                console.error('No SV in study:', error);
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

            console.log('Mutations:', mutations);
            console.log('Copy number alterations:', cnaExt);
            console.log('Structural variants:', sv);

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
    const [hugoFilter] = useState<string[]>([
        'BRAF',
        'TP53',
        'CHEK1',
        'LAMP1',
        'FGF4',
        'SDHA',
        'SDHB',
        'SDHC',
        'SDHD',
        'MSH3',
        'MSH6',
        'MLH1',
        'PMS2',
    ]);

    const mutationsPerPatient = useMutationsPerPatient(store, hugoFilter);

    if (!mutationsPerPatient) {
        return (
            <div>
                ERROR! No mutations for this study found. Clinical Trials cannot
                be matched.
            </div>
        );
    }

    const filteredMutations = mutationsPerPatient.mutations.filter(m =>
        hugoFilter.includes(m.gene?.hugoGeneSymbol || '')
    );

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
            />
        </div>
    );
});

export default LocalClinicalTrialsMatch;
