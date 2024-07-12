import React, { Ref } from 'react';
import { TextNode } from 'pages/patientView/presentation/TextNode';
import { MutationTable } from 'pages/patientView/presentation/MutationTable';

interface DynamicComponentProps<T> {
    innerRef: Ref<any>;
    initialValue: T;
    stateChanged: (value: any, draggable: boolean) => void;
}

export const Components = {
    text: TextNode,
    mutationTable: MutationTable,
} as const;

export type ComponentKeys = keyof typeof Components;

export const Dynamic = (
    type: ComponentKeys,
    props: DynamicComponentProps<any>
) => {
    return React.createElement(Components[type], props);
};
