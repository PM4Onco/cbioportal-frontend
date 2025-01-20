import React, { Ref } from 'react';
import { TextNode } from 'pages/patientView/presentation/components/TextNode';
import { MutationTable } from 'pages/patientView/presentation/components/MutationTable';
import { ImageNode } from 'pages/patientView/presentation/components/ImageNode';
import { HTMLNode } from 'pages/patientView/presentation/components/HTMLNode';
import { Timeline } from 'pages/patientView/presentation/components/Timeline';
import { TherapyRecommendations } from 'pages/patientView/presentation/components/TherapyRecommendations';
import { Rectangle } from 'pages/patientView/presentation/components/Rectangle';
import { FusionTable } from 'pages/patientView/presentation/components/FusionTable';

export interface DynamicComponentProps<T> {
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
    timeline: Timeline,
    therapyRecommendations: TherapyRecommendations,
    rectangle: Rectangle,
    fusionTable: FusionTable,
} as const;

export type ComponentKeys = keyof typeof Components;

export const Dynamic = (
    type: ComponentKeys,
    props: DynamicComponentProps<any>
) => {
    return React.createElement(Components[type], props);
};
