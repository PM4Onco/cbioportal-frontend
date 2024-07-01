import React, { Ref } from 'react';
import { TextNode } from 'pages/patientView/presentation/TextNode';

interface DynamicComponentProps<T> {
    innerRef: Ref<any>;
    initialValue: T;
    valueChanged: (value: any) => void;
}

export const Components = {
    text: TextNode,
} as const;

export type ComponentKeys = keyof typeof Components;
export type ComponentTypes = typeof Components[keyof typeof Components];
export type ComponentValues = string;

export const Dynamic = (
    type: ComponentKeys,
    props: DynamicComponentProps<any>
) => {
    return React.createElement(Components[type], props);
};
