import React, { RefObject } from 'react';
import TimelineWrapper from 'pages/patientView/timeline/TimelineWrapper';
import { PatientViewPageStore } from 'pages/patientView/clinicalInformation/PatientViewPageStore';
import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';

interface Props {
    stateChanged: StateChangedFn;
    draggableChanged: DraggableChangedFn;
    selectedChanged: SelectedChangedFn;
    initialValue: null;
    innerRef: RefObject<HTMLDivElement>;
    dataStore: any;
    sampleManager: any;
    patientViewPageStore: PatientViewPageStore;
    width: number;
}

export const Timeline = ({
    dataStore,
    width,
    sampleManager,
    patientViewPageStore,
}: Props) => {
    return (
        <div className="presentation__mutation-table">
            <TimelineWrapper
                dataStore={dataStore}
                caseMetaData={{
                    color: sampleManager.sampleColors,
                    label: sampleManager.sampleLabels,
                    index: sampleManager.sampleIndex,
                }}
                data={patientViewPageStore.clinicalEvents.result}
                sampleManager={sampleManager}
                width={width}
                samples={patientViewPageStore.samples.result}
                mutationProfileId={
                    patientViewPageStore.mutationMolecularProfileId.result!
                }
            />
        </div>
    );
};
