import { ComponentKeys } from 'pages/patientView/presentation/model/dynamic-component';

interface Position {
    left: number;
    top: number;
}

export interface Node<T> {
    id: string;
    position: Position;
    type: ComponentKeys;
    value: T;
    props?: Record<string, unknown>;
    draggable: boolean;
}
