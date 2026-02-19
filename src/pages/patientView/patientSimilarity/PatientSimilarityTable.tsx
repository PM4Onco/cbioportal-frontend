import * as React from 'react';
import { observable } from 'mobx';
import { PatientViewPageStore } from '../clinicalInformation/PatientViewPageStore';
import { observer } from 'mobx-react';
import { Link } from 'react-router-dom';
import { Collapse } from 'react-bootstrap';
import LazyMobXTable, {
    Column,
} from 'shared/components/lazyMobXTable/LazyMobXTable';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import { DefaultTooltip } from 'cbioportal-frontend-commons';
import { Button } from 'react-bootstrap';
import { IClinicalTrial, IMtb } from 'cbioportal-utils';
import {
    SimilarPatient,
    TaggedMutation,
    SimilarMutation,
} from 'shared/api/SimilarPatientsAPI';
import { getServerConfig } from 'config/config';
import { MutationSelect } from './MutationSelect';
import {
    PatientSimilarityMutationTable,
    SimilarMutationColumnType,
} from './PatientSimilarityMutationTable';
import {
    getSimilarMutations,
    filterSimilarMutations,
    getCleanPathwaysForMutation,
    haveCleanPathwayOverlap,
    isTSGForMutation,
} from './PatientSimilarityUtils';

import { remoteData } from 'cbioportal-frontend-commons';
import { sleep } from 'shared/lib/TimeUtils';
import {
    ClinicalData,
    CBioPortalAPI,
    MutationFilter,
    Mutation,
    MolecularProfile,
} from 'cbioportal-ts-api-client';
import { ITherapyRecommendation, IGeneticAlteration } from 'cbioportal-utils';
import SampleManager from 'pages/patientView/SampleManager';
import { getPatientViewUrl, getSampleViewUrl } from 'shared/api/urls';
import { mergeMutations } from 'shared/lib/StoreUtils';
import { MutationTableColumnType } from 'shared/components/mutationTable/MutationTable';
import styles from './styles.module.scss';
import SimilarityScoreBar from './SimilarityScoreBar';
import { fetchMtbsUsingGET } from 'shared/api/TherapyRecommendationAPI';
import MtbTherapyRecommendationTable from '../therapyRecommendation/MtbTherapyRecommendationTable';
import WindowStore from 'shared/components/window/WindowStore';
import MtbTherapyRecommendationTableNoAddButtons from './MtbTherapyRecommendationTableNoAddButtons';

const sectionTitleStyle = {
    color: '#000',
    fontSize: '16px',
    fontWeight: 600,
    margin: '12px 0 -10px',
};

function toOncoTreeCode(v?: string): string | undefined {
    if (!v) return undefined;
    const m = /\(([^)]+)\)\s*$/.exec(String(v));
    return m ? m[1] : v;
}

enum ColumnKey {
    //patient_id: string;
    //study_id: string;
    //age: number;
    //gender: string;
    //name: string;
    //cancertype: string;
    STUDY = 'study',
    NAME = 'name',
    AGE = 'age',
    GENDER = 'gender',
    CANCERTYPE = 'cancertype',
    COMMONVARIANTS = 'common variants',
}

interface PatientSimilarityProps {
    store: PatientViewPageStore;
    similarPatients: SimilarPatient[];
    sampleManager: SampleManager | null;
}

export type PatientSimilarityTableState = {
    selectedMutations: IGeneticAlteration[];
    currentSimilarPatients: SimilarPatient[];
    selectedSimilarPatient: SimilarPatient | undefined;
    similarMutations: SimilarMutation[];
    viewMode: 'list' | 'detail';
    selectedPatientIndex: number | undefined;
    filterSameCancerType: boolean;
    limitToProteinChange: boolean;
    coverageThreshold: number;

    // Cache MTB data per similar patient
    mtbByPatient?: Record<string, { mtbs: IMtb[] }>;
    tumorTypeMapOverride?: { [uniqueKey: string]: string };

    // State for mutations that are only present in the similar patient
    distinctSimilarMutations: SimilarMutation[];
    showAllDistinct: boolean;

    // weights for similarity score
    similarityWeightEqual: number;
    similarityWeightGene: number;
    similarityWeightPathway: number;

    // ui state for similarity score settings
    showWeightAdjuster: boolean;
    weightTSGAsEqual: boolean;
};

class SimilarPatientTableComponent extends LazyMobXTable<SimilarPatient> {}

@observer
export class PatientSimilarityTable extends React.Component<
    PatientSimilarityProps,
    PatientSimilarityTableState,
    {}
