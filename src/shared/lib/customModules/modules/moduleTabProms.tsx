import * as React from 'react';
import Proms from 'pages/patientView/proms/Proms';
import { QUESTIONNAIRE_NAME as QUESTIONNAIRE_NAME_EQ_5D_5L } from 'pages/patientView/proms/utils/EQ-5D-5LChartMetadata';
import { doClinicalEventsHavePromData } from 'pages/patientView/proms/utils/PromChartHelperFunctions';
import {
    registerPatientTabExtension,
    PatientTabRenderContext,
} from '../patientTabRegistry';
import { isCustomFeatureEnabled } from '../runtimeConfig';

let initialized = false;

function isVisible(context: PatientTabRenderContext): boolean {
    if (!isCustomFeatureEnabled('proms')) {
        return false;
    }

    const clinicalEvents =
        context.pageComponent.patientViewPageStore.clinicalEvents;
    return (
        clinicalEvents.isComplete &&
        clinicalEvents.result.length > 0 &&
        doClinicalEventsHavePromData(clinicalEvents.result, [
            QUESTIONNAIRE_NAME_EQ_5D_5L,
        ])
    );
}

export function registerPromsPatientTabModule() {
    if (initialized) {
        return;
    }
    initialized = true;

    registerPatientTabExtension({
        id: 'proms',
        key: 45,
        order: 520,
        linkText: 'PROMs',
        unmountOnHide: false,
        modes: ['compat', 'full'],
        isVisible,
        render: context => (
            <Proms
                patientViewPageStore={
                    context.pageComponent.patientViewPageStore
                }
                sampleManager={context.sampleManager}
                dataStore={context.pageComponent.patientViewMutationDataStore}
                allClinicalEventsInStudy={
                    context.pageComponent.patientViewPageStore.allClinicalEvents
                        .result
                }
            />
        ),
    });
}
