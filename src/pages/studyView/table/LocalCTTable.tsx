import * as React from 'react';
import { SortDirection } from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import LazyMobXTable from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import {
    LazyMobXTableStore,
    Column,
} from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import { getSampleViewUrl } from '../../../shared/api/urls';

import {
    Mutation,
    NumericGeneMolecularData,
    StructuralVariant,
} from 'cbioportal-ts-api-client';
import {
    MUT_COLOR_INFRAME,
    MUT_COLOR_MISSENSE,
    MUT_COLOR_PROMOTER,
    MUT_COLOR_SPLICE,
    MUT_COLOR_TRUNC,
} from 'cbioportal-frontend-commons';
import { NumericGeneMolecularDataWithStatus } from '../tabs/LocalClinicalTrialsMatch';
import { clinicalTrial } from 'cbioportal-utils/src/model/LocalCT';

const mutationColorMap: Record<string, string> = {
    Missense_Mutation: MUT_COLOR_MISSENSE,
    In_Frame_Del: MUT_COLOR_INFRAME,
    In_Frame_Ins: MUT_COLOR_INFRAME,
    Truncating: MUT_COLOR_TRUNC,
    Splice_Site: MUT_COLOR_SPLICE,
    Promoter: MUT_COLOR_PROMOTER,
};

interface Props {
    filteredMutations: Mutation[];
    filteredCna: NumericGeneMolecularDataWithStatus[];
    filteredSV: StructuralVariant[];
}

const CTLazyTable: React.FC<Props> = ({
    filteredMutations,
    filteredCna,
    filteredSV,
}) => {
    const columns: Column<Mutation>[] = [
        {
            name: 'Patient ID',
            render: (m: Mutation) => (
                <a
                    href={getSampleViewUrl(m.studyId, m.sampleId)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {m.patientId}
                </a>
            ),
            sortBy: (m: Mutation) => m.patientId,
            filter: (m, filterString) =>
                m.patientId.toLowerCase().includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Sample ID',
            render: (m: Mutation) => (
                <a
                    href={getSampleViewUrl(m.studyId, m.sampleId)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {m.sampleId}
                </a>
            ),
            sortBy: (m: Mutation) => m.sampleId,
            filter: (m, filterString) =>
                m.sampleId.toLowerCase().includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Matched Trial',
            render: (m: Mutation) => (
                <a
                    href={`https://clinicaltrials.gov/study/NCT04924075`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    MK-6482-015-Phase2
                </a>
            ),
            sortBy: (m: Mutation) => 'Soratram', // Placeholder for sorting
            filter: (m, filterString) =>
                'Soratram'.toLowerCase().includes(filterString.toLowerCase()), // Placeholder for filtering
            width: 50,
        },

        {
            name: 'Gene',
            render: m => <span>{m.gene?.hugoGeneSymbol}</span>,
            sortBy: (m: Mutation) => m.gene?.hugoGeneSymbol || '',
            filter: (m, filterString) =>
                m.gene?.hugoGeneSymbol
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Alteration',
            render: m => <span>{m.proteinChange}</span>,
            sortBy: (m: Mutation) => m.proteinChange || '',
            filter: (m, filterString) =>
                m.proteinChange
                    ?.toLowerCase()
                    .includes(filterString.toLowerCase()) || false,
            width: 50,
        },

        {
            name: 'Alteration Type',
            render: (m: Mutation) => {
                const color = mutationColorMap[m.mutationType] || 'black';
                const label = m.mutationType.replace(/_Mutation/g, ' ');

                return (
                    <span style={{ color, fontWeight: 'bold' }}>{label}</span>
                );
            },
            filter: (m, filterString) =>
                m.mutationType
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            sortBy: (m: Mutation) => m.mutationType || '',
            width: 50,
        },
    ];

    return <LazyMobXTable columns={columns} data={filteredMutations} />;
};

export default CTLazyTable;
