import * as React from 'react';
import { observer } from 'mobx-react';
import { StudyViewPageStore } from '../StudyViewPageStore';
import {
    Mutation,
    Gene,
    Sample,
    MolecularProfile,
    CBioPortalAPI,
    NumericGeneMolecularData,
    StructuralVariant,
    ClinicalAttribute,
    ClinicalData,
} from 'cbioportal-ts-api-client';
import { useState, useEffect, useMemo } from 'react';
import {
    NumericGeneMolecularDataWithStatus,
    MutationsPerPatient,
    Alteration,
    AgeFilter,
    OQLFilter,
    FinalResultRow,
} from './LocalClinicalTrialsHelperFunctions/LocalCTInterfaces';
import {
    getMutationData,
    getCnaData,
    getSvData,
} from 'pages/studyView/StudyViewComparisonUtils';
import CTLazyTable from 'pages/studyView/table/LocalCTTable';
import { getLocalCT, clinicalTrial } from 'cbioportal-utils/src/model/LocalCT';
import client from 'shared/api/cbioportalClientInstance';

// Get client for cBioPortal API calls

// Helper function to obrain StudyViewPageStore encoding metadata on the currently viewed study
interface Props {
    store: StudyViewPageStore;
}

function ageEligibilityNotes(
    ageFilter: AgeFilter[],
    patientAge: string,
    trialName: string,
    trialURL: string
): string {
    if (!patientAge) return '';

    const ageNum = parseInt(patientAge);
    if (isNaN(ageNum)) return patientAge;
    const age_too_young = ageFilter.some(
        f =>
            f.trialName === trialName &&
            f.min_age !== undefined &&
            ageNum < f.min_age
    );
    const age_too_old = ageFilter.some(
        f =>
            f.trialName === trialName &&
            f.max_age !== undefined &&
            ageNum > f.max_age
    );

    if (age_too_young) {
        return `⚠️ Below minimum age (${ageNum} < ${
            ageFilter.find(f => f.trialName === trialName)?.min_age
        })`;
    } else if (age_too_old) {
        return `⚠️ Above maximum age (${ageNum} > ${
            ageFilter.find(f => f.trialName === trialName)?.max_age
        })`;
    } else {
        return ``;
    }
}

function alterationLabel(a: Alteration): string {
    if (a.alterationType === 'Mutation') {
        return a.proteinChange ?? a.mutationType ?? 'MUT';
    }
    if (a.alterationType === 'Copy Number Alteration') {
        return '';
        // return a.mutationType ?? 'CNA';
    }
    // sv
    if (a.partnerGene?.hugoGeneSymbol) {
        return `${a.gene.hugoGeneSymbol}::${a.partnerGene.hugoGeneSymbol}`;
    }
    return 'FUSION';
}

