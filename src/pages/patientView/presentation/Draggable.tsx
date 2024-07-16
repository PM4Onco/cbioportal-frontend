import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { observer } from 'mobx-react';
import {
    ComponentKeys,
    Dynamic,
    DynamicComponentProps,
} from 'pages/patientView/presentation/model/dynamic-component';

interface Props {
    id: string;
    slideId: string;
    left: number;
    top: number;
    component: {
        type: ComponentKeys;
        props: Omit<DynamicComponentProps<any>, 'draggableChanged'>;
    };
}

export const Draggable = observer(
    ({ id, left, top, component, slideId }: Props) => {
        const [draggable, setDraggable] = React.useState(true);

        const { attributes, listeners, setNodeRef, transform } = useDraggable({
            id,
            disabled: !draggable,
            data: {
                slideId,
            },
        });

        const style = {
            position: 'relative' as const,
            display: 'inline-flex' as const,
            transform: `translate3d(${transform?.x ?? 0}px, ${transform?.y ??
                0}px, 0)`,
            left,
            top,
        };

        return (
            <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
                {Dynamic(component.type, {
                    ...component.props,
                    draggableChanged: draggable => setDraggable(draggable),
                })}
            </div>
        );
    }
);
