import * as React from 'react';
import { getServerConfig } from 'config/config';
import FollowUpTable from 'pages/patientView/therapyRecommendation/FollowUpTable';
import WindowStore from 'shared/components/window/WindowStore';
import {
    registerPatientTabExtension,
    PatientTabRenderContext,
} from '../patientTabRegistry';
import { isCustomFeatureEnabled } from '../runtimeConfig';

let initialized = false;

function isVisible(context: PatientTabRenderContext): boolean {
    if (!isCustomFeatureEnabled('followUp')) {
        return false;
    }

    const page: any = context.pageComponent;
    const store = page.patientViewPageStore;
    return (
        page.shouldShowFollowUpTab &&
        store.mutationData.isComplete &&
        store.followUps.isComplete &&
        store.discreteCNAData.isComplete &&
        (store.oncoKbData.isComplete || store.oncoKbData.isError) &&
        (store.mtbs.isComplete || store.mtbs.isError) &&
        (store.cnaOncoKbData.isComplete || store.cnaOncoKbData.isError)
    );
}

export function registerFollowUpPatientTabModule() {
    if (initialized) {
        return;
    }
    initialized = true;

    registerPatientTabExtension({
        id: 'followUp',
        key: 44,
        order: 430,
        linkText: 'Follow-up',
        unmountOnHide: false,
        modes: ['compat', 'full'],
        isVisible,
        render: context => {
            const page: any = context.pageComponent;
            const store = page.patientViewPageStore;
            return (
                <FollowUpTable
                    patientId={store.patientId}
                    mutations={store.mutationData.result}
                    indexedVariantAnnotations={
                        store.indexedVariantAnnotations.result
                    }
                    indexedMyVariantInfoAnnotations={
                        store.indexedMyVariantInfoAnnotations.result
                    }
                    mutationSignatureData={
                        store.mutationalSignatureDataGroupByVersion.result
                    }
                    cna={store.discreteCNAData.result}
                    clinicalData={store.clinicalDataPatient.result.concat(
                        store.clinicalDataForSamples.result
                    )}
                    sampleManager={context.sampleManager}
                    checkPermission={store.checkPermission}
                    mtbUrl={store.getMtbJsonStoreUrl('')}
                    oncoKbAvailable={
                        getServerConfig().show_oncokb &&
                        !store.cnaOncoKbData.isError &&
                        !store.oncoKbData.isError
                    }
                    mtbs={store.mtbs.result}
                    deletions={store.deletions}
                    containerWidth={WindowStore.size.width - 20}
                    onDeleteData={store.deleteFollowUps}
                    onSaveData={store.updateFollowUps}
                    oncoKbData={store.oncoKbData}
                    cnaOncoKbData={store.cnaOncoKbData}
                    pubMedCache={store.pubMedCache}
                    followUps={store.followUps.result}
                />
            );
        },
    });
}
