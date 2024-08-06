import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';
import React, { useRef } from 'react';

interface Props {
    stateChanged: StateChangedFn;
    draggableChanged: DraggableChangedFn;
    selectedChanged: SelectedChangedFn;
    initialValue: string;
}

export const ImageNode = ({ initialValue }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="presentation__node" ref={containerRef}>
            <img className="node__image" src={initialValue} alt="Image" />
        </div>
    );
};