> {
    private readonly ENTRIES_PER_PAGE = 10;

    // default weights for similarity score
    private readonly DEFAULT_WEIGHT_EQUAL = 20;
    private readonly DEFAULT_WEIGHT_GENE = 5;
    private readonly DEFAULT_WEIGHT_PATHWAY = 1;

    private readonly _columns: Column<SimilarPatient>[] = [
        {
            name: 'Similarity Score',
            headerRender: () => (
                <DefaultTooltip
                    placement="top"
                    overlay={
                        <div style={{ maxWidth: 360 }}>
                            The Similarity Score is computed as a weighted sum
                            of matched alterations between the reference patient
                            and the selected similar patient (exact match, same
                            gene, and pathway overlap). You can adjust these
                            weights via “Adjust Similarity Score Weighting”.
                        </div>
                    }
                    trigger={['hover', 'focus']}
                    destroyTooltipOnHide={false}
                >
                    <span>Similarity Score</span>
                </DefaultTooltip>
            ),
            render: (patient: SimilarPatient) => (
                <div>{patient.similarityScore ?? '–'}</div>
            ),
            width: 150,
            resizable: true,
        },

        {
            //name: ColumnKey.NAME,
            name: 'Name',
            render: (patient: SimilarPatient) => (
                <a
                    href={getPatientViewUrl(
                        patient.study_id,
                        patient.patient_id
                    )}
                    target="_blank"
                >
                    {patient.name}
                </a>
            ),
            width: 250,
            resizable: true,
        },
        {
            //name: ColumnKey.AGE,
            name: 'Age',
            render: (patient: SimilarPatient) => <div>{patient.age}</div>,
            width: 250,
            resizable: true,
        },
        {
            //name: ColumnKey.GENDER,
            name: 'Gender',
            render: (patient: SimilarPatient) => <div>{patient.gender}</div>,
            width: 250,
            resizable: true,
        },
        {
            //name: ColumnKey.CANCERTYPE,
            name: 'Cancer Type',
            render: (patient: SimilarPatient) => (
                <div>{patient.cancertype}</div>
            ),
            width: 250,
            resizable: true,
        },
        {
            //name: ColumnKey.COMMONVARIANTS,
            name: 'Common Variants',
            render: (patient: SimilarPatient) => {
                const { selectedMutations, limitToProteinChange } = this.state;

                // Compute all similar mutations between the reference and this patient
                const allSimilarMutations = filterSimilarMutations(
                    getSimilarMutations(
                        this.props.store.mergedMutationData,
                        mergeMutations(patient.mutationData)
                    ),
                    ['equal', 'phgvs']
                );

                // Case 1: no filter selected --> show all similar mutations
                if (selectedMutations.length === 0) {
                    return (
                        <div>
                            {allSimilarMutations.map((mutation, idx) => (
                                <div key={idx}>
                                    {[
                                        mutation.mutations1[0].gene
                                            .hugoGeneSymbol,
                                        mutation.mutations1[0].proteinChange,
                                    ].join(' ')}
                                </div>
                            ))}
                        </div>
                    );
                }

                // Case 2: filters active --> always match by gene, optionally also by exact protein change
                const filtered = allSimilarMutations.filter(mutation => {
                    const m1 = mutation.mutations1[0];

                    return selectedMutations.some(selected => {
                        const sameGene =
                            selected.entrezGeneId &&
                            selected.entrezGeneId === m1.entrezGeneId;

                        if (!sameGene) return false;

                        if (limitToProteinChange) {
                            return (
                                selected.chromosome === m1.chr &&
                                selected.start === m1.startPosition &&
                                selected.ref === m1.referenceAllele &&
                                selected.alt === m1.variantAllele
                            );
                        }

                        // If limitToProteinChange is false, matching on the same gene is enough.
                        return true;
                    });
                });

                // Render filtered list of common variants
                return (
                    <div>
                        {filtered.map((mutation, idx) => (
                            <div key={idx}>
                                {[
                                    mutation.mutations1[0].gene.hugoGeneSymbol,
                                    mutation.mutations1[0].proteinChange,
                                ].join(' ')}
                            </div>
                        ))}
                    </div>
                );
            },
            width: 350,
            resizable: true,
        },
        {
            //name: ColumnKey.STUDY,
            name: 'Study',
            render: (patient: SimilarPatient, i: any) => (
                <div>{patient.study_id}</div>
            ),
            width: 250,
            resizable: true,
        },
    ];
    private referenceCancerType: string | undefined;

    private async ensureMtbLoadedFor(p: SimilarPatient) {
        if (this.state.mtbByPatient?.[p.patient_id]) return;

        const url = this.props.store.getMtbJsonStoreUrl(
            encodeURIComponent(p.patient_id)
        ); // eigene ID!
        const mtbs = (await fetchMtbsUsingGET(
            url,
            encodeURIComponent(p.study_id),
            ''
        )) as IMtb[];

        mtbs.sort((a: IMtb, b: IMtb) =>
            (b.date ?? '').localeCompare(a.date ?? '')
        );

        this.setState(prev => ({
            mtbByPatient: {
                ...(prev.mtbByPatient ?? {}),
                [p.patient_id]: { mtbs },
            },
        }));
    }

    private getReferenceCancerType(): string | undefined {
        const data = this.props.store.clinicalDataPatient.result;
        const entry = data.find(
            d => d.clinicalAttributeId === 'DETAILED_CANCER_TYPE'
        );

        return entry?.value;
    }

    constructor(props: PatientSimilarityProps) {
        super(props);
        this.state = {
            selectedSimilarPatient: undefined,
            similarMutations: [],
            selectedMutations: new Array<IGeneticAlteration>(),
            currentSimilarPatients: this.props.similarPatients,
            viewMode: 'list',
            selectedPatientIndex: undefined,
            filterSameCancerType: false,
            limitToProteinChange: false,
            coverageThreshold: 0,
            mtbByPatient: {},

            distinctSimilarMutations: [],
            showAllDistinct: false,

            similarityWeightEqual: this.DEFAULT_WEIGHT_EQUAL,
            similarityWeightGene: this.DEFAULT_WEIGHT_GENE,
            similarityWeightPathway: this.DEFAULT_WEIGHT_PATHWAY,
            showWeightAdjuster: false,
            weightTSGAsEqual: false,
        };
    }

    componentDidMount() {
        // no initial patient --> start in similar patient list
        //this.selectPatient(0);
        this.setState({
            currentSimilarPatients: this.withSimilarityScores(
                this.state.currentSimilarPatients
            ),
        });
    }

    private withSimilarityScores(
        patients: SimilarPatient[],
        weights?: { equal: number; gene: number; pathway: number }
    ): SimilarPatient[] {
        const equalWeight =
            weights?.equal ??
            this.state.similarityWeightEqual ??
            this.DEFAULT_WEIGHT_EQUAL;
        const geneWeight =
            weights?.gene ??
            this.state.similarityWeightGene ??
            this.DEFAULT_WEIGHT_GENE;
        const pathwayWeight =
            weights?.pathway ??
            this.state.similarityWeightPathway ??
            this.DEFAULT_WEIGHT_PATHWAY;

        const patientsWithScore = patients.map(p => {
            const score = this.calculateSimilarityScore(p, {
                equal: equalWeight,
                gene: geneWeight,
                pathway: pathwayWeight,
            });
            return { ...p, similarityScore: score };
        });

        patientsWithScore.sort(
            (a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0)
        );

        return patientsWithScore;
    }

    startSearch() {
        let newSimilarPatients: SimilarPatient[] = [];
        let didFilter = false;

        if (this.state.selectedMutations.length > 0) {
            for (const similarPatient of this.props.similarPatients) {
                let matchCount = 0;

                for (const alteration of this.state.selectedMutations) {
                    const foundMutation = similarPatient.mutationData.find(
                        (currentAlteration: Mutation) => {
                            const sameGene =
                                alteration.entrezGeneId &&
                                alteration.entrezGeneId ===
                                    currentAlteration.entrezGeneId;

                            if (!sameGene) return false;

                            if (this.state.limitToProteinChange) {
                                return (
                                    alteration.chromosome ===
                                        currentAlteration.chr &&
                                    alteration.start ===
                                        currentAlteration.startPosition &&
                                    alteration.ref ===
                                        currentAlteration.referenceAllele &&
                                    alteration.alt ===
                                        currentAlteration.variantAllele
                                );
                            }

                            return true;
                        }
                    );

                    if (foundMutation) {
                        matchCount++;
                    }
                }

                // Only keep patients that reach the selected coverage threshold
                if (matchCount >= this.state.coverageThreshold) {
                    newSimilarPatients.push(similarPatient);
                }
            }

            didFilter = true;
        }

        if (!didFilter) {
            newSimilarPatients = this.props.similarPatients;
        }

        if (this.state.filterSameCancerType) {
            const refCancerType = this.getReferenceCancerType();
            if (refCancerType) {
                newSimilarPatients = newSimilarPatients.filter(
                    p => p.cancertype === refCancerType
                );
            }
        }

        newSimilarPatients = this.withSimilarityScores(newSimilarPatients);

        this.setState({
            currentSimilarPatients: newSimilarPatients,
        });
    }

    private extractCleanPathwaysFromMutation(m: any): string[] {
        return getCleanPathwaysForMutation(m);
    }

    private hasCleanPathwayOverlap(sim: SimilarMutation): boolean {
        const leftAll: any[] = Array.isArray(sim.mutations1)
            ? sim.mutations1
            : [];
        const rightAll: any[] = Array.isArray(sim.mutations2)
            ? sim.mutations2
            : [];
        return haveCleanPathwayOverlap(leftAll, rightAll);
    }

    private calculateSimilarityScore(
        similarPatient: SimilarPatient,
        weights?: { equal: number; gene: number; pathway: number }
    ): number {
        const referenceMutations = this.props.store.mergedMutationData;
        const targetMutations = mergeMutations(similarPatient.mutationData);

        const similarMutations = getSimilarMutations(
            referenceMutations,
            targetMutations
        );
        const filtered = filterSimilarMutations(similarMutations, [
            'equal',
            'phgvs',
            'pathway',
            'gene',
        ]);

        const equalWeight =
            weights?.equal ??
            this.state.similarityWeightEqual ??
            this.DEFAULT_WEIGHT_EQUAL;
        const geneWeight =
            weights?.gene ??
            this.state.similarityWeightGene ??
            this.DEFAULT_WEIGHT_GENE;
        const pathwayWeight =
            weights?.pathway ??
            this.state.similarityWeightPathway ??
            this.DEFAULT_WEIGHT_PATHWAY;

        let score = 0;

        for (const mutation of filtered) {
            switch (mutation.similarityTag) {
                case 'equal':
                    score += equalWeight;
                    break;
                case 'gene':
                    // treat TSG gene-level matches as equal-weight if enabled
                    if (
                        this.state.weightTSGAsEqual &&
                        this.isTSGSimilarityMutation(mutation)
                    ) {
                        score += equalWeight;
                    } else {
                        score += geneWeight;
                    }
                    break;
                case 'pathway':
                    if (this.hasCleanPathwayOverlap(mutation)) {
                        score += pathwayWeight;
                    }
                    break;
                default:
                    break;
            }
        }

        return score;
    }

    // Helper: extract gene symbol from a mutation
    private getGeneSymbolFromMutation(m: Mutation): string | undefined {
        const g = (m as any).gene as any;
        if (g && g.hugoGeneSymbol) return g.hugoGeneSymbol;
        if ((m as any).hugoGeneSymbol) return (m as any).hugoGeneSymbol;
        return undefined;
    }

    private isTSGSimilarityMutation(sim: SimilarMutation): boolean {
        const muts: any[] = Array.isArray((sim as any).mutations1)
            ? ((sim as any).mutations1 as any[])
            : [];
        const first = muts.length ? muts[0] : undefined;
        return first ? isTSGForMutation(first) : false;
    }

    // Mutations whose genes are not present in the reference patient
    private computeDistinctSimilarMutations(
        selected: SimilarPatient
    ): SimilarMutation[] {
        // collect all genes from the reference patient
        const refAll = this.props.store.mergedMutationData || [];
        const refGenes = new Set<string>();

        for (const row of refAll) {
            const muts = row as Mutation[];
            for (const m of muts) {
                const symbol = this.getGeneSymbolFromMutation(m);
                if (symbol) refGenes.add(symbol);
            }
        }

        const mergedSimilarRows = mergeMutations(selected.mutationData);
        const mergedSimilar: Mutation[] = mergedSimilarRows.reduce(
            (acc, row) => acc.concat(row),
            [] as Mutation[]
        );
        const distinct: SimilarMutation[] = [];

        for (const mut of mergedSimilar) {
            const symbol = this.getGeneSymbolFromMutation(mut);
            if (symbol && refGenes.has(symbol)) {
                continue;
            }

            const sm: SimilarMutation = {
                similarityTag: 'distinct' as any,
                mutations1: [] as any,
                mutations2: [mut] as any,
            } as any;

            distinct.push(sm);
        }

        return distinct;
    }

    public async selectPatient(i: number) {
        const selectedSimilarPatient = this.state.currentSimilarPatients[i];

        const compareTumorType =
            toOncoTreeCode(selectedSimilarPatient.cancertype) ??
            this.getReferenceCancerType();
        const override: { [k: string]: string } = {};

        for (const mut of selectedSimilarPatient.mutationData) {
            const m = mut as any;
            const uniqueKey: string =
                m.uniqueSampleKey ??
                (m.sampleId && m.molecularProfileId
                    ? `${m.sampleId}:${m.molecularProfileId}`
                    : m.sampleId ?? m.tumorSampleBarcode ?? '');
            if (uniqueKey && compareTumorType) {
                override[uniqueKey] = compareTumorType;
            }
        }

        const mergedSimilarMutations = mergeMutations(
            selectedSimilarPatient.mutationData
        );
        const similarMutations = getSimilarMutations(
            this.props.store.mergedMutationData,
            mergedSimilarMutations
        );
        const filteredSimilarMutations = filterSimilarMutations(
            similarMutations,
            ['equal', 'phgvs', 'pathway', 'gene']
        ).filter(
            m => m.similarityTag !== 'pathway' || this.hasCleanPathwayOverlap(m)
        );

        try {
            const p = this.props.store;
            const merged = p.mergedMutationData || [];
            const refRow0: any[] = (merged[0] as any[]) || [];
            const refM0: any = refRow0[0] || {};

            const tumorMap = p.uniqueSampleKeyToTumorType || {};
            const indMap: any =
                (p.oncoKbData &&
                    p.oncoKbData.result &&
                    (p.oncoKbData.result as any).indicatorMap) ||
                {};

            if (filteredSimilarMutations.length > 0) {
                const sim0 = filteredSimilarMutations[0];
                const mSim0: any =
                    (sim0.mutations1 && sim0.mutations1[0]) || {};
            }
        } catch (e) {
            console.debug('[SIM/debug:error]', e);
        }

        const distinctSimilarMutations = this.computeDistinctSimilarMutations(
            selectedSimilarPatient
        );

        this.setState({
            selectedSimilarPatient,
            tumorTypeMapOverride: override,
            similarMutations: filteredSimilarMutations,
            distinctSimilarMutations,
            viewMode: 'detail',
            selectedPatientIndex: i,
        });

        void this.ensureMtbLoadedFor(selectedSimilarPatient);
    }

    goToNextPatient() {
        const nextIndex = this.state.selectedPatientIndex! + 1;
        if (nextIndex < this.state.currentSimilarPatients.length) {
            this.selectPatient(nextIndex);
        }
    }

    goToPreviousPatient() {
        const prevIndex = this.state.selectedPatientIndex! - 1;
        if (prevIndex >= 0) {
            this.selectPatient(prevIndex);
        }
    }
    goBackToList() {
        this.setState({ viewMode: 'list' });
    }

    private getVisibleColumns(): { [columnId: string]: boolean } {
        let result = {} as { [columnId: string]: boolean };

        const visibleColumns = [] as SimilarMutationColumnType[];
        for (const colId of visibleColumns) {
            result[colId] = true;
        }

        const invisibleColumns = [] as SimilarMutationColumnType[];
        for (const colId of invisibleColumns) {
            result[colId] = false;
        }
        return result;
    }
    // Columns for distinct Mutation Talbe
    private getDistinctColumnsVisibility(): { [columnId: string]: boolean } {
        return {
            [SimilarMutationColumnType.SIMILARITYTAG]: false,
            [SimilarMutationColumnType.CHROM]: false,
            [SimilarMutationColumnType.START]: false,
            [SimilarMutationColumnType.REF]: false,
            [SimilarMutationColumnType.ALT]: false,
            [SimilarMutationColumnType.CHGVS]: false,
            [SimilarMutationColumnType.PHGVS]: false,
            [SimilarMutationColumnType.TRANSCRIPT]: false,
            [SimilarMutationColumnType.GENE]: false,
            [SimilarMutationColumnType.PATHWAYS]: false,
            [SimilarMutationColumnType.ANNOTATION]: false,
            [SimilarMutationColumnType.ALLELFREQ]: false,

            [SimilarMutationColumnType.COMPGENE]: true,
            [SimilarMutationColumnType.COMPPHGVS]: true,
            [SimilarMutationColumnType.COMPANNOTATION]: true,
            [SimilarMutationColumnType.COMPPATHWAYS]: true,
            [SimilarMutationColumnType.COMPALLELFREQ]: true,

            [SimilarMutationColumnType.COMPCHROM]: false,
            [SimilarMutationColumnType.COMPSTART]: false,
            [SimilarMutationColumnType.COMPREF]: false,
            [SimilarMutationColumnType.COMPALT]: false,
            [SimilarMutationColumnType.COMPCHGVS]: false,
            [SimilarMutationColumnType.COMPTRANSCRIPT]: false,
        };
    }

    render() {
        if (this.state.viewMode === 'list') {
            return (
                <div>
                    <div style={{ padding: '3px' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '30px',
                                marginBottom: '20px',
                            }}
                        >
                            {/* Mutations-Select */}
                            <div style={{ minWidth: '420px' }}>
                                <b>Mutations:</b>
                                <div style={{ width: '420px' }}>
                                    <MutationSelect
                                        mutations={
                                            this.props.store.mutationData.result
                                        }
                                        cna={
                                            this.props.store.discreteCNAData
                                                .result
                                        }
                                        data={[]}
                                        indexedVariantAnnotations={
                                            this.props.store
                                                .indexedVariantAnnotations
                                                .result
                                        }
                                        indexedMyVariantInfoAnnotations={
                                            this.props.store
                                                .indexedMyVariantInfoAnnotations
                                                .result
                                        }
                                        onChange={(
                                            selectedOptions: IGeneticAlteration[]
                                        ) => {
                                            this.setState(
                                                prevState => {
                                                    const wasEmpty =
                                                        prevState
                                                            .selectedMutations
                                                            .length === 0;
                                                    const newThreshold = wasEmpty
                                                        ? selectedOptions.length >
                                                          0
                                                            ? 1
                                                            : 0
                                                        : Math.min(
                                                              prevState.coverageThreshold,
                                                              selectedOptions.length
                                                          );

                                                    return {
                                                        selectedMutations: selectedOptions,
                                                        coverageThreshold: newThreshold,
                                                    };
                                                },
                                                () => {
                                                    this.startSearch();
                                                }
                                            );
                                        }}
                                        sampleManager={this.props.sampleManager}
                                    />
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                    minWidth: '360px',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '16px',
                                    }}
                                >
                                    {/* Checkboxen links */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                        }}
                                    >
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={
                                                    this.state
                                                        .filterSameCancerType
                                                }
                                                onChange={e =>
                                                    this.setState(
                                                        {
                                                            filterSameCancerType:
                                                                e.target
                                                                    .checked,
                                                        },
                                                        () => this.startSearch()
                                                    )
                                                }
                                                style={{ marginRight: '8px' }}
                                            />
                                            Limit to same Cancer Type
                                        </label>

                                        {/* 2. Zeile: Coverage-Slider + Limit to same Protein Change nebeneinander */}
                                        {this.state.selectedMutations.length >
                                            0 && (
                                            <>
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            this.state
                                                                .limitToProteinChange
                                                        }
                                                        onChange={e =>
                                                            this.setState(
                                                                {
                                                                    limitToProteinChange:
                                                                        e.target
                                                                            .checked,
                                                                },
                                                                () =>
                                                                    this.startSearch()
                                                            )
                                                        }
                                                        style={{
                                                            marginRight: '8px',
                                                        }}
                                                    />
                                                    Limit to same Protein
                                                    Changes
                                                </label>

                                                {/* Coverage-Slider direkt unter Limit to same Protein Changes */}
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        marginLeft: '24px', // leicht eingerückt, optional
                                                        marginTop: '4px',
                                                    }}
                                                >
                                                    <label>
                                                        <b>Coverage Rate ≥</b>{' '}
                                                        {
                                                            this.state
                                                                .coverageThreshold
                                                        }
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max={
                                                            this.state
                                                                .selectedMutations
                                                                .length
                                                        }
                                                        value={
                                                            this.state
                                                                .coverageThreshold
                                                        }
                                                        onChange={e =>
                                                            this.setState(
                                                                {
                                                                    coverageThreshold: Number(
                                                                        e.target
                                                                            .value
                                                                    ),
                                                                },
                                                                () =>
                                                                    this.startSearch()
                                                            )
                                                        }
                                                        style={{
                                                            width: '150px',
                                                            marginTop: '5px',
                                                        }}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* rechts: Adjust-Button mit Menü daneben */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '8px',
                                            flexWrap: 'nowrap',
                                        }}
                                    >
                                        {/* kleine Box nur um den Adjust-Button */}
                                        <Button
                                            bsStyle="primary"
                                            style={{ whiteSpace: 'nowrap' }}
                                            onClick={() =>
                                                this.setState(prevState => ({
                                                    showWeightAdjuster: !prevState.showWeightAdjuster,
                                                }))
                                            }
                                        >
                                            Adjust Similarity Score Weighting
                                        </Button>

                                        {/* Menü direkt rechts daneben */}
                                        <Collapse
                                            in={this.state.showWeightAdjuster}
                                        >
                                            <div
                                                style={{
                                                    border: '1px solid #ddd',
                                                    borderRadius: '4px',
                                                    padding: '8px 10px',
                                                    backgroundColor: '#fdfdfd',
                                                    maxWidth: '520px',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: '12px',
                                                        marginBottom: '8px',
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            flex: 1,
                                                            minWidth: '140px',
                                                        }}
                                                    >
                                                        <label>
                                                            Equal mutation
                                                            weight
                                                        </label>
                                                        <div
                                                            style={{
                                                                fontSize:
                                                                    '11px',
                                                                color: '#666',
                                                            }}
                                                        >
                                                            Exact identical
                                                            mutations
                                                        </div>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={1}
                                                            value={
                                                                this.state
                                                                    .similarityWeightEqual
                                                            }
                                                            onChange={e => {
                                                                const raw =
                                                                    e.target
                                                                        .value;
                                                                // führende Nullen entfernen, aber "0" selbst erlauben
                                                                const cleaned = raw.replace(
                                                                    /^0+(?=\d)/,
                                                                    ''
                                                                );
                                                                this.setState({
                                                                    similarityWeightEqual:
                                                                        cleaned ===
                                                                        ''
                                                                            ? 0
                                                                            : Number(
                                                                                  cleaned
                                                                              ),
                                                                });
                                                            }}
                                                            className="form-control"
                                                        />
                                                    </div>

                                                    <div
                                                        style={{
                                                            flex: 1,
                                                            minWidth: '140px',
                                                        }}
                                                    >
                                                        <label>
                                                            Gene match weight
                                                        </label>
                                                        <div
                                                            style={{
                                                                fontSize:
                                                                    '11px',
                                                                color: '#666',
                                                            }}
                                                        >
                                                            Same gene, different
                                                            mutation
                                                        </div>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={1}
                                                            value={
                                                                this.state
                                                                    .similarityWeightGene
                                                            }
                                                            onChange={e => {
                                                                const raw =
                                                                    e.target
                                                                        .value;
                                                                const cleaned = raw.replace(
                                                                    /^0+(?=\d)/,
                                                                    ''
                                                                );
                                                                this.setState({
                                                                    similarityWeightGene:
                                                                        cleaned ===
                                                                        ''
                                                                            ? 0
                                                                            : Number(
                                                                                  cleaned
                                                                              ),
                                                                });
                                                            }}
                                                            className="form-control"
                                                        />
                                                    </div>

                                                    <div
                                                        style={{
                                                            flex: 1,
                                                            minWidth: '140px',
                                                        }}
                                                    >
                                                        <label>
                                                            Pathway match weight
                                                        </label>
                                                        <div
                                                            style={{
                                                                fontSize:
                                                                    '11px',
                                                                color: '#666',
                                                            }}
                                                        >
                                                            Overlap on cleaned
                                                            pathways
                                                        </div>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={1}
                                                            value={
                                                                this.state
                                                                    .similarityWeightPathway
                                                            }
                                                            onChange={e => {
                                                                const raw =
                                                                    e.target
                                                                        .value;
                                                                const cleaned = raw.replace(
                                                                    /^0+(?=\d)/,
                                                                    ''
                                                                );
                                                                this.setState({
                                                                    similarityWeightPathway:
                                                                        cleaned ===
                                                                        ''
                                                                            ? 0
                                                                            : Number(
                                                                                  cleaned
                                                                              ),
                                                                });
                                                            }}
                                                            className="form-control"
                                                        />
                                                    </div>
                                                </div>

                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: '8px',
                                                        marginTop: '5px',
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    <Button
                                                        bsStyle="primary"
                                                        onClick={() => {
                                                            const weights = {
                                                                equal: this
                                                                    .state
                                                                    .similarityWeightEqual,
                                                                gene: this.state
                                                                    .similarityWeightGene,
                                                                pathway: this
                                                                    .state
                                                                    .similarityWeightPathway,
                                                            };
                                                            this.setState(
                                                                prevState => ({
                                                                    currentSimilarPatients: this.withSimilarityScores(
                                                                        prevState.currentSimilarPatients,
                                                                        weights
                                                                    ),
                                                                    showWeightAdjuster: false,
                                                                })
                                                            );
                                                        }}
                                                    >
                                                        Submit
                                                    </Button>
                                                    <Button
                                                        bsStyle="default"
                                                        onClick={() => {
                                                            const defaultWeights = {
                                                                equal: this
                                                                    .DEFAULT_WEIGHT_EQUAL,
                                                                gene: this
                                                                    .DEFAULT_WEIGHT_GENE,
                                                                pathway: this
                                                                    .DEFAULT_WEIGHT_PATHWAY,
                                                            };
                                                            this.setState(
                                                                prevState => ({
                                                                    similarityWeightEqual:
                                                                        defaultWeights.equal,
                                                                    similarityWeightGene:
                                                                        defaultWeights.gene,
                                                                    similarityWeightPathway:
                                                                        defaultWeights.pathway,
                                                                    currentSimilarPatients: this.withSimilarityScores(
                                                                        prevState.currentSimilarPatients,
                                                                        defaultWeights
                                                                    ),
                                                                    showWeightAdjuster: false,
                                                                })
                                                            );
                                                        }}
                                                    >
                                                        Reset to default
                                                    </Button>
                                                    <Button
                                                        bsStyle="link"
                                                        onClick={() =>
                                                            this.setState({
                                                                showWeightAdjuster: false,
                                                            })
                                                        }
                                                    >
                                                        Back
                                                    </Button>
                                                </div>
                                                {/* TSG weighting option */}
                                                <div style={{ marginTop: 10 }}>
                                                    <DefaultTooltip
                                                        placement="top"
                                                        overlay={
                                                            <div
                                                                style={{
                                                                    maxWidth: 420,
                                                                }}
                                                            >
                                                                Tumor suppressor
                                                                genes (TSGs) are
                                                                classified based
                                                                on the OncoKB
                                                                “Cancer Genes”
                                                                curation{' '}
                                                                <a
                                                                    href="https://www.oncokb.org/cancer-genes"
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >
                                                                    https://www.oncokb.org/cancer-genes
                                                                </a>
                                                                . In TSGs,
                                                                diverse variants
                                                                can converge on
                                                                loss-of-function
                                                                effects;
                                                                therefore, the
                                                                exact mutated
                                                                position is
                                                                often less
                                                                informative than
                                                                for activating
                                                                hotspot
                                                                mutations in
                                                                oncogenes. When
                                                                enabled, this
                                                                option treats
                                                                gene-level
                                                                matches in TSGs
                                                                as equal-weight
                                                                matches in the
                                                                similarity
                                                                score.
                                                            </div>
                                                        }
                                                        trigger={[
                                                            'hover',
                                                            'focus',
                                                        ]}
                                                        destroyTooltipOnHide={
                                                            false
                                                        }
                                                    >
                                                        <label
                                                            style={{
                                                                display: 'flex',
                                                                alignItems:
                                                                    'center',
                                                                gap: 8,
                                                                cursor:
                                                                    'pointer',
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    this.state
                                                                        .weightTSGAsEqual
                                                                }
                                                                onChange={e =>
                                                                    this.setState(
                                                                        {
                                                                            weightTSGAsEqual:
                                                                                e
                                                                                    .target
                                                                                    .checked,
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                            <span>
                                                                Weight mutations
                                                                in tumor
                                                                suppressor genes
                                                                as equal
                                                            </span>
                                                        </label>
                                                    </DefaultTooltip>
                                                </div>
                                            </div>
                                        </Collapse>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <SimilarPatientTableComponent
                                showCopyDownload={false}
                                data={this.state.currentSimilarPatients}
                                columns={this._columns}
                                initialItemsPerPage={this.ENTRIES_PER_PAGE}
                                onRowClick={(d: SimilarPatient, i: number) =>
                                    this.selectPatient(i)
                                }
                            />
                        </div>
                    </div>
                </div>
            );
        } else {
            const allDistinct = this.state.distinctSimilarMutations;
            const distinctData = this.state.showAllDistinct
                ? allDistinct
                : allDistinct.slice(0, 10);
            const p = this.state.selectedSimilarPatient;
            return (
                <div>
                    <div
                        style={{
                            display: 'flex',
                            width: '100%',
                            alignItems: 'flex-start',
                        }}
                    >
                        <div
                            style={{
                                flex: 0.85,
                                position: 'relative',
                                zIndex: 999,
                                overflow: 'visible',
                            }}
                        >
                            <SimilarityScoreBar
                                patients={this.state.currentSimilarPatients}
                                selectedPatientId={
                                    this.state.selectedSimilarPatient
                                        ?.patient_id ?? ''
                                }
                                onSelectPatient={id => {
                                    const index = this.state.currentSimilarPatients.findIndex(
                                        p => p.patient_id === id
                                    );
                                    if (index >= 0) this.selectPatient(index);
                                }}
                            />
                        </div>
                        <div style={{ width: '300px' }}>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '10px',
                                    marginBottom: '10px',
                                }}
                            >
                                <Button
                                    onClick={() => this.goToNextPatient()}
                                    disabled={
                                        this.state.selectedPatientIndex! >=
                                        this.state.currentSimilarPatients
                                            .length -
                                            1
                                    }
                                    style={{
                                        backgroundColor: '#ccc',
                                        borderColor: '#ccc',
                                        width: '140px',
                                    }}
                                >
                                    Next Patient
                                </Button>
                                <Button
                                    onClick={() => this.goToPreviousPatient()}
                                    disabled={
                                        this.state.selectedPatientIndex! <= 0
                                    }
                                    style={{
                                        backgroundColor: '#ccc',
                                        borderColor: '#ccc',
                                        width: '140px',
                                    }}
                                >
                                    Previous Patient
                                </Button>
                            </div>
                            <Button
                                onClick={() => this.goBackToList()}
                                style={{
                                    backgroundColor: '#ccc',
                                    borderColor: '#ccc',
                                    width: '290px', // 2 × 140 + 10 gap
                                }}
                            >
                                <span style={{ marginRight: 6 }}>⟵</span>
                                Back to overview table
                            </Button>
                        </div>
                    </div>
                    <div style={sectionTitleStyle}>
                        Shared Mutations between Reference Patient and Selected
                        Similar Patient
                    </div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <PatientSimilarityMutationTable
                            data={this.state.similarMutations}
                            weightTSGAsEqual={this.state.weightTSGAsEqual}
                            sampleManager1={this.props.sampleManager}
                            sampleToGenePanelId1={
                                this.props.store.sampleToMutationGenePanelId
                                    .result
                            }
                            genePanelIdToEntrezGeneIds1={
                                this.props.store.genePanelIdToEntrezGeneIds
                                    .result
                            }
                            sampleIds1={this.props.store.sampleIds}
                            sampleManager2={this.props.sampleManager}
                            sampleToGenePanelId2={
                                this.props.store.sampleToMutationGenePanelId
                                    .result
                            }
                            genePanelIdToEntrezGeneIds2={
                                this.props.store.genePanelIdToEntrezGeneIds
                                    .result
                            }
                            sampleIds2={this.props.store.sampleIds}
                            columnVisibility={this.getVisibleColumns()}
                            oncoKbData={this.props.store.oncoKbData}
                            oncoKbCancerGenes={
                                this.props.store.oncoKbCancerGenes
                            }
                            hotspotData={this.props.store.indexedHotspotData}
                            myCancerGenomeData={
                                this.props.store.myCancerGenomeData
                            }
                            civicGenes={this.props.store.civicGenes}
                            civicVariants={this.props.store.civicVariants}
                            indexedVariantAnnotations={
                                this.props.store.indexedVariantAnnotations
                            }
                            pubMedCache={this.props.store.pubMedCache}
                            usingPublicOncoKbInstance={
                                this.props.store.usingPublicOncoKbInstance
                            }
                            studyIdToStudy={
                                this.props.store.studyIdToStudy.result
                            }
                            uniqueSampleKeyToTumorType={{
                                ...this.props.store.uniqueSampleKeyToTumorType,
                                ...(this.state.tumorTypeMapOverride ?? {}),
                            }}
                            rowColorFunc={(d: SimilarMutation) => {
                                switch (d.similarityTag) {
                                    case 'equal':
                                        return styles.bg_comparisonEqual;
                                    case 'gene':
                                        return styles.bg_comparisonGene;
                                    case 'pathway':
                                        return styles.bg_comparisonPathway;
                                    case 'phgvs':
                                        return styles.bg_comparisonPhgvs;
                                    default:
                                        return styles.bg_comparisonUnequal;
                                }
                            }}
                            initialSortColumn={
                                SimilarMutationColumnType.SIMILARITYTAG
                            }
                            referencePatientName={
                                this.props.store.clinicalDataPatient.result.find(
                                    e =>
                                        e.clinicalAttributeId ===
                                        'PATIENT_DISPLAY_NAME'
                                )?.value ?? 'Reference Patient'
                            }
                            selectedPatientName={
                                this.state.selectedSimilarPatient?.name ?? '—'
                            }
                            selectedPatientId={
                                this.state.selectedSimilarPatient?.patient_id ??
                                ''
                            }
                            selectedPatientStudyId={
                                this.state.selectedSimilarPatient?.study_id ??
                                ''
                            }
                            showCountHeader={false}
                            paginationProps={{
                                textBeforeButtons: '',
                                textBetweenButtons: '',
                            }}
                        />
                    </div>

                    <div style={{ height: '1.2cm' }} />

                    {this.state.selectedSimilarPatient &&
                        (() => {
                            const p = this.state.selectedSimilarPatient;
                            const cache = this.state.mtbByPatient?.[
                                p.patient_id
                            ];
                            if (!cache)
                                return <LoadingIndicator isLoading={true} />;
                            const latest = cache.mtbs[0];

                            return (
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '40px',
                                        marginTop: 20,
                                    }}
                                >
                                    <div style={{ flex: 0.5, minWidth: 0 }}>
                                        <div style={sectionTitleStyle}>
                                            Distinct Mutations in Selected
                                            Patient
                                        </div>
                                        <PatientSimilarityMutationTable
                                            data={
                                                this.state
                                                    .distinctSimilarMutations
                                            }
                                            sampleManager1={
                                                this.props.sampleManager
                                            }
                                            sampleToGenePanelId1={
                                                this.props.store
                                                    .sampleToMutationGenePanelId
                                                    .result
                                            }
                                            genePanelIdToEntrezGeneIds1={
                                                this.props.store
                                                    .genePanelIdToEntrezGeneIds
                                                    .result
                                            }
                                            sampleIds1={
                                                this.props.store.sampleIds
                                            }
                                            sampleManager2={
                                                this.props.sampleManager
                                            }
                                            sampleToGenePanelId2={
                                                this.props.store
                                                    .sampleToMutationGenePanelId
                                                    .result
                                            }
                                            genePanelIdToEntrezGeneIds2={
                                                this.props.store
                                                    .genePanelIdToEntrezGeneIds
                                                    .result
                                            }
                                            sampleIds2={
                                                this.props.store.sampleIds
                                            }
                                            columnVisibility={this.getDistinctColumnsVisibility()}
                                            oncoKbData={
                                                this.props.store.oncoKbData
                                            }
                                            oncoKbCancerGenes={
                                                this.props.store
                                                    .oncoKbCancerGenes
                                            }
                                            hotspotData={
                                                this.props.store
                                                    .indexedHotspotData
                                            }
                                            myCancerGenomeData={
                                                this.props.store
                                                    .myCancerGenomeData
                                            }
                                            civicGenes={
                                                this.props.store.civicGenes
                                            }
                                            civicVariants={
                                                this.props.store.civicVariants
                                            }
                                            indexedVariantAnnotations={
                                                this.props.store
                                                    .indexedVariantAnnotations
                                            }
                                            pubMedCache={
                                                this.props.store.pubMedCache
                                            }
                                            usingPublicOncoKbInstance={
                                                this.props.store
                                                    .usingPublicOncoKbInstance
                                            }
                                            studyIdToStudy={
                                                this.props.store.studyIdToStudy
                                                    .result
                                            }
                                            uniqueSampleKeyToTumorType={{
                                                ...this.props.store
                                                    .uniqueSampleKeyToTumorType,
                                                ...(this.state
                                                    .tumorTypeMapOverride ??
                                                    {}),
                                            }}
                                            initialSortColumn={
                                                SimilarMutationColumnType.COMPANNOTATION
                                            }
                                            initialSortDirection="asc"
                                            referencePatientName={
                                                this.props.store.clinicalDataPatient.result.find(
                                                    e =>
                                                        e.clinicalAttributeId ===
                                                        'PATIENT_DISPLAY_NAME'
                                                )?.value ?? 'Reference Patient'
                                            }
                                            selectedPatientName={p.name ?? '—'}
                                            selectedPatientId={
                                                this.state
                                                    .selectedSimilarPatient
                                                    ?.patient_id ?? ''
                                            }
                                            selectedPatientStudyId={
                                                this.state
                                                    .selectedSimilarPatient
                                                    ?.study_id ?? ''
                                            }
                                            showCountHeader={false}
                                            paginationProps={{
                                                textBeforeButtons: '',
                                                textBetweenButtons: '',
                                            }}
                                        />
                                    </div>
                                    <div
                                        className="followUp-table"
                                        style={{ flex: 0.5, minWidth: 0 }}
                                    >
                                        <div style={sectionTitleStyle}>
                                            Therapy Recommendations (MTB)
                                        </div>
                                        <MtbTherapyRecommendationTableNoAddButtons
                                            patientId={p.patient_id}
                                            mutations={p.mutationData}
                                            indexedVariantAnnotations={
                                                undefined
                                            }
                                            indexedMyVariantInfoAnnotations={
                                                undefined
                                            }
                                            cna={[]}
                                            clinicalData={[]}
                                            mutationSignatureData={{}}
                                            sampleManager={
                                                this.props.sampleManager
                                            }
                                            oncoKbAvailable={
                                                getServerConfig().show_oncokb &&
                                                !this.props.store.cnaOncoKbData
                                                    .isError &&
                                                !this.props.store.oncoKbData
                                                    .isError
                                            }
                                            therapyRecommendations={
                                                latest?.therapyRecommendations ??
                                                []
                                            }
                                            otherMtbs={[]}
                                            containerWidth={
                                                WindowStore.size.width - 20
                                            }
                                            isDisabled={true}
                                            showButtons={false}
                                            clinicalTrialClipboard={[]}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                </div>
            );
        }
    }
}
