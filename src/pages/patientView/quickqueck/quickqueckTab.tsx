import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action, computed, makeObservable } from 'mobx';
import { Mutation } from 'cbioportal-ts-api-client';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import LazyMobXTable, {
    Column,
} from 'shared/components/lazyMobXTable/LazyMobXTable';
import {
    getQuickqueckData,
    QuickqueckContact,
    QuickqueckData,
    QuickqueckLookupEntry,
    QuickqueckStudy,
    AgeRangeMap,
    PHASE_FILTER_MAP,
    PHASE_FILTER_OPTIONS,
    collectDescendantIds,
} from './utils/quickqueckAPIQuery';
import { CollapsibleTreeSelect } from './CollapsibleTreeSelect';

function renderContacts(contacts: QuickqueckContact[]): JSX.Element {
    if (contacts.length === 0) return <span>—</span>;
    return (
        <span>
            {contacts.map((c, i) => (
                <span key={i}>
                    {i > 0 && <br />}
                    {c.department && (
                        <span style={{ color: '#666' }}>{c.department}: </span>
                    )}
                    {c.email ? (
                        <a href={`mailto:${c.email}`}>{c.name}</a>
                    ) : (
                        c.name
                    )}
                </span>
            ))}
        </span>
    );
}

type SelectOption = { value: string | number; label: string };

