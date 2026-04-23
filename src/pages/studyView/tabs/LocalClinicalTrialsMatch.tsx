import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react';
import { ClinicalAttribute, ClinicalData } from 'cbioportal-ts-api-client';
import { getLocalCT, clinicalTrial } from 'cbioportal-utils/src/model/LocalCT';
import { StudyViewPageStore } from '../StudyViewPageStore';
import {
    OQLFilter,
    FinalResultRow,
} from './LocalClinicalTrialsHelperFunctions/LocalCTInterfaces';
import {
    ageEligibilityNotes,
    alterationLabel,
    getFiltersFromTrials,
    useMutationsPerPatient,
    buildAlterations,
    alterationsByInclusion,
    patientsByExclusion,
} from './LocalClinicalTrialsHelperFunctions/LocalCTTools';
import CTLazyTable from 'pages/studyView/table/LocalCTTable';
import client from 'shared/api/cbioportalClientInstance';

// Helper function to obrain StudyViewPageStore encoding metadata on the currently viewed study
interface Props {
    store: StudyViewPageStore;
}

// The major component to control the local clinical trials matching tab. It fetches the local clinical trial data, extracts molecular alteration data for patients in the current study, applies the trial inclusion and exclusion criteria to identify matches, and renders the results in a table.
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
                        trial
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

// These are informational components that explain the functionality of the local clinical trials matching tool, list the available local clinical trials, and describe the filters applied based on the trial criteria. They are used to provide context and guidance to users of the tool.
// They aren't crucial for the functionality, but they might be helpful for users to understand the tab.
// boilerplate text
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

// A list with all local clinical trials available in the cBioPortal instance, with links to their respective pages. This is generated from the localCT.json file and provides users with an overview of the trials that are being matched against.
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

// A list of all filters applied in the matching process, based on the inclusion and exclusion criteria of the trials. This component helps users understand why certain patients were matched to certain trials by showing the specific molecular criteria that were used for matching.
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
