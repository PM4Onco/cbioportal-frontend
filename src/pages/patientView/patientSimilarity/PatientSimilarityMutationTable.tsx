import * as React from 'react';
import { computed, makeObservable, observable } from 'mobx';
import {
    default as MutationTable,
    IMutationTableProps,
    MutationTableColumn,
    MutationTableColumnType,
    ExtendedMutationTableColumnType,
} from 'shared/components/mutationTable/MutationTable';
import PatientViewMutationTable, {
    IPatientViewMutationTableProps,
    defaultAlleleFrequencyHeaderTooltip,
} from '../mutation/PatientViewMutationTable';
import SampleManager from '../SampleManager';
import { Mutation, Gene } from 'cbioportal-ts-api-client';
import AlleleCountColumnFormatter from 'shared/components/mutationTable/column/AlleleCountColumnFormatter';
import AlleleFreqColumnFormatter from '../mutation/column/AlleleFreqColumnFormatter';
import TumorColumnFormatter from '../mutation/column/TumorColumnFormatter';
import ChromosomeColumnFormatter from 'shared/components/mutationTable/column/ChromosomeColumnFormatter';
import PanelColumnFormatter from 'shared/components/mutationTable/column/PanelColumnFormatter';
import { isUncalled } from 'shared/lib/MutationUtils';
import ExonColumnFormatter from 'shared/components/mutationTable/column/ExonColumnFormatter';
import { getDefaultASCNCopyNumberColumnDefinition } from 'shared/components/mutationTable/column/ascnCopyNumber/ASCNCopyNumberColumnFormatter';
import { getDefaultCancerCellFractionColumnDefinition } from 'shared/components/mutationTable/column/cancerCellFraction/CancerCellFractionColumnFormatter';
import { getDefaultClonalColumnDefinition } from 'shared/components/mutationTable/column/clonal/ClonalColumnFormatter';
import { getDefaultExpectedAltCopiesColumnDefinition } from 'shared/components/mutationTable/column/expectedAltCopies/ExpectedAltCopiesColumnFormatter';
import { ASCNAttributes } from 'shared/enums/ASCNEnums';
import AnnotationHeader, {
    AnnotationHeaderTooltipCard,
    sourceTooltipInfo,
    AnnotationSources,
    LegendTable,
    LegendDescription,
} from 'shared/components/mutationTable/column/annotation/AnnotationHeader';
import _ from 'lodash';
import { createMutationNamespaceColumns } from 'shared/components/mutationTable/MutationTableUtils';
import { getServerConfig } from 'config/config';
import { adjustVisibility } from 'shared/components/alterationsTableUtils';
import { SimilarMutation } from 'shared/api/SimilarPatientsAPI';
import { GeneFilterOption } from '../mutation/GeneFilterMenu';
import LazyMobXTable, {
    Column,
    LazyMobXTableProps,
} from 'shared/components/lazyMobXTable/LazyMobXTable';
import { observer } from 'mobx-react';
import autobind from 'autobind-decorator';
import generalStyles from 'shared/components/mutationTable/column/styles.module.scss';
import styles from './styles.module.scss';
import { Dict } from '../clinicalTrialMatch/ClinicalTrialMatchSelectUtil';
import {
    DefaultTooltip,
    placeArrowBottomLeft,
} from 'cbioportal-frontend-commons';

import AnnotationColumnFormatter, {
    IAnnotationColumnProps,
} from 'shared/components/mutationTable/column/AnnotationColumnFormatter';

import { DEFAULT_ONCOKB_CONTENT_WIDTH } from 'shared/lib/AnnotationColumnUtils';

import { unionCleanPathwaysForMutations } from './PatientSimilarityUtils';

import {
    RemoteData,
    IOncoKbData,
    ICivicGeneIndex,
    ICivicVariantIndex,
    IHotspotIndex,
    ISharedTherapyRecommendationData,
    OncoKbCardDataType,
} from 'cbioportal-utils';
import { CancerGene } from 'oncokb-ts-api-client';
import PubMedCache from 'shared/cache/PubMedCache';
import { VariantAnnotation } from 'genome-nexus-ts-api-client';
import { IMyCancerGenomeData } from 'cbioportal-utils';

import { ButtonGroup, Radio, Tab, Tabs } from 'react-bootstrap';
import classnames from 'classnames';

import {
    levelIconClassNames,
    normalizeLevel,
    oncogenicityIconClassNames,
    OncoKbHelper,
    oncoKbAnnotationDownload,
    OncoKB,
} from 'oncokb-frontend-commons';

import { remoteData } from 'cbioportal-frontend-commons';
import {
    fetchOncoKbCancerGenes,
    fetchOncoKbData,
    ONCOKB_DEFAULT,
} from 'shared/lib/StoreUtils';

import { getPatientViewUrl } from 'shared/api/urls';

import { isTSGForMutation } from './PatientSimilarityUtils';

declare const require: any;

const tcga10PathwaysPaperUrl = 'https://doi.org/10.1016/j.cell.2018.03.035';
const tcga10PathwaysHeaderTooltip = (
    <div style={{ maxWidth: 340 }}>
        Only pathways from the 10 TCGA cancer signaling pathways (Sanchez-Vega
        et al., Cell 2018) were used for comparison.{` `}
        <a href={tcga10PathwaysPaperUrl} target="_blank" rel="noreferrer">
            View paper
        </a>
        .
    </div>
);

enum OncokbTabs {
    ONCOGENIC = 'Oncogenic',
    THERAPEUTIC_LEVELS = 'Therapeutic Levels',
    DIAGNOSTIC_LEVELS = 'Diagnostic Levels',
    PROGNOSTIC_LEVELS = 'Prognostic Levels',
}
const patientGroupHeaderStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
};

const getSelectedPatientGroup = (props: IPatientSimilarityMutationTableProps) =>
    props.selectedPatientId && props.selectedPatientStudyId ? (
        <span style={patientGroupHeaderStyle}>
            Selected Similar Patient{' '}
            <a
                href={getPatientViewUrl(
                    props.selectedPatientStudyId,
                    props.selectedPatientId
                )}
                target="_blank"
                rel="noreferrer"
            >
                {props.selectedPatientName}
            </a>
        </span>
    ) : (
        <span style={patientGroupHeaderStyle}>
            Selected Similar Patient {props.selectedPatientName}
        </span>
    );

