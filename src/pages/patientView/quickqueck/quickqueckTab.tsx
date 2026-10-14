import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action, computed, makeObservable } from 'mobx';
import {
    Mutation,
    DiscreteCopyNumberData,
    StructuralVariant,
} from 'cbioportal-ts-api-client';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import LazyMobXTable from 'shared/components/lazyMobXTable/LazyMobXTable';
import { CollapsibleTreeSelect } from './CollapsibleTreeSelect';
import { buildQuickqueckColumns } from './utils/quickqueckColumns';
import { getQuickqueckData } from './utils/quickqueckAPIQuery';
import {
    PHASE_FILTER_MAP,
    PHASE_FILTER_OPTIONS,
    collectDescendantIds,
} from './utils/quickqueckLookups';
import {
    QuickqueckData,
    QuickqueckLookupEntry,
    QuickqueckStudy,
} from './utils/quickqueckTypes';

type QuickqueckTabProps = {
    mutations?: Mutation[][];
    copyNumberAlterations?: DiscreteCopyNumberData[][];
    structuralVariants?: StructuralVariant[];
};

/** Filter facets that a study-level predicate can be asked to ignore. */
type QuickqueckFacet = 'center' | 'entity' | 'phase' | 'therapyLine';

@observer
export default class QuickqueckTab extends React.Component<QuickqueckTabProps> {
    @observable private data: QuickqueckData | null = null;
    @observable private isLoading = true;
    @observable private error: string | null = null;

    @observable private selectedCenters = new Set<number>();
    @observable private selectedEntities = new Set<number>();
    @observable private selectedPhases = new Set<string>();
    @observable private selectedTherapyLines = new Set<number>();
    @observable private patientAge: number | null = null;
    @observable private selectedMutations = new Set<string>();
    @observable private mutationDropdownOpen = false;

    @observable filterByPatientMutations = true;

    @action.bound
    togglePatientMutationFilter(): void {
        this.filterByPatientMutations = !this.filterByPatientMutations;
    }

    constructor(props: QuickqueckTabProps) {
        super(props);
        makeObservable(this);
    }

    componentDidMount() {
        this.loadData();
    }

