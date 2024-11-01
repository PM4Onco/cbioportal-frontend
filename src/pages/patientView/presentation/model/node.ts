import { ComponentKeys } from 'pages/patientView/presentation/model/dynamic-component';

export type Width = number | null;
export type Scale = number | null;

interface Position {
    left: number;
    top: number;
    width: Width;
    scale: Scale;
}

export interface Node<T> {
    id: string;
    position: Position;
    type: ComponentKeys;
    value: T;
    props?: Record<string, unknown>;
}
