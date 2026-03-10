import * as React from 'react';
import { ClinicalTrialMatchTable } from 'pages/patientView/clinicalTrialMatch/ClinicalTrialMatchTable';
import { registerPatientTabExtension } from '../patientTabRegistry';
import { isCustomFeatureEnabled } from '../runtimeConfig';

let initialized = false;

export function registerClinicalTrialsGovPatientTabModule() {
    if (initialized) {
        return;
    }
    initialized = true;

    registerPatientTabExtension({
        id: 'clinicaltrialsGov',
        key: 43,
        order: 530,
        linkText: 'ClinicalTrialsGov',
        unmountOnHide: false,
        modes: ['compat', 'full'],
        isVisible: () => isCustomFeatureEnabled('clinicalTrialsGov'),
        render: context => (
            <ClinicalTrialMatchTable
                store={context.pageComponent.patientViewPageStore}
                clinicalTrialMatches={
                    context.pageComponent.patientViewPageStore
                        .clinicalTrialMatches.result
                }
                mtbTabAvailable={context.pageComponent.shouldShowMtbTab}
            />
        ),
    });
}