function getFiltersFromTrials(trials: clinicalTrial[] | null) {
    // Parse trial inclusion/exclusion criteria into OQL-like tokens:
    // examples: "KRAS:MUT", "BRAF:V600E", "CCNE1:AMP"
    if (!trials) {
        return {
            hugoFilter: [] as string[],
            OQLFilterMutation: [] as OQLFilter[],
            OQLFilterCNA: [] as OQLFilter[],
            OQLFilterSV: [] as OQLFilter[],
            ageFilter: [] as AgeFilter[],
        };
    }

    const allHugoSymbols = new Set<string>();

    const mutationMap = new Map<string, OQLFilter>();
    const cnaMap = new Map<string, OQLFilter>();
    const svMap = new Map<string, OQLFilter>();

    const normalize = (s: string) => s.trim().replace(/\s+/g, ' ');

    const makeKey = (f: OQLFilter) => {
        // Keyed by trial + criterion + gene + alteration specifics
        return [
            f.trialName ?? '',
            f.criterionType,
            f.gene,
            f.alterationType,
            f.proteinChange ?? '',
            f.mutationType ?? '',
            f.cnaType ?? '',
            f.fusionPartner ?? '',
        ].join('::');
    };

    const parseCriterionString = (
        critStr: string,
        type: 'incl' | 'excl',
        name: string,
        url: string
    ) => {
        // split multiple criteria in one string (comma/semicolon separated)
        const tokens = critStr
            .split(/[,;]+/)
            .map(t => normalize(t))
            .filter(Boolean);
        tokens.forEach(token => {
            // token examples: "KRAS:MUT", "BRAF:V600E", "CCNE1:AMP", "TP53:ANY", "GENE1::GENE2:FUSION"
            const parts = token
                .split(':')
                .map(p => p.trim())
                .filter(Boolean);
            if (parts.length === 0) return;

            const gene = parts[0].toUpperCase();

            if (type === 'incl') {
                allHugoSymbols.add(gene);
            }

            const lastRaw = parts[parts.length - 1];
            const last = lastRaw.toUpperCase();

            if (parts.length === 1 || last === 'MUT') {
                // single gene — treat as any mutation
                const f: OQLFilter = {
                    gene: gene,
                    alterationType: 'Mutation',
                    criterionType: type,
                    trialName: name,
                    trialURL: url,
                };
                mutationMap.set(makeKey(f), f);
                return;
            }

            // CNA exact matches
            if (/^(AMP|GAIN|HETLOSS|HOMDEL)$/.test(last)) {
                const f: OQLFilter = {
                    gene: gene,
                    alterationType: 'Copy Number Alteration',
                    criterionType: type,
                    trialName: name,
                    trialURL: url,
                    cnaType: last,
                };
                cnaMap.set(makeKey(f), f);
            } else if (
                /(FUSION|TRANSLOCATION|SV|REARRANGEMENT)/i.test(last) ||
                parts.length >= 3
            ) {
                // treat multi-part tokens or explicit fusion markers as structural variants

                const f: OQLFilter =
                    parts.length === 3
                        ? {
                              gene: gene,
                              alterationType: 'Structural Variant',
                              mutationType: last,
                              criterionType: type,
                              trialName: name,
                              trialURL: url,
                              fusionPartner: parts[1],
                          }
                        : {
                              gene: gene,
                              alterationType: 'Structural Variant',
                              mutationType: last,
                              criterionType: type,
                              trialName: name,
                              trialURL: url,
                          };

                svMap.set(makeKey(f), f);
            } else {
                // treat as mutation (including specific AA changes like V600E or generic MUT/ANY/WT)
                const f: OQLFilter = {
                    gene: gene,
                    alterationType: 'Mutation',
                    criterionType: type,
                    trialName: name,
                    trialURL: url,
                    proteinChange: last,
                };
                mutationMap.set(makeKey(f), f);
            }
        });
    };

    trials.forEach(t => {
        const name = (t.trialName as string) || '';
        const url = (t.trialUrl as string) || '';
        const incl = (t.inclusionCriteria as string[]) || [];
        const excl = (t.exclusionCriteria as string[]) || [];
        incl.forEach(c => c && parseCriterionString(c, 'incl', name, url));
        excl.forEach(c => c && parseCriterionString(c, 'excl', name, url));
    });

    const ageFilter = trials.map(t => {
        const name = (t.trialName as string) || '';
        const url = (t.trialUrl as string) || '';
        return {
            min_age: t.min_age,
            max_age: t.max_age,
            trialName: name,
            trialURL: url,
        };
    });

    return {
        hugoFilter: Array.from(allHugoSymbols),
        OQLFilterMutation: Array.from(mutationMap.values()),
        OQLFilterCNA: Array.from(cnaMap.values()),
        OQLFilterSV: Array.from(svMap.values()),
        ageFilter: ageFilter,
    };
}

function useMutationsPerPatient(
    store: StudyViewPageStore,
    hugoFilter: string[],
    hugoFilterKey: string
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
                p => p.molecularAlterationType === 'MUTATION_EXTENDED'
            );

            const cnaProfiles = profiles.filter(
                p => p.molecularAlterationType === 'COPY_NUMBER_ALTERATION'
            );

            const svProfiles = profiles.filter(
                p => p.molecularAlterationType === 'STRUCTURAL_VARIANT'
            );

            // SNVs and indels
            let mutations: Mutation[] = [];

            try {
                mutations = await getMutationData(
                    sampleArray,
                    mutationProfiles,
                    hugoFilter
                );
            } catch (error) {
                console.log('Mutations not loaded yet:');
            }

            // CNAs with copy number status
            let cna: NumericGeneMolecularData[] = [];

            try {
                cna = await getCnaData(sampleArray, cnaProfiles, hugoFilter);
            } catch (error) {
                console.log('CNA not loaded yet');
            }

            let cnaExt: NumericGeneMolecularDataWithStatus[] = [];

            if (cna.length > 0) {
                cnaExt = cna.map(cnaEntry => {
                    let copyNumberStatus:
                        | 'AMP'
                        | 'GAIN'
                        | 'HETLOSS'
                        | 'HOMDEL'
                        | 'NEUTRAL';

                    if (cnaEntry.value === 2) {
                        copyNumberStatus = 'AMP';
                    } else if (cnaEntry.value === 1) {
                        copyNumberStatus = 'GAIN';
                    } else if (cnaEntry.value === -1) {
                        copyNumberStatus = 'HETLOSS';
                    } else if (cnaEntry.value === -2) {
                        copyNumberStatus = 'HOMDEL';
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
                console.log('SV not loaded yet');
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
            });
        }

        load();
    }, [store.samples.status, store.molecularProfiles.status, hugoFilterKey]);

    return data;
}