const oncokbData: Record<string, LegendDescription[]> = {
    [OncokbTabs.ONCOGENIC]: ([
        'oncogenic',
        'neutral',
        'inconclusive',
        'vus',
        'unknown',
    ] as const).map(k => ({
        legend: <i className={oncogenicityIconClassNames(k)} />,
        description: (
            <span>
                {k === 'oncogenic'
                    ? 'Oncogenic/Likely Oncogenic/Resistance'
                    : k === 'neutral'
                    ? 'Likely Neutral'
                    : k === 'inconclusive'
                    ? 'Inconclusive'
                    : k === 'vus'
                    ? 'VUS'
                    : 'Unknown'}
            </span>
        ),
    })),
    [OncokbTabs.DIAGNOSTIC_LEVELS]: Object.values(OncoKbHelper.DX_LEVELS).map(
        d => ({
            legend: (
                <i className={levelIconClassNames(normalizeLevel(d) || '')} />
            ),
            description: OncoKbHelper.LEVEL_DESC[d],
        })
    ),
    [OncokbTabs.PROGNOSTIC_LEVELS]: Object.values(OncoKbHelper.PX_LEVELS).map(
        d => ({
            legend: (
                <i className={levelIconClassNames(normalizeLevel(d) || '')} />
            ),
            description: OncoKbHelper.LEVEL_DESC[d],
        })
    ),
    [OncokbTabs.THERAPEUTIC_LEVELS]: Object.values(OncoKbHelper.TX_LEVELS).map(
        d => ({
            legend: (
                <i className={levelIconClassNames(normalizeLevel(d) || '')} />
            ),
            description: OncoKbHelper.LEVEL_DESC[d],
        })
    ),
};

const OncokbLegendContent: React.FC = () => (
    <Tabs
        defaultActiveKey={OncokbTabs.ONCOGENIC}
        className={classnames('oncokb-card-tabs')}
        style={{ height: 250, paddingTop: 10 }}
    >
        {Object.values(OncokbTabs).map(tab => (
            <Tab eventKey={tab} title={tab} key={tab}>
                <LegendTable legendDescriptions={oncokbData[tab]} />
            </Tab>
        ))}
    </Tabs>
);

const OncoKbControls: React.FC<{
    mergeIcons?: boolean;
    handleChange?: (mergeIcons: boolean) => void;
}> = ({ mergeIcons, handleChange }) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
        <strong style={{ paddingRight: 5 }}>OncoKB Icon Style: </strong>
        <ButtonGroup>
            <Radio
                checked={!!mergeIcons}
                onChange={() => handleChange?.(true)}
                inline
            >
                Compact
            </Radio>
            <Radio
                checked={!mergeIcons}
                onChange={() => handleChange?.(false)}
                inline
            >
                Expanded
            </Radio>
        </ButtonGroup>
    </div>
);

export interface IPatientSimilarityMutationTableProps
    extends LazyMobXTableProps<SimilarMutation> {
    // general
    data?: SimilarMutation[];

    // reference mutations
    sampleManager1: SampleManager | null;
    sampleToGenePanelId1: { [sampleId: string]: string | undefined };
    genePanelIdToEntrezGeneIds1: { [genePanelId: string]: number[] };
    sampleIds1?: string[];
    referencePatientName: string;

    // comparison mutations
    sampleManager2: SampleManager | null;
    sampleToGenePanelId2: { [sampleId: string]: string | undefined };
    genePanelIdToEntrezGeneIds2: { [genePanelId: string]: number[] };
    sampleIds2?: string[];
    selectedPatientName: string;
    selectedPatientId?: string;
    selectedPatientStudyId?: string;

    // annotations
    hotspotData?: RemoteData<IHotspotIndex | undefined>;
    oncoKbData?: RemoteData<IOncoKbData | Error>;
    oncoKbCancerGenes?: RemoteData<CancerGene[] | Error | undefined>;
    civicGenes?: RemoteData<ICivicGeneIndex | undefined>;
    civicVariants?: RemoteData<ICivicVariantIndex | undefined>;
    myCancerGenomeData?: IMyCancerGenomeData;
    indexedVariantAnnotations?: RemoteData<
        { [loc: string]: VariantAnnotation } | undefined
    >;
    pubMedCache?: PubMedCache;
    usingPublicOncoKbInstance?: boolean;
    mergeOncoKbIcons?: boolean;
    onOncoKbIconToggle?: (mergeIcons: boolean) => void;
    enableRevue?: boolean;
    sharedTherapyRecommendationData?: ISharedTherapyRecommendationData;

    weightTSGAsEqual?: boolean;

    studyIdToStudy?: { [studyId: string]: any };
    uniqueSampleKeyToTumorType?: { [uniqueKey: string]: string };
}

export enum SimilarMutationColumnType {
    SIMILARITYTAG = 'Tag',

    // reference
    CHROM = 'Chrom',
    START = 'Start',
    REF = 'Ref',
    ALT = 'Alt',
    CHGVS = 'HGVSc.',
    PHGVS = 'HGVSp.',
    TRANSCRIPT = 'Transcript',
    GENE = 'Gene',
    PATHWAYS = 'Pathways',
    ANNOTATION = 'Annotation',
    ALLELFREQ = 'AllelFreq',

    // comparison
    COMPCHROM = 'Chrom2',
    COMPSTART = 'Start2',
    COMPREF = 'Ref2',
    COMPALT = 'Alt2',
    COMPCHGVS = 'HGVSc.2',
    COMPPHGVS = 'HGVSp.2',
    COMPTRANSCRIPT = 'Transcript2',
    COMPGENE = 'Gene2',
    COMPPATHWAYS = 'Pathways2',
    COMPANNOTATION = 'Annotation2',
    COMPALLELFREQ = 'AllelFreq2',
}

type MMTooltipState = {
    show: boolean;
    x: number;
    y: number;
};
export type ExtendedColumnType = SimilarMutationColumnType | string;

export class PatientSimilarityMutationTableComponent extends LazyMobXTable<
    SimilarMutation
> {}

@observer
export class PatientSimilarityMutationTable extends React.Component<
    IPatientSimilarityMutationTableProps,
    MMTooltipState