function buildColumns(
    entityMap: Record<number, string>,
    phaseMap: Record<number, string>,
    therapyLineMap: Record<number, string>,
    ageRangeMap: AgeRangeMap
    // clinicCityMap: ClinicCityMap  — kept for future City column
): Column<QuickqueckStudy>[] {
    return [
        {
            name: 'Study',
            render: (s: QuickqueckStudy) => (
                <a
                    href={`https://quickqueck.de/detail/${s.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {s.study_name}
                </a>
            ),
            sortBy: (s: QuickqueckStudy) => s.study_name,
            filter: (s, filterString) =>
                s.study_name.toLowerCase().includes(filterString.toLowerCase()),
            width: 300,
        },
        {
            name: 'Number',
            render: (s: QuickqueckStudy) => (
                <a
                    href={s.study_link}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {s.study_number}
                </a>
            ),
            sortBy: (s: QuickqueckStudy) => s.study_number,
            filter: (s, filterString) =>
                s.study_number
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 130,
        },
        {
            name: 'Center',
            render: (s: QuickqueckStudy) => <span>{s.group_name}</span>,
            sortBy: (s: QuickqueckStudy) => s.group_name,
            filter: (s, filterString) =>
                s.group_name.toLowerCase().includes(filterString.toLowerCase()),
            width: 160,
        },
        /*
        {
            name: 'City',
            render: (s: QuickqueckStudy) => (
                <span>{clinicCityMap[s.group] ?? '—'}</span>
            ),
            sortBy: (s: QuickqueckStudy) => clinicCityMap[s.group] ?? '',
            filter: (s, filterString) =>
                (clinicCityMap[s.group] ?? '')
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 110,
        },
        */
        {
            name: 'Entity',
            render: (s: QuickqueckStudy) => (
                <span>{entityMap[s.entity] ?? String(s.entity)}</span>
            ),
            sortBy: (s: QuickqueckStudy) =>
                entityMap[s.entity] ?? String(s.entity),
            filter: (s, filterString) =>
                (entityMap[s.entity] ?? '')
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 140,
        },
        {
            name: 'Therapy Line',
            render: (s: QuickqueckStudy) => (
                <span>
                    {therapyLineMap[s.therapy_line] ?? String(s.therapy_line)}
                </span>
            ),
            sortBy: (s: QuickqueckStudy) =>
                therapyLineMap[s.therapy_line] ?? String(s.therapy_line),
            filter: (s, filterString) =>
                (therapyLineMap[s.therapy_line] ?? '')
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 110,
        },
        {
            name: 'Phase',
            render: (s: QuickqueckStudy) => (
                <span>
                    {s.phase !== null
                        ? phaseMap[s.phase] ?? String(s.phase)
                        : '—'}
                </span>
            ),
            sortBy: (s: QuickqueckStudy) =>
                s.phase !== null ? phaseMap[s.phase] ?? String(s.phase) : '',
            filter: (s, filterString) =>
                (s.phase !== null ? phaseMap[s.phase] ?? '' : '')
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 90,
        },
        {
            name: 'Min Age',
            render: (s: QuickqueckStudy) => {
                const range = ageRangeMap[s.age_group];
                return <span>{range?.min ?? '0'}</span>;
            },
            sortBy: (s: QuickqueckStudy) => ageRangeMap[s.age_group]?.min ?? -1,
            filter: (s, filterString) =>
                String(ageRangeMap[s.age_group]?.min ?? '').includes(
                    filterString
                ),
            width: 70,
        },
        {
            name: 'Max Age',
            render: (s: QuickqueckStudy) => {
                const range = ageRangeMap[s.age_group];
                return <span>{range?.max ?? '∞'}</span>;
            },
            sortBy: (s: QuickqueckStudy) =>
                ageRangeMap[s.age_group]?.max ?? Infinity,
            filter: (s, filterString) =>
                String(ageRangeMap[s.age_group]?.max ?? '').includes(
                    filterString
                ),
            width: 70,
        },
        {
            name: 'Trial Description',
            render: (s: QuickqueckStudy) => (
                <span style={{ whiteSpace: 'pre-wrap' }}>{s.criteria}</span>
            ),
            sortBy: (s: QuickqueckStudy) => s.criteria,
            filter: (s, filterString) =>
                s.criteria.toLowerCase().includes(filterString.toLowerCase()),
            width: 320,
        },
        {
            name: 'Contact (Clinician)',
            render: (s: QuickqueckStudy) => renderContacts(s.doctors),
            sortBy: (s: QuickqueckStudy) =>
                s.doctors.map(c => c.name).join(', '),
            filter: (s, filterString) =>
                s.doctors.some(
                    c =>
                        c.name
                            .toLowerCase()
                            .includes(filterString.toLowerCase()) ||
                        (c.email ?? '')
                            .toLowerCase()
                            .includes(filterString.toLowerCase())
                ),
            width: 200,
        },
        {
            name: 'Contact (Assistance)',
            render: (s: QuickqueckStudy) => renderContacts(s.assistants),
            sortBy: (s: QuickqueckStudy) =>
                s.assistants.map(c => c.name).join(', '),
            filter: (s, filterString) =>
                s.assistants.some(
                    c =>
                        c.name
                            .toLowerCase()
                            .includes(filterString.toLowerCase()) ||
                        (c.email ?? '')
                            .toLowerCase()
                            .includes(filterString.toLowerCase())
                ),
            width: 200,
        },
        {
            name: 'Last Modified',
            render: (s: QuickqueckStudy) => (
                <span>
                    {s.last_modified !== null
                        ? new Date(s.last_modified).toLocaleDateString()
                        : '—'}
                </span>
            ),
            sortBy: (s: QuickqueckStudy) => s.last_modified,
            width: 110,
        },
    ];
}

@observer
export default class QuickqueckTab extends React.Component<{
    mutations?: Mutation[][];
}> {
    @observable private data: QuickqueckData | null = null;
    @observable private isLoading = true;
    @observable private error: string | null = null;

    @observable private selectedCenters = new Set<number>();
    @observable private selectedEntities = new Set<number>();
    @observable private selectedPhases = new Set<string>();
    @observable private selectedTherapyLines = new Set<number>();
    @observable private patientAge: number | null = null;
    @observable private mutationQuery = '';
    @observable private mutationDropdownOpen = false;

    constructor(props: {}) {
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

    // --- Filtered studies ---

    @computed get filteredStudies(): QuickqueckStudy[] {
        if (!this.data) return [];
        const { ageRangeMap } = this.data;

        // Expand selected entity IDs: selecting a parent also matches all its descendants.
        const expandedEntityIds = new Set<number>();
        if (this.selectedEntities.size > 0) {
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
            expand(this.data!.rawEntities);
        }

        return this.data.studies.filter(s => {
            if (
                this.selectedCenters.size > 0 &&
                !this.selectedCenters.has(s.group)
            )
                return false;
            if (
                this.selectedEntities.size > 0 &&
                !expandedEntityIds.has(s.entity)
            )
                return false;
            if (this.selectedPhases.size > 0) {
                const phaseMatches =
                    s.phase !== null &&
                    Array.from(this.selectedPhases).some(label =>
                        PHASE_FILTER_MAP[label]?.has(s.phase!)
                    );
                if (!phaseMatches) return false;
            }
            if (
                this.selectedTherapyLines.size > 0 &&
                !this.selectedTherapyLines.has(s.therapy_line)
            )
                return false;
            if (this.patientAge !== null) {
                const range = ageRangeMap[s.age_group];
                if (range) {
                    if (range.min !== null && this.patientAge < range.min)
                        return false;
                    if (range.max !== null && this.patientAge > range.max)
                        return false;
                }
            }
            if (this.mutationQuery.trim()) {
                if (
                    !s.criteria
                        .toLowerCase()
                        .includes(this.mutationQuery.toLowerCase())
                )
                    return false;
            }
            return true;
        });
    }

    // --- Count maps (based on all studies, not filtered) ---

    @computed get centerCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        for (const s of this.data.studies) {
            map[s.group] = (map[s.group] ?? 0) + 1;
        }
        return map;
    }

    @computed get entityCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        for (const s of this.data.studies) {
            map[s.entity] = (map[s.entity] ?? 0) + 1;
        }
        return map;
    }

    // --- Filter entries for CollapsibleTreeSelect ---

    // Phase: uses PHASE_FILTER_OPTIONS index as stable numeric ID.
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

    @computed get phaseCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        PHASE_FILTER_OPTIONS.forEach((label, idx) => {
            map[idx] = this.data!.studies.filter(
                s => s.phase !== null && PHASE_FILTER_MAP[label]?.has(s.phase!)
            ).length;
        });
        return map;
    }

    // Maps selected phase labels back to PHASE_FILTER_OPTIONS indices for the tree select.
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

    @computed get therapyLineCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        for (const s of this.data.studies) {
            map[s.therapy_line] = (map[s.therapy_line] ?? 0) + 1;
        }
        return map;
    }

    // Deduplicated list of gene symbols and full mutation strings (e.g. "KRAS", "KRAS G12C")
    // derived from the patient's mutations, for the suggestion dropdown.
    @computed get mutationSuggestions(): string[] {
        const { mutations } = this.props;
        if (!mutations || mutations.length === 0) return [];
        const suggestions = new Set<string>();
        for (const group of mutations) {
            for (const m of group) {
                const gene = m.gene?.hugoGeneSymbol;
                if (gene) {
                    suggestions.add(gene);
                    if (m.proteinChange) {
                        suggestions.add(`${gene} ${m.proteinChange}`);
                    }
                }
            }
        }
        return Array.from(suggestions).sort();
    }

    /*
    @action.bound
    private onCityChange(opts: readonly SelectOption[]) {
        this.selectedCities = new Set(opts.map(o => o.value as string));
    }
    */

    @action.bound
    private onCenterToggle(id: number) {
        const next = new Set(this.selectedCenters);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        this.selectedCenters = next;
    }

    @action.bound
    private onEntityToggle(id: number) {
        const next = new Set(this.selectedEntities);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        this.selectedEntities = next;
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
        const next = new Set(this.selectedTherapyLines);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        this.selectedTherapyLines = next;
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
        this.mutationQuery = '';
    }

    // --- Filter bar ---

    private renderFilterBar() {
        const hasAnyFilter =
            this.selectedCenters.size > 0 ||
            this.selectedEntities.size > 0 ||
            this.selectedPhases.size > 0 ||
            this.selectedTherapyLines.size > 0 ||
            this.patientAge !== null ||
            this.mutationQuery.trim() !== '';

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
                            countMap={this.centerCountMap}
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
                            countMap={this.entityCountMap}
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
                        countMap={this.therapyLineCountMap}
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
                        countMap={this.phaseCountMap}
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
                        Mutation
                    </label>
                    <div
                        style={{
                            display: 'flex',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            background: '#fff',
                            minWidth: 180,
                        }}
                    >
                        <input
                            type="text"
                            placeholder="e.g. KRAS G12C"
                            value={this.mutationQuery}
                            onChange={action(
                                (e: React.ChangeEvent<HTMLInputElement>) => {
                                    this.mutationQuery = e.target.value;
                                    this.mutationDropdownOpen = true;
                                }
                            )}
                            onFocus={action(() => {
                                this.mutationDropdownOpen = true;
                            })}
                            style={{
                                flex: 1,
                                border: 'none',
                                outline: 'none',
                                padding: '6px 8px',
                                fontSize: '0.95em',
                                borderRadius: 4,
                            }}
                        />
                        {this.mutationSuggestions.length > 0 && (
                            <button
                                onClick={action(() => {
                                    this.mutationDropdownOpen = !this
                                        .mutationDropdownOpen;
                                })}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    padding: '0 8px',
                                    color: '#999',
                                    fontSize: '0.8em',
                                }}
                            >
                                ▼
                            </button>
                        )}
                    </div>
                    {this.mutationDropdownOpen &&
                        this.mutationSuggestions.length > 0 && (
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
                                        boxShadow:
                                            '0 4px 12px rgba(0,0,0,0.15)',
                                        maxHeight: 240,
                                        overflowY: 'auto',
                                        minWidth: 180,
                                        marginTop: 2,
                                    }}
                                >
                                    {this.mutationSuggestions
                                        .filter(
                                            s =>
                                                !this.mutationQuery ||
                                                s
                                                    .toLowerCase()
                                                    .includes(
                                                        this.mutationQuery.toLowerCase()
                                                    )
                                        )
                                        .map(suggestion => (
                                            <div
                                                key={suggestion}
                                                onClick={action(() => {
                                                    this.mutationQuery = suggestion;
                                                    this.mutationDropdownOpen = false;
                                                })}
                                                style={{
                                                    padding: '6px 12px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9em',
                                                }}
                                                onMouseEnter={e =>
                                                    (e.currentTarget.style.background =
                                                        '#f5f5f5')
                                                }
                                                onMouseLeave={e =>
                                                    (e.currentTarget.style.background =
                                                        '')
                                                }
                                            >
                                                {suggestion}
                                            </div>
                                        ))}
                                </div>
                            </>
                        )}
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
                            Clear all
                        </button>
                    )}
                    <small style={{ color: '#666', whiteSpace: 'nowrap' }}>
                        {shown} / {total} studies
                    </small>
                </div>
            </div>
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

        const columns = buildColumns(
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
                    {new Date(this.data.lastUpdated).toLocaleDateString()}.
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
