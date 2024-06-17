import React, { RefObject, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';

interface State {
    down: boolean;
    selected: boolean;
    editing: boolean;
}

interface Props {
    innerRef: RefObject<HTMLDivElement>;
}

export const TextNode = ({ innerRef }: Props) => {
    const [state, setState] = React.useState<State>({
        down: false,
        selected: false,
        editing: false,
    });

    useEffect(() => {
        const controller = new AbortController();
        (document as any).addEventListener('pointerup', onPointerUp, {
            signal: controller.signal,
        });
        (document as any).addEventListener('keydown', onKeyDown, {
            signal: controller.signal,
        });
        (document as any).addEventListener('pointerdown', onOutsideClick, {
            signal: controller.signal,
        });

        return () => {
            controller.abort();
        };
    }, [state]);

    const focus = () => {
        if (!innerRef) return;
        innerRef.current?.focus();
        document.getSelection()!.collapse(innerRef.current, 1);
    };

    const startEditing = () => {
        setState(current => ({ ...current, editing: true }));
        setTimeout(() => focus());
    };

    const onPointerDown = (event: React.PointerEvent) => {
        setState(current => ({ ...current, down: true, selected: true }));
    };

    const onKeyDown = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'Escape':
                handleEscapePress();
                break;
            case 'Backspace':
                handleBackspacePress();
                break;
        }
    };

    const handleEscapePress = () => {
        if (state.editing) {
            stopEditing();
        } else {
            unselectNode();
        }
    };

    const handleBackspacePress = () => {
        if (state.editing) return;
        innerRef.current?.remove();
    };

    const stopEditing = () => {
        setState(current => ({ ...current, editing: false }));
    };

    const unselectNode = () => {
        setState(current => ({ ...current, selected: false }));
    };

    const onPointerUp = (event: PointerEvent) => {
        setState(current => ({ ...current, down: false }));
    };

    const onOutsideClick = (event: MouseEvent) => {
        if (
            event.target !== innerRef.current &&
            !innerRef.current?.contains(event.target as Node)
        ) {
            handleEscapePress();
        }
    };

    return (
        <div
            className={`presentation__text-node 
                     ${state.selected ? 'presentation__node--selected' : ''} 
                     ${state.editing ? 'presentation__node--editing' : ''}
                `}
            ref={innerRef}
            onDoubleClick={startEditing}
            onPointerDown={onPointerDown}
            contentEditable={state.editing}
            suppressContentEditableWarning={true}
        >
            TextNode
        </div>
    );
};