function buildAlterations(
    mutations: Mutation[],
    cna: NumericGeneMolecularDataWithStatus[],
    sv: StructuralVariant[]
): Alteration[] {
    const mutationAlt: Alteration[] = mutations.map(m => ({
        gene: m.gene,
        sampleId: m.sampleId,
        patientId: m.patientId,
        alterationType: 'Mutation',
        proteinChange: m.proteinChange,
        mutationType: m.mutationType,
    }));

    const cnaAlt: Alteration[] = cna.map(c => ({
        gene: c.gene,
        sampleId: c.sampleId,
        patientId: c.patientId,
        alterationType: 'Copy Number Alteration',
        cna: c.value,
        mutationType: c.copyNumberStatus,
    }));

    const svAlt: Alteration[] = sv.map(s => ({
        gene: { hugoGeneSymbol: s.site1HugoSymbol } as Gene,
        sampleId: s.sampleId,
        patientId: s.patientId,
        alterationType: 'Structural Variant',
        fusion: true,
        partnerGene: { hugoGeneSymbol: s.site2HugoSymbol } as Gene,
        mutationType: s.variantClass,
    }));

    return [...mutationAlt, ...cnaAlt, ...svAlt];
}

function alterationMatcher(a: Alteration, f: OQLFilter): boolean {
    if (a.alterationType !== f.alterationType) return false;
    if (a.gene.hugoGeneSymbol !== f.gene) return false;

    if (f.proteinChange && a.proteinChange !== f.proteinChange) return false;
    if (f.mutationType && a.mutationType !== f.mutationType) return false;

    if (f.cnaType) {
        const status =
            a.cna === 2
                ? 'AMP'
                : a.cna === 1
                ? 'GAIN'
                : a.cna === -1
                ? 'HETLOSS'
                : a.cna === -2
                ? 'HOMDEL'
                : 'NEUTRAL';
        if (status !== f.cnaType) return false;
    }

    if (f.fusionPartner) {
        if (a.partnerGene?.hugoGeneSymbol !== f.fusionPartner) return false;
    }

    return true;
}

function alterationsByInclusion(
    alterations: Alteration[],
    filters: OQLFilter[]
): Map<string, Map<string, Alteration[]>> {
    const result = new Map<string, Map<string, Alteration[]>>();
    // trial → patient → alterations[]

    const inclFilters = filters.filter(f => f.criterionType === 'incl');

    inclFilters.forEach(f => {
        alterations.forEach(a => {
            if (!alterationMatcher(a, f)) return;

            const trial = f.trialName!;
            const patient = a.patientId;

            if (!result.has(trial)) result.set(trial, new Map());
            const trialMap = result.get(trial)!;

            if (!trialMap.has(patient)) trialMap.set(patient, []);
            trialMap.get(patient)!.push(a);
        });
    });

    return result;
}

function patientsByExclusion(
    alterations: Alteration[],
    filters: OQLFilter[]
): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();

    const exclFilters = filters.filter(f => f.criterionType === 'excl');

    exclFilters.forEach(f => {
        alterations.forEach(a => {
            if (!alterationMatcher(a, f)) return;

            const trial = f.trialName!;
            const patient = a.patientId;

            if (!result.has(trial)) result.set(trial, new Set());
            result.get(trial)!.add(patient);
        });
    });

    return result;
}

