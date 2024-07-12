import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { observer } from 'mobx-react';

interface Props {
    id: string;
    slideId: string;
    left: number;
    top: number;
    children: any;
    draggable: boolean;
}

export const Draggable = observer(
    ({ id, left, top, children, slideId, draggable }: Props) => {
        const { attributes, listeners, setNodeRef, transform } = useDraggable({
            id,
            disabled: !draggable,
            data: {
                slideId,
            },
        });
        const style = {
            position: 'relative' as const,
            transform: `translate3d(${transform?.x ?? 0}px, ${transform?.y ??
                0}px, 0)`,
            left,
            top,
        };

        return (
            <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
                {children}
            </div>
        );
    }
);