> {
    @observable.ref public table: LazyMobXTable<SimilarMutation> | null = null;
    protected _columns: Record<ExtendedColumnType, Column<SimilarMutation>>;
    private rootRef: React.RefObject<HTMLDivElement> = React.createRef<
        HTMLDivElement
    >();
    private mmHeaderEl?: HTMLElement;
    private getAnnotationProps(): IAnnotationColumnProps {
        const cfg = getServerConfig();

        return {
            // just use OncoKB
            oncoKbData: this.oncoKbDataForSimilarity,
            oncoKbCancerGenes: this.oncoKbCancerGenesForSimilarity,
            hotspotData: undefined,
            myCancerGenomeData: undefined,
            civicGenes: undefined,
            civicVariants: undefined,
            indexedVariantAnnotations: this.props.indexedVariantAnnotations,
            pubMedCache: this.props.pubMedCache,
            studyIdToStudy: this.props.studyIdToStudy,
            uniqueSampleKeyToTumorType: this.props.uniqueSampleKeyToTumorType,
            usingPublicOncoKbInstance: !!this.props.usingPublicOncoKbInstance,

            enableOncoKb: cfg.show_oncokb !== false,
            enableHotspot: false,
            enableMyCancerGenome: false,
            enableCivic: false,
            enableRevue: false,
            enableSharedTR: false,

            sharedTherapyRecommendationData: undefined,

            mergeOncoKbIcons: this.props.mergeOncoKbIcons,
        };
    }

    private readonly oncoKbCancerGenesForSimilarity = remoteData<
        CancerGene[] | Error | undefined
    >({
        invoke: () => {
            const cfg = getServerConfig();
            if (!cfg.show_oncokb) {
                return Promise.resolve([]);
            }
            return fetchOncoKbCancerGenes();
        },
        default: [],
        onError: () => {},
    });

    private readonly mutationDataForSimilarity = remoteData<Mutation[]>({
        invoke: async () => {
            const all: Mutation[] = [];

            (this.props.data || []).forEach(row => {
                if (row.mutations1) {
                    all.push(...(row.mutations1 as Mutation[]));
                }
                if (row.mutations2) {
                    all.push(...(row.mutations2 as Mutation[]));
                }
            });

            return all;
        },
        default: [],
    });

    private readonly uncalledMutationDataForSimilarity = remoteData<Mutation[]>(
        {
            invoke: async () => [],
            default: [],
        }
    );

    private readonly oncoKbDataForSimilarity = remoteData<IOncoKbData | Error>({
        await: () => [
            this.oncoKbCancerGenesForSimilarity,
            this.mutationDataForSimilarity,
            this.uncalledMutationDataForSimilarity,
        ],
        invoke: async () => {
            const cfg = getServerConfig();

            if (!cfg.show_oncokb) {
                return ONCOKB_DEFAULT;
            }

            const cancerGenes = (this.oncoKbCancerGenesForSimilarity.result ||
                []) as CancerGene[];

            const oncoKbAnnotatedGenes: { [entrez: number]: boolean } = {};
            cancerGenes.forEach(g => {
                if (g.entrezGeneId != null) {
                    oncoKbAnnotatedGenes[g.entrezGeneId] = true;
                }
            });

            return fetchOncoKbData(
                this.props.uniqueSampleKeyToTumorType || {},
                oncoKbAnnotatedGenes,
                this.mutationDataForSimilarity,
                undefined,
                this.uncalledMutationDataForSimilarity
            );
        },
        default: ONCOKB_DEFAULT,
        onError: () => {},
    });

    constructor(props: IPatientSimilarityMutationTableProps) {
        super(props);
        this.state = { show: false, x: 0, y: 0 };
        makeObservable(this);
        this._columns = {};
        this.generateColumns();
    }

    private wireMutationMatchingGroupHeader = (): void => {
        const root = this.rootRef.current;
        if (!root) return;

        const headers: NodeListOf<Element> = root.querySelectorAll(
            'th, .group-header, .rt-th, .header, .table-header'
        );
        let target: HTMLElement | undefined;
        headers.forEach((el: Element) => {
            const txt = (el.textContent || '').trim();
            if (txt === 'Mutation Matching Tag') {
                target = el as HTMLElement;
            }
        });
        if (!target) return;

        if (this.mmHeaderEl && this.mmHeaderEl !== target) {
            this.mmHeaderEl.onmouseenter = null;
            this.mmHeaderEl.onmouseleave = null;
            this.mmHeaderEl.onmousemove = null;
        }
        this.mmHeaderEl = target;

        target.style.cursor = 'help';

        target.onmouseenter = () => this.setState({ show: true });
        target.onmouseleave = () => this.setState({ show: false });
        target.onmousemove = (e: MouseEvent) => {
            this.setState({ x: e.clientX + 10, y: e.clientY - 10 });
        };
    };
    // work-around for bigger header font size (for not changing it in mobx-table globally)
    private stylePatientGroupHeaders = (): void => {
        const root = this.rootRef.current;
        if (!root) return;

        const candidates: NodeListOf<HTMLElement> = root.querySelectorAll(
            'th, .group-header, .rt-th, .header, .table-header'
        );

        candidates.forEach(el => {
            // normalisieren: mehrere Whitespaces/Zeilenumbrüche zu einem Space
            const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();

            const isWantedHeader =
                txt.includes('Selected Similar Patient') ||
                txt.includes('Reference Patient') ||
                txt.includes('Mutation Matching Tag');

            if (isWantedHeader) {
                el.style.fontSize = '15px';
                el.style.fontWeight = '600';
            }
        });
    };

    public componentDidMount(): void {
        this.wireMutationMatchingGroupHeader();
        this.stylePatientGroupHeaders();
    }

    public componentDidUpdate(): void {
        this.wireMutationMatchingGroupHeader();
        this.stylePatientGroupHeaders();
    }

    @autobind
    private tableRef(t: LazyMobXTable<SimilarMutation> | null) {
        this.table = t;
    }

    public static defaultProps = {
        ...MutationTable.defaultProps,
        columns: [
            //MutationTableColumnType.COHORT,
            ////MutationTableColumnType.MRNA_EXPR,
            //MutationTableColumnType.COPY_NUM,
            //MutationTableColumnType.ANNOTATION,
            //MutationTableColumnType.CUSTOM_DRIVER,
            //MutationTableColumnType.CUSTOM_DRIVER_TIER,
            //MutationTableColumnType.HGVSG,
            //MutationTableColumnType.REF_READS_N,
            //MutationTableColumnType.VAR_READS_N,
            //MutationTableColumnType.REF_READS,
            //MutationTableColumnType.VAR_READS,
            //MutationTableColumnType.START_POS,
            //MutationTableColumnType.END_POS,
            //MutationTableColumnType.REF_ALLELE,
            //MutationTableColumnType.VAR_ALLELE,
            //MutationTableColumnType.MUTATION_STATUS,
            //MutationTableColumnType.VALIDATION_STATUS,
            //MutationTableColumnType.CENTER,
            //MutationTableColumnType.GENE,
            //MutationTableColumnType.CHROMOSOME,
            //MutationTableColumnType.PROTEIN_CHANGE,
            //MutationTableColumnType.MUTATION_TYPE,
            //MutationTableColumnType.VARIANT_TYPE,
            //MutationTableColumnType.FUNCTIONAL_IMPACT,
            //MutationTableColumnType.COSMIC,
            //MutationTableColumnType.TUMOR_ALLELE_FREQ,
            //MutationTableColumnType.SAMPLES,
            //MutationTableColumnType.EXON,
            //MutationTableColumnType.HGVSC,
            //MutationTableColumnType.GNOMAD,
            //MutationTableColumnType.CLINVAR,
            //MutationTableColumnType.DBSNP,
            //MutationTableColumnType.GENE_PANEL,
            //MutationTableColumnType.SIGNAL,

            SimilarMutationColumnType.SIMILARITYTAG,
            SimilarMutationColumnType.CHROM,
            SimilarMutationColumnType.START,
            //SimilarMutationColumnType.REF,
            //SimilarMutationColumnType.ALT,
        ],
    };

    protected getSamples(): string[] {
        if (this.props.sampleIds1) {
            return this.props.sampleIds1;
        } else {
            return [];
        }
    }

    protected getMutationData(
        similarMutation: SimilarMutation,
        mutations: string
    ): Mutation[] {
        return similarMutation[
            mutations as keyof SimilarMutation
        ] as Mutation[];
    }

    protected getMutationDataString(
        similarMutation: SimilarMutation,
        mutations: string,
        key: string
    ): string | null {
        const data = this.getMutationData(similarMutation, mutations);
        if (data.length > 0) {
            return data[0][key as keyof Mutation] as string;
        }
        return null;
    }

    protected getGeneDataString(
        similarMutation: SimilarMutation,
        mutations: string,
        key: string
    ): string | null {
        const data = this.getMutationData(similarMutation, mutations);
        if (data.length > 0) {
            const gene = data[0].gene as Gene;
            if (gene === undefined) return null;
            return gene[key as keyof Gene] as string;
        }
        return null;
    }

    protected getNamespaceDataString(
        similarMutation: SimilarMutation,
        mutations: string,
        namespace: string,
        namespaceKey: string
    ): string | null {
        const data = this.getMutationData(similarMutation, mutations);
        if (data.length > 0) {
            const namespacecolumns = data[0].namespaceColumns as {
                [key: string]: any;
            };
            if (namespacecolumns === undefined) return null;
            const temp = namespacecolumns[namespace];
            if (temp === undefined) return null;
            return temp[namespaceKey];
        }
        return null;
    }

    protected getSimilarMutationDataTag(
        similarMutation: SimilarMutation
    ): string | null {
        return similarMutation.similarityTag;
    }

    private getAnnotationHeader = () => (
        <div
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                lineHeight: 1.2,
                justifyContent: 'flex-start',
            }}
        >
            <span>Annotation</span>
            <DefaultTooltip
                placement="top"
                overlay={
                    <AnnotationHeaderTooltipCard
                        controls={
                            <OncoKbControls
                                mergeIcons={this.props.mergeOncoKbIcons}
                                handleChange={this.props.onOncoKbIconToggle}
                            />
                        }
                        infoProps={sourceTooltipInfo[AnnotationSources.ONCOKB]}
                        overrideContent={<OncokbLegendContent />}
                    />
                }
            >
                <img
                    src={require('oncokb-styles/images/oncogenic.svg')}
                    style={{ height: 16, width: 16 }}
                />
            </DefaultTooltip>
        </div>
    );

    private findOncoKbIndicator(
        mutations: Mutation[] | undefined,
        which: 'REF' | 'SIM',
        rowIndex: number
    ) {
        const annProps = this.getAnnotationProps();
        const remote = annProps.oncoKbData as
            | RemoteData<IOncoKbData | Error>
            | undefined;

        if (
            !remote ||
            remote.status !== 'complete' ||
            !remote.result ||
            remote.result instanceof Error
        ) {
            return {
                indicator: undefined as any,
                key: undefined as string | undefined,
            };
        }

        const data = remote.result as any;
        const indicatorMap: Record<string, any> =
            data.indicatorMap || data.indicatorMapBySample || {};

        const keys = Object.keys(indicatorMap);

        const muts = mutations || [];
        const m0: any = muts[0];

        const usk: string | undefined = m0.uniqueSampleKey;

        const tumorType =
            (this.props.uniqueSampleKeyToTumorType &&
                usk &&
                this.props.uniqueSampleKeyToTumorType[usk]) ||
            '';

        const proteinChange: string =
            m0.proteinChange || m0.proteinChange || '';

        const tumorKey = (tumorType || '').replace(/ /g, '_');
        const partial = `_${tumorKey}_${proteinChange}_`;

        const key = keys.find(k => k.includes(partial));

        const indicator = key ? indicatorMap[key] : undefined;

        return { indicator, key };
    }

    private renderOncoKbLibIcon(
        muts: Mutation[] | undefined,
        which: 'REF' | 'SIM',
        rowIndex: number
    ) {
        const { indicator } = this.findOncoKbIndicator(muts, which, rowIndex);

        const mutation0 = muts && muts[0];
        const geneSymbol =
            (mutation0 && (mutation0.gene as Gene)?.hugoGeneSymbol) || '';

        const cancerGenesRemote = this.oncoKbCancerGenesForSimilarity;
        const cancerGenes = (cancerGenesRemote.result || []) as
            | CancerGene[]
            | Error
            | undefined;

        let isCancerGene = false;
        if (Array.isArray(cancerGenes) && geneSymbol) {
            isCancerGene = cancerGenes.some(g => g.hugoSymbol === geneSymbol);
        }

        const geneNotExist = !isCancerGene && !indicator;

        const rd = this.oncoKbDataForSimilarity;
        let status: 'pending' | 'error' | 'complete';

        if (rd && rd.isPending) {
            status = 'pending';
        } else if (
            rd &&
            (rd.status === 'error' || rd.result instanceof Error)
        ) {
            status = 'error';
        } else {
            status = 'complete';
        }

        const availableDataTypes = [OncoKbCardDataType.BIOLOGICAL];

        return (
            <OncoKB
                status={status}
                indicator={indicator}
                availableDataTypes={availableDataTypes}
                mergeAnnotationIcons={!!this.props.mergeOncoKbIcons}
                usingPublicOncoKbInstance={
                    !!this.props.usingPublicOncoKbInstance
                }
                isCancerGene={isCancerGene}
                geneNotExist={geneNotExist}
                hugoGeneSymbol={geneSymbol}
                userDisplayName={undefined}
                disableFeedback={true}
                contentPadding={DEFAULT_ONCOKB_CONTENT_WIDTH}
                hasMultipleCancerTypes={true}
            />
        );
    }

    private renderOncoKbCell(indicator: any | undefined, mutation?: Mutation) {
        const hasIndicator = !!indicator && !(indicator as any).error;
        const gene =
            mutation?.gene?.hugoGeneSymbol ||
            indicator?.query?.hugoSymbol ||
            '';
        const proteinChange =
            mutation?.proteinChange || indicator?.query?.alteration || '';
        const tumorTypeFromMap =
            (mutation?.uniqueSampleKey &&
                this.props.uniqueSampleKeyToTumorType &&
                this.props.uniqueSampleKeyToTumorType[
                    mutation.uniqueSampleKey
                ]) ||
            '';
        const tumorType = tumorTypeFromMap || indicator?.query?.tumorType || '';

        const oncogenicity: string | undefined = indicator?.oncogenic;
        const mutationEffectDesc: string | undefined =
            indicator?.mutationEffect?.description ||
            indicator?.mutationEffect?.knownEffect ||
            undefined;
        const geneSummary: string | undefined =
            indicator?.geneSummary || indicator?.variantSummary;

        const hasTx =
            !!indicator?.highestSensitiveLevel ||
            !!indicator?.highestResistanceLevel;
        const hasDx = !!indicator?.highestDxLevel;
        const hasPx = !!indicator?.highestPxLevel;
        let overlay: React.ReactNode;

        if (hasIndicator) {
            overlay = (
                <div
                    style={{
                        maxWidth: 420,
                        fontSize: 12,
                        lineHeight: 1.5,
                        padding: '8px 10px',
                    }}
                >
                    <div
                        style={{
                            fontWeight: 600,
                            marginBottom: 4,
                        }}
                    >
                        {gene} {proteinChange}
                        {tumorType ? ` in ${tumorType}` : null}
                    </div>

                    {oncogenicity && (
                        <div
                            style={{
                                fontWeight: 600,
                                marginBottom: 4,
                            }}
                        >
                            {oncogenicity}
                        </div>
                    )}

                    {mutationEffectDesc && (
                        <div
                            style={{
                                marginTop: 4,
                            }}
                        >
                            {mutationEffectDesc}
                        </div>
                    )}

                    {geneSummary && (
                        <div
                            style={{
                                marginTop: 4,
                            }}
                        >
                            {geneSummary}
                        </div>
                    )}

                    {oncogenicity === 'Oncogenic' && (
                        <div
                            style={{
                                marginTop: 8,
                            }}
                        >
                            The {gene} {proteinChange} mutation is known to be
                            oncogenic.
                        </div>
                    )}

                    {!hasTx && !hasDx && !hasPx && (
                        <div
                            style={{
                                marginTop: 8,
                                fontSize: 11,
                                color: '#555',
                            }}
                        >
                            Therapeutic, diagnostic and prognostic implications
                            are not available in this instance of cBioPortal.
                        </div>
                    )}
                </div>
            );
        } else {
            overlay = (
                <div
                    style={{
                        maxWidth: 320,
                        fontSize: 12,
                        lineHeight: 1.5,
                        padding: '8px 10px',
                    }}
                >
                    <div
                        style={{
                            fontWeight: 600,
                            marginBottom: 4,
                        }}
                    >
                        No OncoKB annotation
                    </div>
                    <div>
                        There is currently no curated OncoKB record for this
                        specific variant and tumor type.
                    </div>
                </div>
            );
        }
        const content = hasIndicator ? (
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                }}
            >
                {indicator.oncogenic && (
                    <i
                        className={oncogenicityIconClassNames(
                            indicator.oncogenic
                        )}
                    />
                )}

                {indicator.highestSensitiveLevel && (
                    <i
                        className={levelIconClassNames(
                            normalizeLevel(indicator.highestSensitiveLevel) ||
                                ''
                        )}
                    />
                )}

                {indicator.highestResistanceLevel && (
                    <i
                        className={levelIconClassNames(
                            normalizeLevel(indicator.highestResistanceLevel) ||
                                ''
                        )}
                    />
                )}
            </span>
        ) : (
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <i className={oncogenicityIconClassNames('unknown')} />
            </span>
        );

        return (
            <DefaultTooltip
                placement="top"
                overlay={overlay}
                trigger={['hover', 'focus']}
                destroyTooltipOnHide={false}
            >
                <span>{content}</span>
            </DefaultTooltip>
        );
    }

    protected getAlleleCounts(
        similarMutation: SimilarMutation,
        mutationsKey: 'mutations1' | 'mutations2'
    ): { alt: number; ref: number } | null {
        const muts = this.getMutationData(similarMutation, mutationsKey);
        if (!muts || muts.length === 0) {
            return null;
        }

        const m: any = muts[0];
        const candidatePairs: Array<[string, string]> = [
            ['t_alt_count', 't_ref_count'],
            ['tumor_alt_count', 'tumor_ref_count'],
            ['tAltCount', 'tRefCount'],
            ['tumorAltCount', 'tumorRefCount'],
        ];

        let altRaw: any = null;
        let refRaw: any = null;

        for (const [altKey, refKey] of candidatePairs) {
            const a = m[altKey];
            const r = m[refKey];
            if (a != null && r != null) {
                altRaw = a;
                refRaw = r;
                break;
            }
        }

        if (altRaw == null || refRaw == null) {
            const keys = Object.keys(m);

            const guessedAltKey = keys.find(
                k => /alt.*count/i.test(k) || /count.*alt/i.test(k)
            );
            const guessedRefKey = keys.find(
                k => /ref.*count/i.test(k) || /count.*ref/i.test(k)
            );

            if (guessedAltKey && guessedRefKey) {
                altRaw = m[guessedAltKey];
                refRaw = m[guessedRefKey];
            }
        }

        if (altRaw == null || refRaw == null) {
            return null;
        }

        const alt = Number(altRaw);
        const ref = Number(refRaw);

        if (!isFinite(alt) || !isFinite(ref) || alt + ref <= 0) {
            return null;
        }

        return { alt, ref };
    }

    protected formatAlleleFrequency(
        counts: { alt: number; ref: number } | null
    ): string {
        if (!counts) {
            return '—';
        }

        const total = counts.alt + counts.ref;
        if (!isFinite(total) || total <= 0) {
            return '—';
        }
        const freq = counts.alt / total;
        return freq.toFixed(2);
    }

    protected renderAlleleFrequencyCell(
        row: SimilarMutation,
        mutationsKey: 'mutations1' | 'mutations2'
    ) {
        const counts = this.getAlleleCounts(row, mutationsKey);
        const label = this.formatAlleleFrequency(counts);

        if (!counts) {
            return <span>{label}</span>;
        }

        const total = counts.alt + counts.ref;
        const freq = counts.alt / total;
        const tooltipText = `${freq.toFixed(2)} (${
            counts.alt
        } variant reads out of ${total} total)`;

        return (
            <DefaultTooltip
                placement="top"
                overlay={tooltipText}
                trigger={['hover', 'focus']}
                destroyTooltipOnHide={false}
            >
                <span>{label}</span>
            </DefaultTooltip>
        );
    }

    protected getAlleleFrequencySortValue(
        row: SimilarMutation,
        mutationsKey: 'mutations1' | 'mutations2'
    ): number {
        const counts = this.getAlleleCounts(row, mutationsKey);
        if (!counts) return -1;
        const total = counts.alt + counts.ref;
        return total > 0 ? counts.alt / total : -1;
    }

    protected getAlleleFrequencyDownloadValue(
        row: SimilarMutation,
        mutationsKey: 'mutations1' | 'mutations2'
    ): string {
        const counts = this.getAlleleCounts(row, mutationsKey);
        if (!counts) return '';
        const total = counts.alt + counts.ref;
        if (!isFinite(total) || total <= 0) return '';
        return String(counts.alt / total);
    }

    private extractPathwaysFromMutationsKey(
        row: SimilarMutation,
        mutationsKey: 'mutations1' | 'mutations2'
    ): string[] {
        const muts = (this.getMutationData(row, mutationsKey) || []) as any[];
        return unionCleanPathwaysForMutations(muts);
    }

    private getOncoKbSortCategoryForSimilar(row: SimilarMutation): number {
        const muts = this.getMutationData(row, 'mutations2') as
            | Mutation[]
            | undefined;
        const { indicator } = this.findOncoKbIndicator(muts, 'SIM', 0);

        const hasIndicator = !!indicator && !(indicator as any).error;
        const oncogenic: string | undefined = indicator?.oncogenic;
        const unknownOncogenic =
            !!oncogenic && /unknown/i.test(String(oncogenic));

        const hasPathway =
            this.extractPathwaysFromMutationsKey(row, 'mutations2').length > 0;

        if (hasIndicator && !unknownOncogenic) {
            return 0;
        }
        if (hasPathway) {
            return 1;
        }
        if (hasIndicator && unknownOncogenic) {
            return 2;
        }
        return 3;
    }

    protected generateColumns() {
        const referencePatientGroup = `Reference Patient ${this.props.referencePatientName}`;
        const selectedPatientGroup = getSelectedPatientGroup(this.props) as any;
        this._columns[SimilarMutationColumnType.ANNOTATION] = {
            name: SimilarMutationColumnType.ANNOTATION,
            headerRender: () => this.getAnnotationHeader(),
            render: (row: SimilarMutation, rowIndex: number) => {
                const muts = this.getMutationData(row, 'mutations1') as
                    | Mutation[]
                    | undefined;
                return this.renderOncoKbLibIcon(muts, 'REF', rowIndex);
            },
            group: referencePatientGroup,
            visible: true,
            align: 'left',
        };

        // === Similar-Patient: OncoKB Annotation ===
        this._columns[SimilarMutationColumnType.COMPANNOTATION] = {
            name: SimilarMutationColumnType.COMPANNOTATION,
            headerRender: () => this.getAnnotationHeader(),
            render: (row: SimilarMutation, rowIndex: number) => {
                const muts = this.getMutationData(row, 'mutations2') as
                    | Mutation[]
                    | undefined;
                return this.renderOncoKbLibIcon(muts, 'SIM', rowIndex);
            },
            sortBy: (row: SimilarMutation) =>
                this.getOncoKbSortCategoryForSimilar(row),
            group: selectedPatientGroup,
            visible: true,
            align: 'left',
        };

        this._columns[SimilarMutationColumnType.SIMILARITYTAG] = {
            name: SimilarMutationColumnType.SIMILARITYTAG,
            render: d => {
                const isGeneTag = d.similarityTag === 'gene';
                const muts: any[] = Array.isArray((d as any).mutations1)
                    ? ((d as any).mutations1 as any[])
                    : [];
                const first = muts.length ? muts[0] : undefined;
                const isTSG = first ? isTSGForMutation(first) : false;

                const showTsgDot =
                    Boolean(this.props.weightTSGAsEqual) && isGeneTag && isTSG;

                return (
                    <div
                        style={{
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <span>{d.similarityTag ?? '—'}</span>

                        {showTsgDot && (
                            <DefaultTooltip
                                placement="top"
                                overlay={
                                    <div style={{ maxWidth: 340 }}>
                                        Tumor suppressor gene (TSG). With the
                                        corresponding option enabled, gene-level
                                        matches in TSGs are weighted as exact
                                        matches in the similarity score,
                                        reflecting that loss-of- function
                                        alterations in tumor suppressors are
                                        often less dependent on the precise
                                        mutational position.
                                    </div>
                                }
                                trigger={['hover', 'focus']}
                                destroyTooltipOnHide={false}
                            >
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: '#d9534f',
                                        cursor: 'help',
                                    }}
                                />
                            </DefaultTooltip>
                        )}
                    </div>
                );
            },
            sortBy: d => {
                const rank: Record<string, number> = {
                    equal: 2,
                    gene: 1,
                    pathway: 0,
                };
                return rank[d.similarityTag || ''] ?? 99;
            },
            visible: true,
            align: 'left',
            group: 'Mutation Matching Tag',
        };

        // reference mutation
        this._columns[SimilarMutationColumnType.CHROM] = {
            name: SimilarMutationColumnType.CHROM,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(d, 'mutations1', 'chr')}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: referencePatientGroup,
        };
        this._columns[SimilarMutationColumnType.START] = {
            name: SimilarMutationColumnType.START,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations1',
                            'startPosition'
                        )}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: referencePatientGroup,
        };
        /*this._columns[SimilarMutationColumnType.REF] = {
            name: SimilarMutationColumnType.REF,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations1',
                            'referenceAllele'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'left',
            group: referencePatientGroup,
        };
        this._columns[SimilarMutationColumnType.ALT] = {
            name: SimilarMutationColumnType.ALT,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations1',
                            'variantAllele'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'left',
            group: referencePatientGroup,
        };*/
        this._columns[SimilarMutationColumnType.CHGVS] = {
            name: SimilarMutationColumnType.CHGVS,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations1',
                            'aminoAcidChange'
                        )}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: referencePatientGroup,
        };
        this._columns[SimilarMutationColumnType.PHGVS] = {
            name: SimilarMutationColumnType.PHGVS,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations1',
                            'proteinChange'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'left',
            group: referencePatientGroup,
        };
        this._columns[SimilarMutationColumnType.TRANSCRIPT] = {
            name: SimilarMutationColumnType.TRANSCRIPT,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations1',
                            'refseqMrnaId'
                        )}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: referencePatientGroup,
        };
        this._columns[SimilarMutationColumnType.GENE] = {
            name: SimilarMutationColumnType.GENE,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getGeneDataString(
                            d,
                            'mutations1',
                            'hugoGeneSymbol'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'left',
            group: referencePatientGroup,
        };
        this._columns[SimilarMutationColumnType.PATHWAYS] = {
            name: SimilarMutationColumnType.PATHWAYS,
            headerRender: () => (
                <DefaultTooltip
                    placement="top"
                    overlay={tcga10PathwaysHeaderTooltip}
                    trigger={['hover', 'focus']}
                    destroyTooltipOnHide={false}
                >
                    <span>Pathways</span>
                </DefaultTooltip>
            ),
            render: (d: SimilarMutation) => {
                const unique = this.extractPathwaysFromMutationsKey(
                    d,
                    'mutations1'
                );
                return unique.length ? <div>{unique.join(', ')}</div> : <div />;
            },
            visible: true,
            align: 'left',
            group: referencePatientGroup,
        };

        this._columns[SimilarMutationColumnType.ALLELFREQ] = {
            name: SimilarMutationColumnType.ALLELFREQ,
            headerRender: () => (
                <DefaultTooltip
                    placement="top"
                    overlay={defaultAlleleFrequencyHeaderTooltip}
                    trigger={['hover', 'focus']}
                    destroyTooltipOnHide={false}
                >
                    <span>Allele Freq</span>
                </DefaultTooltip>
            ),
            render: (row: SimilarMutation) =>
                this.renderAlleleFrequencyCell(row, 'mutations1'),
            sortBy: (row: SimilarMutation) =>
                this.getAlleleFrequencySortValue(row, 'mutations1'),
            download: (row: SimilarMutation) =>
                this.getAlleleFrequencyDownloadValue(row, 'mutations1'),
            visible: true,
            align: 'left',
            group: referencePatientGroup,
        };

        // comparison mutation
        this._columns[SimilarMutationColumnType.COMPCHROM] = {
            name: SimilarMutationColumnType.COMPCHROM,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(d, 'mutations2', 'chr')}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: selectedPatientGroup,
        };

        this._columns[SimilarMutationColumnType.COMPSTART] = {
            name: SimilarMutationColumnType.COMPSTART,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations2',
                            'startPosition'
                        )}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: selectedPatientGroup,
        };
        this._columns[SimilarMutationColumnType.COMPREF] = {
            name: SimilarMutationColumnType.COMPREF,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations2',
                            'referenceAllele'
                        )}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: selectedPatientGroup,
        };
        this._columns[SimilarMutationColumnType.COMPALT] = {
            name: SimilarMutationColumnType.COMPALT,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations2',
                            'variantAllele'
                        )}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: selectedPatientGroup,
        };
        this._columns[SimilarMutationColumnType.COMPCHGVS] = {
            name: SimilarMutationColumnType.COMPCHGVS,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations2',
                            'aminoAcidChange'
                        )}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: selectedPatientGroup,
        };
        this._columns[SimilarMutationColumnType.COMPPHGVS] = {
            name: SimilarMutationColumnType.COMPPHGVS,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations2',
                            'proteinChange'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'left',
            group: selectedPatientGroup,
        };
        this._columns[SimilarMutationColumnType.COMPTRANSCRIPT] = {
            name: SimilarMutationColumnType.COMPTRANSCRIPT,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations2',
                            'refseqMrnaId'
                        )}
                    </div>
                );
            },
            visible: false,
            align: 'left',
            group: selectedPatientGroup,
        };
        this._columns[SimilarMutationColumnType.COMPGENE] = {
            name: SimilarMutationColumnType.COMPGENE,
            render: (d: SimilarMutation, i: number) => {
                //gene -> hugoGeneSymbol
                return (
                    <div>
                        {this.getGeneDataString(
                            d,
                            'mutations2',
                            'hugoGeneSymbol'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'left',
            group: selectedPatientGroup,
        };
        this._columns[SimilarMutationColumnType.COMPPATHWAYS] = {
            name: SimilarMutationColumnType.COMPPATHWAYS,
            headerRender: () => (
                <DefaultTooltip
                    placement="top"
                    overlay={tcga10PathwaysHeaderTooltip}
                    trigger={['hover', 'focus']}
                    destroyTooltipOnHide={false}
                >
                    <span>Pathways</span>
                </DefaultTooltip>
            ),
            render: (d: SimilarMutation) => {
                const unique = this.extractPathwaysFromMutationsKey(
                    d,
                    'mutations2'
                );
                return unique.length ? <div>{unique.join(', ')}</div> : <div />;
            },
            visible: true,
            align: 'left',
            group: selectedPatientGroup,
        };

        this._columns[SimilarMutationColumnType.COMPALLELFREQ] = {
            name: SimilarMutationColumnType.COMPALLELFREQ,
            headerRender: () => (
                <DefaultTooltip
                    placement="top"
                    overlay={defaultAlleleFrequencyHeaderTooltip}
                    trigger={['hover', 'focus']}
                    destroyTooltipOnHide={false}
                >
                    <span>Allele Freq</span>
                </DefaultTooltip>
            ),
            render: (row: SimilarMutation) =>
                this.renderAlleleFrequencyCell(row, 'mutations2'),
            sortBy: (row: SimilarMutation) =>
                this.getAlleleFrequencySortValue(row, 'mutations2'),
            download: (row: SimilarMutation) =>
                this.getAlleleFrequencyDownloadValue(row, 'mutations2'),
            visible: true,
            align: 'left',
            group: selectedPatientGroup,
        };

        // order columns
        this._columns[SimilarMutationColumnType.SIMILARITYTAG].order = 5;

        this._columns[SimilarMutationColumnType.GENE].order = 10;
        this._columns[SimilarMutationColumnType.PHGVS].order = 15;
        this._columns[SimilarMutationColumnType.ANNOTATION].order = 18;
        this._columns[SimilarMutationColumnType.CHROM].order = 20;
        this._columns[SimilarMutationColumnType.ALLELFREQ].order = 25;
        this._columns[SimilarMutationColumnType.PATHWAYS].order = 30;
        this._columns[SimilarMutationColumnType.START].order = 35;
        this._columns[SimilarMutationColumnType.CHGVS].order = 45;
        this._columns[SimilarMutationColumnType.TRANSCRIPT].order = 50;
        //this._columns[SimilarMutationColumnType.REF].order       = 55;
        //this._columns[SimilarMutationColumnType.ALT].order       = 60;

        // ── Selected Similar Patient (ab 100, 5er-Schritte)
        this._columns[SimilarMutationColumnType.COMPGENE].order = 100;
        this._columns[SimilarMutationColumnType.COMPPHGVS].order = 105;
        this._columns[SimilarMutationColumnType.COMPANNOTATION].order = 108;
        this._columns[SimilarMutationColumnType.COMPCHROM].order = 115;
        this._columns[SimilarMutationColumnType.COMPALLELFREQ].order = 118;
        this._columns[SimilarMutationColumnType.COMPPATHWAYS].order = 119;
        this._columns[SimilarMutationColumnType.COMPSTART].order = 120;
        //this._columns[SimilarMutationColumnType.COMPREF].order = 125;
        //this._columns[SimilarMutationColumnType.COMPALT].order = 130;
        this._columns[SimilarMutationColumnType.COMPCHGVS].order = 135;
        this._columns[SimilarMutationColumnType.COMPTRANSCRIPT].order = 140;
    }

    private buildColumns(): Column<SimilarMutation>[] {
        this._columns = {} as any;
        this.generateColumns();
        return _.values(this._columns);
    }

    public render() {
        return (
            <div
                ref={this.rootRef}
                className="oncokb"
                style={{ position: 'relative' }}
            >
                <PatientSimilarityMutationTableComponent
                    className={styles.MutationSimilarityTable}
                    ref={this.tableRef}
                    columns={this.buildColumns()}
                    data={this.props.data}
                    dataStore={this.props.dataStore}
                    downloadDataFetcher={this.props.downloadDataFetcher}
                    initialItemsPerPage={this.props.initialItemsPerPage}
                    initialSortColumn={this.props.initialSortColumn}
                    initialSortDirection={this.props.initialSortDirection}
                    itemsLabel={this.props.itemsLabel}
                    itemsLabelPlural={this.props.itemsLabelPlural}
                    paginationProps={this.props.paginationProps}
                    showCountHeader={this.props.showCountHeader}
                    columnVisibility={this.props.columnVisibility}
                    columnVisibilityProps={this.props.columnVisibilityProps}
                    storeColumnVisibility={this.props.storeColumnVisibility}
                    onRowClick={this.props.onRowClick}
                    onRowMouseEnter={this.props.onRowMouseEnter}
                    onRowMouseLeave={this.props.onRowMouseLeave}
                    columnToHeaderFilterIconModal={
                        this.props.columnToHeaderFilterIconModal
                    }
                    deactivateColumnFilter={this.props.deactivateColumnFilter}
                    customControls={this.props.customControls}
                    showCopyDownload={false}
                    rowColorFunc={this.props.rowColorFunc}
                />
                {this.state.show && (
                    <div
                        style={{
                            position: 'fixed',
                            top: this.state.y,
                            left: this.state.x,
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            padding: '10px 12px',
                            fontSize: '14px',
                            lineHeight: 1.35,
                            borderRadius: 8,
                            boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                            pointerEvents: 'none',
                            zIndex: 9999,
                            maxWidth: 360,
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>
                            Tag meanings
                        </div>
                        <div>
                            <b>equal</b>: same gene <i>and</i> same protein
                            change
                        </div>
                        <div>
                            <b>gene</b>: same gene, different protein change
                        </div>
                        <div>
                            <b>pathway</b>: genes are in the same pathway
                        </div>
                    </div>
                )}
            </div>
        );
    }
}
