import * as React from 'react';
import { observer } from 'mobx-react';
import { StudyViewPageStore } from '../StudyViewPageStore';
import { Mutation, Sample, MolecularProfile } from 'cbioportal-ts-api-client';
import { useState, useEffect } from 'react';
import { getMutationData } from 'pages/studyView/StudyViewComparisonUtils';
import CTLazyTable from 'pages/studyView/table/LocalCTTable';

interface Props {
    store: StudyViewPageStore;
}

interface MutationsPerPatient {
    mutations: Mutation[];
    patientIds: Set<string>;
    sampleIds: Set<string>;
}

const LocalClinicalTrialsMatch: React.FC<Props> = observer(({ store }) => {
    const [
        mutationsPerPatient,
        setMutationsPerPatient,
    ] = useState<MutationsPerPatient | null>(null);
    const [hugoFilter, setHugoFilter] = useState<string>('BRAF'); // Filter gene symbol

    useEffect(() => {
        async function loadMutations() {
            if (
                store.samples.status !== 'complete' ||
                store.molecularProfiles.status !== 'complete'
            ) {
                return;
            }

            const sampleArray: Sample[] = store.samples.result;
            const profiles: MolecularProfile[] = store.molecularProfiles.result;

            const mutationProfiles = profiles.filter(
                (p: MolecularProfile) =>
                    p.molecularAlterationType === 'MUTATION_EXTENDED'
            );

            const mutations: Mutation[] = await getMutationData(
                sampleArray,
                mutationProfiles,
                [hugoFilter] // Filter here
            );

            const patientIds = new Set<string>();
            const sampleIds = new Set<string>();

            mutations.forEach((m: Mutation) => {
                patientIds.add(m.patientId);
                sampleIds.add(m.sampleId);
            });

            setMutationsPerPatient({
                mutations,
                patientIds,
                sampleIds,
            });
        }

        loadMutations();
    }, [store.samples.status, store.molecularProfiles.status, hugoFilter]);

    if (!mutationsPerPatient) {
        return <div>Loading mutations...</div>;
    }

    // Filter mutations by hugo symbol
    const filteredMutations = mutationsPerPatient.mutations.filter(
        m => m.gene?.hugoGeneSymbol === hugoFilter
    );

    return (
        <div style={{ padding: 12 }}>
            <CTLazyTable filteredMutations={filteredMutations} />
        </div>
    );
});

export default LocalClinicalTrialsMatch;
