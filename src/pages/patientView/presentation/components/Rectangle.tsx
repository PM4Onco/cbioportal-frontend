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
    width: number;
}

export const Rectangle = ({ width }: Props) => {
    return <div className="presentation__rectangle"></div>;
};