const LocalClinicalTrialsMatch: React.FC<Props> = observer(({ store }) => {
    const [trials, setTrials] = useState<clinicalTrial[] | null>(null);
    const [ageByPatient, setAgeByPatient] = useState<{
        [patientId: string]: string;
    }>({});

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

    const {
        hugoFilter,
        OQLFilterMutation,
        OQLFilterCNA,
        OQLFilterSV,
        ageFilter,
    } = useMemo(() => {
        return (
            getFiltersFromTrials(trials) || {
                hugoFilter: [],
                OQLFilterMutation: [],
                OQLFilterCNA: [],
                OQLFilterSV: [],
                ageFilter: [],
            }
        );
    }, [trials]);

    const hugoSet = useMemo(() => new Set(hugoFilter), [hugoFilter]);
    const hugoFilterKey = useMemo(() => hugoFilter.join(','), [hugoFilter]);

    const mutationsPerPatient = useMutationsPerPatient(
        store,
        hugoFilter,
        hugoFilterKey
    );

    useEffect(() => {
        let disposed = false;

        const loadAgeClinicalData = async () => {
            if (
                store.selectedSamples.status !== 'complete' ||
                store.clinicalAttributes.status !== 'complete'
            ) {
                return;
            }

            const selectedSamples = store.selectedSamples.result;
            if (selectedSamples.length === 0) {
                if (!disposed) {
                    setAgeByPatient({});
                }
                return;
            }

            const ageAttribute = store.clinicalAttributes.result.find(
                (attr: ClinicalAttribute) => {
                    if (!attr.patientAttribute) {
                        return false;
                    }

                    const attributeId =
                        attr.clinicalAttributeId?.toUpperCase() || '';
                    const displayName = (attr.displayName || '').toUpperCase();

                    return displayName === 'AGE';
                }
            );

            console.log('Identified age attribute:', ageAttribute);

            if (!ageAttribute) {
                if (!disposed) {
                    setAgeByPatient({});
                }
                return;
            }
            console.log('Fetching age clinical data for patients...');

            const ageClinicalData = await client.fetchClinicalDataUsingPOST({
                clinicalDataType: 'PATIENT',
                clinicalDataMultiStudyFilter: {
                    attributeIds: [ageAttribute.clinicalAttributeId],
                    identifiers: selectedSamples.map(sample => ({
                        studyId: sample.studyId,
                        entityId: sample.patientId,
                    })),
                },
            });

            console.log('Fetched age clinical data:', ageClinicalData);

            const ageMap: { [patientId: string]: string } = {};
            ageClinicalData.forEach((datum: ClinicalData) => {
                if (datum.patientId) {
                    ageMap[datum.patientId] = datum.value;
                }
            });

            if (!disposed) {
                setAgeByPatient(ageMap);
            }
        };

        loadAgeClinicalData();

        return () => {
            disposed = true;
        };
    }, [
        store.selectedSamples.status,
        store.clinicalAttributes.status,
        store.filters,
    ]);

    if (!mutationsPerPatient) {
        return <div>Loading Clinical Trial Matches</div>;
    }

    const filteredMutations = mutationsPerPatient.mutations.filter(m =>
        hugoSet.has(m.gene?.hugoGeneSymbol ?? '')
    );

    const filteredCna = mutationsPerPatient.cnaExt.filter(c =>
        hugoSet.has(c.gene?.hugoGeneSymbol ?? '')
    );

    const filteredSV = mutationsPerPatient.sv.filter(
        sv =>
            hugoSet.has(sv.site1HugoSymbol ?? '') ||
            hugoSet.has(sv.site2HugoSymbol ?? '')
    );

    const allAlterations = buildAlterations(
        filteredMutations,
        filteredCna,
        filteredSV
    );

    const allFilters: OQLFilter[] = [
        ...OQLFilterMutation,
        ...OQLFilterCNA,
        ...OQLFilterSV,
    ];

    const inclMap = alterationsByInclusion(allAlterations, allFilters);
    const exclMap = patientsByExclusion(allAlterations, allFilters);

    const trialUrlByName = new Map<string, string>();
    allFilters.forEach(f => {
        if (f.trialName && f.trialURL && !trialUrlByName.has(f.trialName)) {
            trialUrlByName.set(f.trialName, f.trialURL);
        }
    });

    const finalResults: FinalResultRow[] = [];
    const seen = new Set<string>();

    inclMap.forEach((patientsMap, trial) => {
        const exclPatients = exclMap.get(trial) ?? new Set<string>();
        const trialURL = trialUrlByName.get(trial) ?? '';

        patientsMap.forEach((alts, patientId) => {
            if (exclPatients.has(patientId)) return;

            alts.forEach(a => {
                const row: FinalResultRow = {
                    studyId: store.studyIds?.[0],
                    patientId: patientId,
                    age: ageByPatient[patientId] || '',
                    ageNotes: ageEligibilityNotes(
                        ageFilter,
                        ageByPatient[patientId],
                        trial,
                        trialURL
                    ),
                    sampleId: a.sampleId,
                    trial,
                    trialURL,
                    gene: a.gene.hugoGeneSymbol,
                    alterationType: a.alterationType,
                    mutationType: a.mutationType || '',
                    alteration: alterationLabel(a),
                };

                const key = `${row.patientId}__${row.sampleId}__${row.trial}__${row.gene}__${row.alterationType}__${row.alteration}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    finalResults.push(row);
                }
            });
        });
    });

    console.log('Final matched results:', finalResults);

    return (
        <div style={{ padding: 12 }}>
            <h2>Local Clinical Trial Matches</h2>
            {boilerplateText}
            {localCTList(trials)}
            <CTLazyTable resultsTable={finalResults} />
            {filtersExplainer(OQLFilterMutation, OQLFilterCNA, OQLFilterSV)}
        </div>
    );
});

export const boilerplateText = (
    <div>
        <p>
            This table shows patients from the current study who match the
            molecular inclusion criteria for any local clinical trials. Patients
            are included if they have at least one alteration that matches an
            inclusion criterion and do not have any alterations that match
            exclusion criteria for the same trial. Click on trial names to view
            details about the trial, and on patient/sample IDs to view their
            respective pages in cBioPortal.
        </p>
        <h3>Who is this for?</h3>
        <p>
            This tool is designed for researchers and clinicians who want to
            quickly identify potential matches between patients in their study
            and a selection of local (on-site) clinical trials based on
            molecular criteria. It can be used to facilitate patient recruitment
            for trials, generate hypotheses about trial eligibility, and explore
            the landscape of available trials in relation to the molecular
            profiles of patients in the study.
        </p>
        <h3>How does it work?</h3>
        <p>
            The tool works by first extracting molecular alteration data
            (mutations, copy number alterations, structural variants) for
            patients in the current study. It then parses the inclusion and
            exclusion criteria of local clinical trials to identify molecular
            eligibility requirements. Finally, it matches patients to trials
            based on their alterations and the trial criteria, and presents the
            results in an interactive table. It requires a json file describing
            the trials and their respective eligibilty criteria. An example file
            can be found{' '}
            <a
                href={`${window.location.origin}/localCT.json`}
                target="_blank"
                rel="noopener noreferrer"
            >
                here
            </a>
            .
        </p>
    </div>
);

export const localCTList = (trials: clinicalTrial[] | null) => (
    <div>
        <h3>Local Clinical Trials in this cBioPortal instance:</h3>
        {trials ? (
            <ul>
                {trials.map((t, idx) => (
                    <li key={idx}>
                        <a
                            href={t.trialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {t.trialName}
                        </a>
                    </li>
                ))}
            </ul>
        ) : (
            <p>No local clinical trials available.</p>
        )}
    </div>
);

export const filtersExplainer = (
    OQLFilterMutation: OQLFilter[],
    OQLFilterCNA: OQLFilter[],
    OQLFilterSV: OQLFilter[]
) => (
    <div>
        <h3>Filters Applied:</h3>
        <ul>
            {OQLFilterMutation.map((f, idx) => (
                <li key={`mut-${idx}`}>
                    Mutation: {f.gene}{' '}
                    {f.proteinChange || f.mutationType || 'ANY'} (Trial:{' '}
                    <a
                        href={f.trialURL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {f.trialName}
                    </a>
                    , {f.criterionType})
                </li>
            ))}
            {OQLFilterCNA.map((f, idx) => (
                <li key={`cna-${idx}`}>
                    CNA: {f.gene} {f.cnaType} (Trial:{' '}
                    <a
                        href={f.trialURL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {f.trialName}
                    </a>
                    , {f.criterionType})
                </li>
            ))}
            {OQLFilterSV.map((f, idx) => (
                <li key={`sv-${idx}`}>
                    SV: {f.gene} {f.fusionPartner ? `::${f.fusionPartner}` : ''}{' '}
                    {f.mutationType} (Trial:{' '}
                    <a
                        href={f.trialURL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {f.trialName}
                    </a>
                    , {f.criterionType})
                </li>
            ))}
        </ul>
    </div>
);

export default LocalClinicalTrialsMatch;
