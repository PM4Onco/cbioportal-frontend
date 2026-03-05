import * as React from 'react';
import { getServerConfig } from 'config/config';
import MtbTable from 'pages/patientView/therapyRecommendation/MtbTable';
import WindowStore from 'shared/components/window/WindowStore';
import {
    registerPatientTabExtension,
    PatientTabRenderContext,
} from '../patientTabRegistry';
import { isCustomFeatureEnabled } from '../runtimeConfig';

let initialized = false;

function isVisible(context: PatientTabRenderContext): boolean {
    if (!isCustomFeatureEnabled('mtb')) {
        return false;
    }

    const page: any = context.pageComponent;
    const store = page.patientViewPageStore;
    return (
        page.shouldShowMtbTab &&
        store.mutationData.isComplete &&
        store.discreteCNAData.isComplete &&
        (store.oncoKbData.isComplete || store.oncoKbData.isError) &&
        (store.mtbs.isComplete || store.mtbs.isError) &&
        (store.cnaOncoKbData.isComplete || store.cnaOncoKbData.isError)
    );
}

export function registerMtbPatientTabModule() {
    if (initialized) {
        return;
    }
    initialized = true;

    registerPatientTabExtension({
        id: 'mtb',
        key: 42,
        order: 420,
        linkText: 'MTB',
        unmountOnHide: false,
        modes: ['compat', 'full'],
        isVisible,
        render: context => {
            const page: any = context.pageComponent;
            const store = page.patientViewPageStore;
            return (
                <MtbTable
                    patientId={store.patientId}
                    mutations={store.mutationData.result}
                    indexedVariantAnnotations={
                        store.indexedVariantAnnotations.result
                    }
                    indexedMyVariantInfoAnnotations={
                        store.indexedMyVariantInfoAnnotations.result
                    }
                    cna={store.discreteCNAData.result}
                    clinicalData={store.clinicalDataPatient.result.concat(
                        store.clinicalDataForSamples.result
                    )}
                    mutationSignatureData={
                        store.mutationalSignatureDataGroupByVersion.result
                    }
                    sampleManager={context.sampleManager}
                    oncoKbAvailable={
                        getServerConfig().show_oncokb &&
                        !store.cnaOncoKbData.isError &&
                        !store.oncoKbData.isError
                    }
                    mtbs={store.mtbs.result}
                    deletions={store.deletions}
                    containerWidth={WindowStore.size.width - 20}
                    onDeleteData={store.deleteMtbs}
                    onSaveData={store.updateMtbs}
                    mtbUrl={store.getMtbJsonStoreUrl('')}
                    checkPermission={store.checkPermission}
                    oncoKbData={store.oncoKbData}
                    cnaOncoKbData={store.cnaOncoKbData}
                    pubMedCache={store.pubMedCache}
                    otherMtbs={store.localTherapyRecommendations.result}
                    clinicalTrialClipboard={store.clinicalTrialClipboard}
                />
            );
        },
    });
}