    @action
    private async loadData() {
        this.isLoading = true;
        this.error = null;
        try {
            this.data = await getQuickqueckData();
        } catch (e) {
            this.error = e?.message ?? 'Unknown error loading quickqueck data.';
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Study-level predicate for all active filters. `ignoreFacet` skips one
     * facet, which is what makes the other facets' counts update live.
     */
    private studyMatchesFilters(
        s: QuickqueckStudy,
        ignoreFacet: QuickqueckFacet | null
    ): boolean {
        if (!this.data) return false;
        const { ageRangeMap } = this.data;

        const expandedEntityIds = this.expandedSelectedEntityIds;
        const patientGeneList = this.genomicSuggestions.map(suggestion =>
            suggestion.trim()
        );

        if (
            ignoreFacet !== 'center' &&
            this.selectedCenters.size > 0 &&
            !this.selectedCenters.has(s.group)
        ) {
            return false;
        }

        if (
            ignoreFacet !== 'entity' &&
            this.selectedEntities.size > 0 &&
            !expandedEntityIds.has(s.entity)
        ) {
            return false;
        }

        if (ignoreFacet !== 'phase' && this.selectedPhases.size > 0) {
            const phaseMatches =
                s.phase !== null &&
                Array.from(this.selectedPhases).some(label =>
                    PHASE_FILTER_MAP[label]?.has(s.phase!)
                );
            if (!phaseMatches) return false;
        }

        if (
            ignoreFacet !== 'therapyLine' &&
            this.selectedTherapyLines.size > 0 &&
            !this.selectedTherapyLines.has(s.therapy_line)
        ) {
            return false;
        }

        if (this.patientAge !== null) {
            const range = ageRangeMap[s.age_group];
            if (range) {
                if (range.min !== null && this.patientAge < range.min) {
                    return false;
                }
                if (range.max !== null && this.patientAge > range.max) {
                    return false;
                }
            }
        }

        const criteria = s.criteria ?? '';
        if (
            this.filterByPatientMutations &&
            patientGeneList.length > 0 &&
            !patientGeneList.some(gene => criteria.includes(gene))
        ) {
            return false;
        }

        // Filter by selected mutations from the dropdown (OR logic: at least one must match)
        if (this.selectedMutations.size > 0) {
            return Array.from(this.selectedMutations).some(mutation =>
                criteria.includes(mutation)
            );
        }

        return true;
    }

    @computed get filteredStudies(): QuickqueckStudy[] {
        if (!this.data) return [];
        return this.data.studies.filter(s => this.studyMatchesFilters(s, null));
    }

    /** Selecting a parent entity also matches every descendant entity. */
    @computed private get expandedSelectedEntityIds(): Set<number> {
        const expandedEntityIds = new Set<number>();
        if (!this.data || this.selectedEntities.size === 0) {
            return expandedEntityIds;
        }

        const expand = (entries: QuickqueckLookupEntry[]) => {
            for (const entry of entries) {
                if (this.selectedEntities.has(entry.id)) {
                    for (const id of collectDescendantIds(entry)) {
                        expandedEntityIds.add(id);
                    }
                }
                if (entry.children) expand(entry.children);
            }
        };
        expand(this.data.rawEntities);

        return expandedEntityIds;
    }

    /**
     * Faceted counts: for each option of one facet, the number of studies
     * matching all active filters except that facet's own selections.
     * The other facet variants below follow the same pattern.
     */
    @computed get centerFacetCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        for (const s of this.data.studies) {
            if (this.studyMatchesFilters(s, 'center')) {
                map[s.group] = (map[s.group] ?? 0) + 1;
            }
        }
        return map;
    }

    @computed get entityFacetCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        for (const s of this.data.studies) {
            if (this.studyMatchesFilters(s, 'entity')) {
                map[s.entity] = (map[s.entity] ?? 0) + 1;
            }
        }
        return map;
    }

    /** Phase labels are canonical UI filters that may match several API IDs. */
    @computed get phaseEntries(): QuickqueckLookupEntry[] {
        if (!this.data) return [];
        const presentPhaseIds = new Set(
            this.data.studies
                .map(s => s.phase)
                .filter((p): p is number => p !== null)
        );

        return PHASE_FILTER_OPTIONS.map((label, idx) => ({ label, idx }))
            .filter(({ label }) =>
                [...(PHASE_FILTER_MAP[label] ?? [])].some(id =>
                    presentPhaseIds.has(id)
                )
            )
            .map(({ label, idx }) => ({ id: idx, name: label }));
    }

