// Helper functions for the Local Clinical Trials feature: parsing trial criteria, matching patient alterations to trial filters, and organizing patients by inclusion/exclusion criteria.
import {
    AgeFilter,
    Alteration,
    OQLFilter,
    MutationsPerPatient,
    NumericGeneMolecularDataWithStatus,
    ClinicalFilter,
    ClinicalMatch,
    LocalCTBundle,
    TrialFilters,
    FilterSet,
    LocalTrialWarningContext,
} from './LocalCTInterfaces';
import { useEffect, useState } from 'react';
import {
    ClinicalData,
    Gene,
    Mutation,
    MolecularProfile,
    NumericGeneMolecularData,
    Sample,
    DiscreteCopyNumberData,
    StructuralVariant,
} from 'cbioportal-ts-api-client';
import { StudyViewPageStore } from '../../StudyViewPageStore';
import { clinicalTrial } from './LocalCT';
import {
    getCnaData,
    getMutationData,
    getSvData,
} from 'pages/studyView/StudyViewComparisonUtils';
import client from 'shared/api/cbioportalClientInstance';
import { LocalCTValidationIssue } from './LocalCTValidation';

// This function generates a warning if the patient's age does not meet the trial's age criteria.
export function ageEligibilityNotes(
    ageFilter: AgeFilter[],
    patientAge: string,
    trialName: string
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

function addTrialWarning(
    warningsByTrialName: { [trialName: string]: string[] },
    trialName: string | undefined,
    warning: string
) {
    if (!trialName) return;
    if (!warningsByTrialName[trialName]) {
        warningsByTrialName[trialName] = [];
    }
    if (!warningsByTrialName[trialName].includes(warning)) {
        warningsByTrialName[trialName].push(warning);
    }
}

function oqlFilterLabel(filter: OQLFilter): string {
    if (filter.alterationType === 'Copy Number Alteration') {
        return `${filter.gene}:${filter.cnaType ?? 'CNA'}`;
    }

    if (filter.alterationType === 'Structural Variant') {
        if (filter.fusionPartner) {
            return `${filter.gene}:${
                filter.fusionPartner
            }:${filter.mutationType ?? 'FUSION'}`;
        }
        return `${filter.gene}:${filter.mutationType ?? 'FUSION'}`;
    }

    return `${filter.gene}:${filter.proteinChange ??
        filter.mutationType ??
        'MUT'}`;
}

function clinicalFilterLabel(filter: ClinicalFilter): string {
    return `Clinical:${filter.clinicalParameterId}:${
        filter.clinicalParameterOperator
    }:${String(filter.clinicalParameterValue)}`;
}

export function getTrialWarningsByTrialName({
    patientId,
    patientAge,
    ageFilter,
    molecularFilters,
    clinicalFilters,
    clinicalData,
    alterations,
}: LocalTrialWarningContext): { [trialName: string]: string[] } {
    const warningsByTrialName: { [trialName: string]: string[] } = {};
    const ageNum = patientAge ? parseInt(patientAge) : NaN;

    if (!Number.isNaN(ageNum)) {
        ageFilter.forEach(filter => {
            if (filter.min_age !== undefined && ageNum < filter.min_age) {
                addTrialWarning(
                    warningsByTrialName,
                    filter.trialName,
                    `Below minimum age (patient age ${ageNum} < min ${filter.min_age})`
                );
            }

            if (filter.max_age !== undefined && ageNum > filter.max_age) {
                addTrialWarning(
                    warningsByTrialName,
                    filter.trialName,
                    `Above maximum age (patient age ${ageNum} > max ${filter.max_age})`
                );
            }
        });
    }

    const patientAlterations = alterations.filter(
        alteration => alteration.patientId === patientId
    );
    molecularFilters
        .filter(filter => filter.criterionType === 'excl')
        .forEach(filter => {
            if (
                patientAlterations.some(alteration =>
                    alterationMatcher(alteration, filter)
                )
            ) {
                addTrialWarning(
                    warningsByTrialName,
                    filter.trialName,
                    `Exclusion criterion matched: ${oqlFilterLabel(filter)}`
                );
            }
        });

    const patientClinicalData = clinicalData.filter(
        datum => datum.patientId === patientId
    );
    clinicalFilters
        .filter(filter => filter.criterionType === 'excl')
        .forEach(filter => {
            if (
                patientClinicalData.some(
                    datum =>
                        datum.clinicalAttributeId.toUpperCase() ===
                            filter.clinicalParameterId.toUpperCase() &&
                        clinicalValueMeetsFilter(datum.value, filter)
                )
            ) {
                addTrialWarning(
                    warningsByTrialName,
                    filter.trialName,
                    `Exclusion criterion matched: ${clinicalFilterLabel(
                        filter
                    )}`
                );
            }
        });

    return warningsByTrialName;
}

// This function checks if a given alteration matches the criteria specified in an OQL filter, which can include mutation type, CNA status, and fusion partner.
export function alterationLabel(a: Alteration): string {
    if (a.alterationType === 'Mutation') {
        return a.proteinChange ?? a.mutationType ?? 'MUT';
    }
    if (a.alterationType === 'Copy Number Alteration') {
        return '';
    }
    if (a.partnerGene?.hugoGeneSymbol) {
        return `${a.gene.hugoGeneSymbol}::${a.partnerGene.hugoGeneSymbol}`;
    }
    return 'FUSION';
}

export function getPatientAgeFromClinicalData(
    clinicalData: ClinicalData[],
    patientId: string
): string | undefined {
    return clinicalData.find(
        datum =>
            datum.patientId === patientId &&
            datum.clinicalAttributeId.toUpperCase() === 'AGE'
    )?.value;
}

export function buildWarningAlterations(
    mutations: Mutation[],
    cnaEntries: DiscreteCopyNumberData[],
    structuralVariants: StructuralVariant[]
): Alteration[] {
    return [
        ...mutations.map(
            (mutation): Alteration => ({
                gene: mutation.gene,
                patientId: mutation.patientId,
                sampleId: mutation.sampleId,
                alterationType: 'Mutation',
                proteinChange: mutation.proteinChange,
                mutationType: mutation.mutationType,
            })
        ),
        ...cnaEntries.map(
            (cna): Alteration => ({
                gene: cna.gene,
                patientId: cna.patientId,
                sampleId: cna.sampleId,
                alterationType: 'Copy Number Alteration',
                cna: cna.alteration,
            })
        ),
        ...buildAlterations([], [], structuralVariants),
    ];
}

// This function checks if a given alteration matches the criteria specified in an OQL filter, which can include mutation type, CNA status, and fusion partner.
// It parses trial inclusion/exclusion criteria into OQL-like tokens:
// examples: "KRAS:MUT", "BRAF:V600E", "CCNE1:AMP"
export interface FilterSetWithIssues extends FilterSet {
    parseIssues: LocalCTValidationIssue[];
}

export function getFiltersFromTrials(
    trials: clinicalTrial[] | null
): FilterSetWithIssues {
    if (!trials) {
        return {
            hugoFilter: [] as string[],
            OQLFilterMutation: [] as OQLFilter[],
            OQLFilterCNA: [] as OQLFilter[],
            OQLFilterSV: [] as OQLFilter[],
            clinicalFilter: [] as ClinicalFilter[],
            ageFilter: [] as AgeFilter[],
            parseIssues: [],
        };
    }

    const parseIssues: LocalCTValidationIssue[] = [];

    const allHugoSymbols = new Set<string>();

    const mutationMap = new Map<string, OQLFilter>();
    const cnaMap = new Map<string, OQLFilter>();
    const svMap = new Map<string, OQLFilter>();
    const clinicalMap = new Map<string, ClinicalFilter>();

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

    const makeClinicalKey = (f: ClinicalFilter) => {
        return [
            f.trialName ?? '',
            f.criterionType,
            f.clinicalParameterId,
            f.clinicalParameterDataType,
            f.clinicalParameterOperator,
            String(f.clinicalParameterValue),
        ].join('::');
    };

    const splitOnUnescapedColon = (input: string): string[] => {
        const parts: string[] = [];
        let current = '';
        let escaped = false;

        const chars = input.split('');
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            if (escaped) {
                current += ch;
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === ':') {
                parts.push(current);
                current = '';
            } else {
                current += ch;
            }
        }

        if (escaped) {
            current += '\\';
        }

        parts.push(current);
        return parts;
    };

    const parseClinicalCriterion = (
        token: string,
        type: 'incl' | 'excl',
        name: string,
        url: string
    ) => {
        const parts = splitOnUnescapedColon(token).map(p => p.trim());

        if (parts.length < 5 || parts[0].toLowerCase() !== 'clinical') {
            parseIssues.push({
                level: 'error',
                trialName: name,
                message: `Malformed clinical criterion "${token.substring(
                    0,
                    40
                )}${
                    token.length > 40 ? '...' : ''
                }": expected Clinical:ParamID:dataType:operator:value.`,
            });
            return;
        }

        const clinicalParameterId = parts[1];
        const dataType = parts[2].toLowerCase();
        const operator = parts[3] as ClinicalFilter['clinicalParameterOperator'];
        const valueRaw = parts.slice(4).join(':');

        if (
            !clinicalParameterId ||
            (dataType !== 'string' && dataType !== 'number')
        ) {
            parseIssues.push({
                level: 'error',
                trialName: name,
                message: `Invalid clinical criterion "${token.substring(
                    0,
                    40
                )}${
                    token.length > 40 ? '...' : ''
                }": invalid parameterId or dataType.`,
            });
            return;
        }

        if (!['>', '>=', '<', '<=', '=', '!=', 'contains'].includes(operator)) {
            parseIssues.push({
                level: 'error',
                trialName: name,
                message: `Invalid operator "${operator}" in criterion: must be one of >, >=, <, <=, =, !=, contains.`,
            });
            return;
        }

        const clinicalParameterValue =
            dataType === 'number' ? Number(valueRaw) : valueRaw;

        if (
            dataType === 'number' &&
            (valueRaw.trim() === '' || Number.isNaN(clinicalParameterValue))
        ) {
            parseIssues.push({
                level: 'error',
                trialName: name,
                message: `Invalid number value "${valueRaw}" for clinical criterion with number dataType.`,
            });
            return;
        }

        const f: ClinicalFilter = {
            clinicalParameterId,
            clinicalParameterName: '', // Placeholder, as we may not have the actual name available
            clinicalParameterDataType: dataType,
            clinicalParameterOperator: operator,
            clinicalParameterValue,
            criterionType: type,
            trialName: name,
            trialURL: url,
        };

        clinicalMap.set(makeClinicalKey(f), f);
    };

    const parseCriterionString = (
        critStr: string,
        type: 'incl' | 'excl',
        name: string,
        url: string,
        sites: string[] = []
    ) => {
        // split multiple criteria in one string (comma/semicolon separated)
        const tokens = critStr
            .split(/[,;]+/)
            .map(t => normalize(t))
            .filter(Boolean);
        tokens.forEach(token => {
            if (/^clinical:/i.test(token)) {
                parseClinicalCriterion(token, type, name, url);
                return;
            }

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
                    trialSites: sites,
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
                    trialSites: sites,
                    cnaType: last,
                };
                cnaMap.set(makeKey(f), f);
            } else if (/(FUSION|TRANSLOCATION|SV|REARRANGEMENT)/i.test(last)) {
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
                              trialSites: sites,
                              fusionPartner: parts[1],
                          }
                        : {
                              gene: gene,
                              alterationType: 'Structural Variant',
                              mutationType: last,
                              criterionType: type,
                              trialName: name,
                              trialURL: url,
                              trialSites: sites,
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
                    trialSites: sites,
                    proteinChange: last,
                };
                mutationMap.set(makeKey(f), f);
            }
        });
    };

    trials.forEach(t => {
        const name = (t.trialName as string) || '';
        const url = (t.trialUrl as string) || 'about:blank';
        const incl = (t.inclusionCriteria as string[]) || [];
        const excl = (t.exclusionCriteria as string[]) || [];
        const sites = (t.trialSites as string[]) || [];
        incl.forEach(
            c => c && parseCriterionString(c, 'incl', name, url, sites)
        );
        excl.forEach(
            c => c && parseCriterionString(c, 'excl', name, url, sites)
        );
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
        clinicalFilter: Array.from(clinicalMap.values()),
        ageFilter: ageFilter,
        parseIssues,
    };
}

