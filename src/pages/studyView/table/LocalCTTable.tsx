import * as React from 'react';
import { SortDirection } from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import LazyMobXTable from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import {
    LazyMobXTableStore,
    Column,
} from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import { getSampleViewUrl } from '../../../shared/api/urls';

import { Mutation } from 'cbioportal-ts-api-client';
import {
    MUT_COLOR_INFRAME,
    MUT_COLOR_MISSENSE,
    MUT_COLOR_PROMOTER,
    MUT_COLOR_SPLICE,
    MUT_COLOR_TRUNC,
} from 'cbioportal-frontend-commons';

const mutationColorMap: Record<string, string> = {
    Missense_Mutation: MUT_COLOR_MISSENSE,
    In_Frame_Del: MUT_COLOR_INFRAME,
    In_Frame_Ins: MUT_COLOR_INFRAME,
    Truncating: MUT_COLOR_TRUNC,
    Splice_Site: MUT_COLOR_SPLICE,
    Promoter: MUT_COLOR_PROMOTER,
    // ggf. weitere Typen ergänzen
};

interface Props {
    filteredMutations: Mutation[];
}

const CTLazyTable: React.FC<Props> = ({ filteredMutations }) => {
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
            width: 50,
        },

        {
            name: 'Matched Trial',
            render: (m: Mutation) => (
                <a
                    href={`https://www.quickqueck.de/detail/228/`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Soratram
                </a>
            ),
            width: 50,
        },

        {
            name: 'Gene',
            render: m => <span>{m.gene?.hugoGeneSymbol}</span>,
            width: 50,
        },

        {
            name: 'Protein Change',
            render: m => <span>{m.proteinChange}</span>,
            width: 50,
        },

        {
            name: 'Mutation Type',
            render: (m: Mutation) => {
                const color = mutationColorMap[m.mutationType] || 'black';
                const label = m.mutationType.replace(/_Mutation/g, ' ');

                return (
                    <span style={{ color, fontWeight: 'bold' }}>{label}</span>
                );
            },
            width: 50,
        },
    ];

    return <LazyMobXTable columns={columns} data={filteredMutations} />;
};

export default CTLazyTable;