    @computed get phaseFacetCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        PHASE_FILTER_OPTIONS.forEach((_, idx) => (map[idx] = 0));
        for (const s of this.data.studies) {
            if (!this.studyMatchesFilters(s, 'phase') || s.phase === null) {
                continue;
            }
            PHASE_FILTER_OPTIONS.forEach((label, idx) => {
                if (PHASE_FILTER_MAP[label]?.has(s.phase!)) map[idx]++;
            });
        }
        return map;
    }

    @computed get selectedPhaseIndices(): Set<number> {
        return new Set(
            Array.from(this.selectedPhases)
                .map(label => PHASE_FILTER_OPTIONS.indexOf(label))
                .filter(i => i >= 0)
        );
    }

    @computed get therapyLineEntries(): QuickqueckLookupEntry[] {
        if (!this.data) return [];
        return Array.from(new Set(this.data.studies.map(s => s.therapy_line)))
            .map(id => ({
                id,
                name: this.data!.therapyLineMap[id] ?? String(id),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    @computed get therapyLineFacetCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        for (const s of this.data.studies) {
            if (this.studyMatchesFilters(s, 'therapyLine')) {
                map[s.therapy_line] = (map[s.therapy_line] ?? 0) + 1;
            }
        }
        return map;
    }

    /** Mutation suggestions are derived from patient mutations in gene and protein-change form. */
    @computed get genomicSuggestions(): string[] {
        const {
            mutations,
            copyNumberAlterations,
            structuralVariants,
        } = this.props;

        const suggestions = new Set<string>();

        // Mutations
        for (const group of mutations ?? []) {
            for (const mutation of group) {
                const gene = mutation.gene?.hugoGeneSymbol;

                if (!gene) continue;

                suggestions.add(gene);

                if (mutation.proteinChange) {
                    suggestions.add(`${gene} ${mutation.proteinChange}`);
                }
            }
        }

        // Copy-number alterations
        for (const cnaGroup of copyNumberAlterations ?? []) {
            for (const cna of cnaGroup) {
                console.log({
                    gene: cna.gene?.hugoGeneSymbol,
                    alteration: cna.alteration,
                    patientId: cna.patientId,
                    sampleId: cna.sampleId,
                });
                const gene = cna.gene?.hugoGeneSymbol;

                if (gene && (cna.alteration === 2 || cna.alteration === -2)) {
                    suggestions.add(gene);
                }
            }
        }

        // Structural variants: beide Fusions-/Breakpoint-Partner
        for (const sv of structuralVariants ?? []) {
            for (const gene of [sv.site1HugoSymbol, sv.site2HugoSymbol]) {
                if (gene) {
                    suggestions.add(gene);
                }
            }
        }

        return Array.from(suggestions).sort();
    }

    /** Mutations and genes that are found in at least one trial's criteria text. */
    @computed get availableMutationsInTrials(): string[] {
        if (!this.data) return [];

        const allMutationsInTrials = new Set<string>();

        for (const study of this.data.studies) {
            const criteria = study.criteria ?? '';
            // For each patient mutation, check if it appears in the trial
            for (const mutation of this.genomicSuggestions) {
                if (criteria.includes(mutation)) {
                    allMutationsInTrials.add(mutation);
                }
            }
        }

        return Array.from(allMutationsInTrials).sort();
    }

    @action.bound
    private onCenterToggle(id: number) {
        this.selectedCenters = this.toggleSelectedId(this.selectedCenters, id);
    }

    @action.bound
    private onEntityToggle(id: number) {
        this.selectedEntities = this.toggleSelectedId(
            this.selectedEntities,
            id
        );
    }

    @action.bound
    private onPhaseToggle(id: number) {
        const label = PHASE_FILTER_OPTIONS[id];
        if (!label) return;

        const next = new Set(this.selectedPhases);
        if (next.has(label)) next.delete(label);
        else next.add(label);
        this.selectedPhases = next;
    }

    @action.bound
    private onTherapyLineToggle(id: number) {
        this.selectedTherapyLines = this.toggleSelectedId(
            this.selectedTherapyLines,
            id
        );
    }

    @action.bound
    private onPatientAgeChange(e: React.ChangeEvent<HTMLInputElement>) {
        const val = e.target.value;
        this.patientAge = val === '' ? null : parseInt(val, 10);
    }

    @action.bound
    private clearAllFilters() {
        this.selectedCenters = new Set();
        this.selectedEntities = new Set();
        this.selectedPhases = new Set();
        this.selectedTherapyLines = new Set();
        this.patientAge = null;
        this.filterByPatientMutations = false;
        this.selectedMutations = new Set();
    }

    private toggleSelectedId(
        selectedIds: Set<number>,
        id: number
    ): Set<number> {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    }

    private renderFilterBar() {
        const hasAnyFilter =
            this.selectedCenters.size > 0 ||
            this.selectedEntities.size > 0 ||
            this.selectedPhases.size > 0 ||
            this.selectedTherapyLines.size > 0 ||
            this.patientAge !== null ||
            this.selectedMutations.size > 0;

        const total = this.data?.studies.length ?? 0;
        const shown = this.filteredStudies.length;

        return (
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    gap: '12px',
                    marginBottom: '16px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Center
                    </label>
                    {this.data && (
                        <CollapsibleTreeSelect
                            entries={this.data.rawClinicsAsEntries}
                            presentIds={
                                new Set(this.data.studies.map(s => s.group))
                            }
                            selectedIds={this.selectedCenters}
                            onToggle={this.onCenterToggle}
                            countMap={this.centerFacetCountMap}
                        />
                    )}
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Entity
                    </label>
                    {this.data && (
                        <CollapsibleTreeSelect
                            entries={this.data.rawEntities}
                            presentIds={
                                new Set(this.data.studies.map(s => s.entity))
                            }
                            selectedIds={this.selectedEntities}
                            onToggle={this.onEntityToggle}
                            countMap={this.entityFacetCountMap}
                        />
                    )}
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Therapy Line
                    </label>
                    <CollapsibleTreeSelect
                        entries={this.therapyLineEntries}
                        presentIds={
                            new Set(this.therapyLineEntries.map(e => e.id))
                        }
                        selectedIds={this.selectedTherapyLines}
                        onToggle={this.onTherapyLineToggle}
                        countMap={this.therapyLineFacetCountMap}
                    />
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Phase
                    </label>
                    <CollapsibleTreeSelect
                        entries={this.phaseEntries}
                        presentIds={new Set(this.phaseEntries.map(e => e.id))}
                        selectedIds={this.selectedPhaseIndices}
                        onToggle={this.onPhaseToggle}
                        countMap={this.phaseFacetCountMap}
                    />
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Patient Age
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={120}
                        placeholder="Any"
                        value={this.patientAge ?? ''}
                        onChange={this.onPatientAgeChange}
                        style={{
                            width: 80,
                            padding: '6px 8px',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            fontSize: '0.95em',
                        }}
                    />
                </div>
                {this.renderMutationFilter()}

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        gap: '4px',
                    }}
                >
                    <button
                        type="button"
                        className="btn btn-sm btn-default"
                        onClick={this.togglePatientMutationFilter}
                        disabled={this.genomicSuggestions.length === 0}
                    >
                        {this.filterByPatientMutations
                            ? 'Show all trials'
                            : 'Filter by patient mutations'}
                    </button>
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        gap: '4px',
                    }}
                >
                    {hasAnyFilter && (
                        <button
                            className="btn btn-sm btn-default"
                            onClick={this.clearAllFilters}
                        >
                            Clear all filters
                        </button>
                    )}
                </div>
                <small style={{ color: '#666', whiteSpace: 'nowrap' }}>
                    {shown} / {total} studies
                </small>
            </div>
        );
    }

    private renderMutationFilter() {
        const hasAvailableMutations =
            this.availableMutationsInTrials.length > 0;

        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    position: 'relative',
                }}
            >
                <label
                    style={{
                        marginBottom: 0,
                        fontWeight: 600,
                        fontSize: '0.85em',
                    }}
                >
                    Mutation Filter
                </label>
                {!hasAvailableMutations ? (
                    <div
                        style={{
                            padding: '6px 8px',
                            fontSize: '0.9em',
                            color: '#999',
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            background: '#f9f9f9',
                        }}
                    >
                        No Patient Mutations found in any QuickQueck Trial
                    </div>
                ) : (
                    <>
                        {/* Selected mutations displayed as cards */}
                        {this.selectedMutations.size > 0 && (
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '6px',
                                    marginBottom: '6px',
                                }}
                            >
                                {Array.from(this.selectedMutations).map(
                                    mutation => (
                                        <div
                                            key={mutation}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 8px',
                                                background: '#e3f2fd',
                                                border: '1px solid #90caf9',
                                                borderRadius: 4,
                                                fontSize: '0.9em',
                                            }}
                                        >
                                            <span>{mutation}</span>
                                            <button
                                                type="button"
                                                onClick={action(() => {
                                                    const next = new Set(
                                                        this.selectedMutations
                                                    );
                                                    next.delete(mutation);
                                                    this.selectedMutations = next;
                                                })}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    color: '#1976d2',
                                                    fontSize: '1.2em',
                                                    lineHeight: 1,
                                                }}
                                                title="Remove filter"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {/* Dropdown button */}
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={action(() => {
                                    this.mutationDropdownOpen = !this
                                        .mutationDropdownOpen;
                                })}
                                style={{
                                    padding: '6px 12px',
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                    background: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '0.9em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    minWidth: 150,
                                }}
                            >
                                Add mutation{' '}
                                {this.selectedMutations.size > 0 &&
                                    `(${this.selectedMutations.size})`}
                                <span style={{ marginLeft: 'auto' }}>▼</span>
                            </button>

                            {this.mutationDropdownOpen &&
                                this.renderGenomicSuggestions()}
                        </div>
                    </>
                )}
            </div>
        );
    }

    private renderGenomicSuggestions() {
        return (
            <>
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9998,
                    }}
                    onClick={action(() => {
                        this.mutationDropdownOpen = false;
                    })}
                />
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 9999,
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        maxHeight: 240,
                        overflowY: 'auto',
                        minWidth: 200,
                        marginTop: 2,
                    }}
                >
                    {this.availableMutationsInTrials.map(mutation => (
                        <div
                            key={mutation}
                            onClick={action(() => {
                                const next = new Set(this.selectedMutations);
                                if (next.has(mutation)) {
                                    next.delete(mutation);
                                } else {
                                    next.add(mutation);
                                }
                                this.selectedMutations = next;
                            })}
                            style={{
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '0.9em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: this.selectedMutations.has(mutation)
                                    ? '#e3f2fd'
                                    : '#fff',
                            }}
                            onMouseEnter={e =>
                                (e.currentTarget.style.background = this.selectedMutations.has(
                                    mutation
                                )
                                    ? '#bbdefb'
                                    : '#f5f5f5')
                            }
                            onMouseLeave={e =>
                                (e.currentTarget.style.background = this.selectedMutations.has(
                                    mutation
                                )
                                    ? '#e3f2fd'
                                    : '#fff')
                            }
                        >
                            <input
                                type="checkbox"
                                checked={this.selectedMutations.has(mutation)}
                                onChange={() => {}}
                                style={{ cursor: 'pointer', margin: 0 }}
                            />
                            {mutation}
                        </div>
                    ))}
                </div>
            </>
        );
    }

    render() {
        if (this.isLoading) {
            return (
                <LoadingIndicator isLoading={true} size="big" center={true} />
            );
        }

        if (this.error) {
            return (
                <div className="alert alert-danger" role="alert">
                    Failed to load quickqueck trials: {this.error}
                </div>
            );
        }

        if (!this.data || this.data.studies.length === 0) {
            return (
                <div className="alert alert-info" role="alert">
                    No quickqueck trials available.
                </div>
            );
        }

        const columns = buildQuickqueckColumns(
            this.data.entityMap,
            this.data.phaseMap,
            this.data.therapyLineMap,
            this.data.ageRangeMap
        );

        return (
            <div data-test="quickqueck-table">
                <div
                    style={{
                        marginBottom: 12,
                        fontSize: '1.00em',
                        fontWeight: 400,
                    }}
                >
                    Clinical Trials Search via QuickQueck. This search is based
                    on cached results from{' '}
                    {new Date(this.data.lastUpdated).toLocaleDateString()}.{' '}
                    <br />
                    Per default, the list is pre-filtered by the patient's
                    altered genes. Press the button "Show all trials" to remove
                    this automatic filter.
                </div>
                {this.renderFilterBar()}
                <LazyMobXTable
                    columns={columns}
                    data={this.filteredStudies}
                    initialSortColumn="Last Modified"
                    initialSortDirection="desc"
                    showPagination={true}
                    initialItemsPerPage={25}
                />
            </div>
        );
    }
}
