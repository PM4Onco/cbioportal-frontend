import React, { Ref } from 'react';
import { TextNode } from 'pages/patientView/presentation/components/TextNode';
import { MutationTable } from 'pages/patientView/presentation/components/MutationTable';
import { ImageNode } from 'pages/patientView/presentation/components/ImageNode';
import { HTMLNode } from 'pages/patientView/presentation/components/HTMLNode';

export interface DynamicComponentProps<T> {
    innerRef: Ref<any>;
    initialValue: T;
    stateChanged: StateChangedFn;
    draggableChanged: DraggableChangedFn;
    selectedChanged: SelectedChangedFn;
}

export type StateChangedFn = (value: any) => void;
export type DraggableChangedFn = (draggable: boolean) => void;
export type SelectedChangedFn = (selected: boolean) => void;

export const Components = {
    text: TextNode,
    mutationTable: MutationTable,
    image: ImageNode,
    html: HTMLNode,
} as const;

export type ComponentKeys = keyof typeof Components;

export const Dynamic = (
    type: ComponentKeys,
    props: DynamicComponentProps<any>
) => {
    return React.createElement(Components[type], props);
};
