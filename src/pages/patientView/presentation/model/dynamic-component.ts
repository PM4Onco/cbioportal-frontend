import React, { Ref } from 'react';
import { TextNode } from 'pages/patientView/presentation/TextNode';
import { MutationTable } from 'pages/patientView/presentation/MutationTable';
import { ImageNode } from 'pages/patientView/presentation/ImageNode';

export interface DynamicComponentProps<T> {
    innerRef: Ref<any>;
    initialValue: T;
    stateChanged: StateChangedFn;
    draggableChanged: DraggableChangedFn;
}

export type StateChangedFn = (value: any) => void;
export type DraggableChangedFn = (draggable: boolean) => void;

export const Components = {
    text: TextNode,
    mutationTable: MutationTable,
    image: ImageNode,
} as const;

export type ComponentKeys = keyof typeof Components;

export const Dynamic = (
    type: ComponentKeys,
    props: DynamicComponentProps<any>
) => {
    return React.createElement(Components[type], props);
};