// This function fetches mutation data for the selected samples and mutation profiles, filtered by the provided Hugo gene symbols.
export function useMutationsPerPatient(
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

// This function builds a list of Alteration objects from the raw mutation, CNA, and SV data, which can then be used for matching against trial criteria.
export function buildAlterations(
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

// This function organizes alterations by patient and trial inclusion criteria, which can then be used to determine which patients match which trials based on their molecular profiles.
export function alterationMatcher(a: Alteration, f: OQLFilter): boolean {
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

// This function filters inclusions based on the presence of matching alterations for each patient, and organizes them by trial and patient.
export function alterationsByInclusion(
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

// This function checks whether a clinical data value satisfies the operator/value in a ClinicalFilter.
// For 'number' dataType: parses both sides as floats and applies >, >=, <, <=, =, !=.
// For 'string' dataType: applies =, !=, contains (case-insensitive).
export function clinicalValueMeetsFilter(
    rawValue: string,
    filter: ClinicalFilter
): boolean {
    if (filter.clinicalParameterDataType === 'number') {
        const actual = parseFloat(rawValue);
        const target =
            typeof filter.clinicalParameterValue === 'number'
                ? filter.clinicalParameterValue
                : parseFloat(filter.clinicalParameterValue);
        if (isNaN(actual) || isNaN(target)) return false;

        switch (filter.clinicalParameterOperator) {
            case '>':
                return actual > target;
            case '>=':
                return actual >= target;
            case '<':
                return actual < target;
            case '<=':
                return actual <= target;
            case '=':
                return actual === target;
            case '!=':
                return actual !== target;
            default:
                return false;
        }
    } else {
        // string comparison
        const actual = rawValue.toLowerCase();
        const target = String(filter.clinicalParameterValue).toLowerCase();

        switch (filter.clinicalParameterOperator) {
            case '=':
                return actual === target;
            case '!=':
                return actual !== target;
            case 'contains':
                return actual.includes(target);
            default:
                return false;
        }
    }
}

// This function searches clinical data for inclusion matches and groups them by trial and patient.
// Returns Map<trialName, Map<patientId, ClinicalMatch[]>>.
export function clinicalInclusionsByTrial(
    clinicalData: ClinicalData[],
    filters: ClinicalFilter[]
): Map<string, Map<string, ClinicalMatch[]>> {
    const result = new Map<string, Map<string, ClinicalMatch[]>>();
    const inclFilters = filters.filter(f => f.criterionType === 'incl');

    clinicalData.forEach(datum => {
        const attrId = datum.clinicalAttributeId.toUpperCase();

        inclFilters.forEach(f => {
            if (f.clinicalParameterId.toUpperCase() !== attrId) return;
            if (!clinicalValueMeetsFilter(datum.value, f)) return;

            const trial = f.trialName!;
            const patient = datum.patientId;

            if (!result.has(trial)) result.set(trial, new Map());
            const trialMap = result.get(trial)!;

            if (!trialMap.has(patient)) trialMap.set(patient, []);
            trialMap.get(patient)!.push({
                sampleId: datum.sampleId || '',
                patientId: patient,
                filter: f,
                value: datum.value,
            });
        });
    });

    return result;
}

// This function collects patients that have at least one sample meeting an exclusion criterion.
// Returns Map<trialName, Set<patientId>>.
export function clinicalExclusionPatients(
    clinicalData: ClinicalData[],
    filters: ClinicalFilter[]
): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    const exclFilters = filters.filter(f => f.criterionType === 'excl');

    clinicalData.forEach(datum => {
        const attrId = datum.clinicalAttributeId.toUpperCase();

        exclFilters.forEach(f => {
            if (f.clinicalParameterId.toUpperCase() !== attrId) return;
            if (!clinicalValueMeetsFilter(datum.value, f)) return;

            const trial = f.trialName!;
            if (!result.has(trial)) result.set(trial, new Set());
            result.get(trial)!.add(datum.patientId);
        });
    });

    return result;
}

// This function organizes patients by trial exclusion criteria, which can then be used to filter out patients who do not meet the trial requirements based on their molecular profiles.
export function patientsByExclusion(
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

export async function getPatientName(
    patientId: string
): Promise<string | undefined> {
    const patientData = await client.fetchClinicalDataUsingPOST({
        clinicalDataType: 'PATIENT',
        clinicalDataMultiStudyFilter: {
            attributeIds: ['PATIENT_DISPLAY_NAME'],
            identifiers: [{ studyId: '', entityId: patientId }],
        },
    });

    if (patientData && patientData.length > 0) {
        return patientData[0].value || '';
    }

    return undefined;
}

export function parseTrialFilters(trial: clinicalTrial): TrialFilters {
    return {
        trial,
        ...getFiltersFromTrials([trial]),
    };
}

export function mergeTrialFilters(filtersByTrial: TrialFilters[]): FilterSet {
    const hugoSymbols = new Set<string>();

    const OQLFilterMutation: OQLFilter[] = [];
    const OQLFilterCNA: OQLFilter[] = [];
    const OQLFilterSV: OQLFilter[] = [];
    const clinicalFilter: ClinicalFilter[] = [];
    const ageFilter: AgeFilter[] = [];

    filtersByTrial.forEach(filters => {
        filters.hugoFilter.forEach(symbol => hugoSymbols.add(symbol));

        OQLFilterMutation.push(...filters.OQLFilterMutation);
        OQLFilterCNA.push(...filters.OQLFilterCNA);
        OQLFilterSV.push(...filters.OQLFilterSV);
        clinicalFilter.push(...filters.clinicalFilter);
        ageFilter.push(...filters.ageFilter);
    });

    return {
        hugoFilter: Array.from(hugoSymbols),
        OQLFilterMutation,
        OQLFilterCNA,
        OQLFilterSV,
        clinicalFilter,
        ageFilter,
    };
}

export function buildLocalCTBundle(trials: clinicalTrial[]): LocalCTBundle {
    const filtersByTrial = trials.map(parseTrialFilters);

    return {
        trials,
        filtersByTrial,
        aggregateFilters: mergeTrialFilters(filtersByTrial),
    };
}

export function getMatchingInclusionMutationFilters(
    mutations: Mutation[],
    filters: OQLFilter[]
): OQLFilter[] {
    const mutationAlterations: Alteration[] = mutations.map(mutation => ({
        gene: mutation.gene,
        patientId: mutation.patientId,
        sampleId: mutation.sampleId,
        alterationType: 'Mutation',
        proteinChange: mutation.proteinChange,
        mutationType: mutation.mutationType,
    }));

    return filters.filter(
        filter =>
            filter.criterionType === 'incl' &&
            mutationAlterations.some(alteration =>
                alterationMatcher(alteration, filter)
            )
    );
}

export function getMatchingInclusionCnaFilters(
    cnaEntries: DiscreteCopyNumberData[],
    filters: OQLFilter[]
): OQLFilter[] {
    return filters.filter(
        filter =>
            filter.criterionType === 'incl' &&
            cnaEntries.some(cna =>
                alterationMatcher(
                    {
                        gene: cna.gene,
                        patientId: cna.patientId,
                        sampleId: cna.sampleId,
                        alterationType: 'Copy Number Alteration',
                        cna: cna.alteration,
                    },
                    filter
                )
            )
    );
}

export function getMatchingInclusionSvFilters(
    variants: StructuralVariant[],
    filters: OQLFilter[]
): OQLFilter[] {
    const alterations = buildAlterations([], [], variants);

    return filters.filter(
        filter =>
            filter.criterionType === 'incl' &&
            alterations.some(alteration =>
                alterationMatcher(alteration, filter)
            )
    );
}
