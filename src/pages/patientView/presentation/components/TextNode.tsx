import React, { RefObject, useEffect } from 'react';
import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';

interface State {
    down: boolean;
    selected: boolean;
    editing: boolean;
}

interface Props {
    stateChanged: StateChangedFn;
    selectedChanged: SelectedChangedFn;
    draggableChanged: DraggableChangedFn;
    innerRef: RefObject<HTMLDivElement>;
    initialValue: string;
}

export const TextNode = ({
    innerRef,
    stateChanged,
    initialValue,
    draggableChanged,
    selectedChanged,
}: Props) => {
    const [state, setState] = React.useState<State>({
        down: false,
        selected: false,
        editing: false,
    });

    useEffect(() => {
        const controller = new AbortController();
        document.addEventListener('pointerup', onPointerUp, {
            signal: controller.signal,
        });
        document.addEventListener('keydown', onKeyDown, {
            signal: controller.signal,
        });
        document.addEventListener('pointerdown', onOutsideClick, {
            signal: controller.signal,
        });
        innerRef.current?.addEventListener('dblclick', () => startEditing(), {
            signal: controller.signal,
        });

        return () => {
            controller.abort();
        };
    }, [state]);

    const focus = () => {
        if (!innerRef.current) return;

        innerRef.current.focus();
        document.getSelection()!.collapse(innerRef.current, 1);
    };

    const startEditing = () => {
        if (state.editing) return;
        draggableChanged(false);
        setState(current => ({ ...current, editing: true }));
        focus();
    };

    const onPointerDown = (event: React.PointerEvent) => {
        selectedChanged(true);
        setState(current => ({ ...current, down: true, selected: true }));
    };

    const onKeyDown = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'Escape':
                handleEscapePress();
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

    const stopEditing = () => {
        const textNode = innerRef.current;
        if (!textNode) return;

        stateChanged(textNode.textContent);
        draggableChanged(true);
        setState(current => ({ ...current, editing: false }));
    };

    const unselectNode = () => {
        selectedChanged(false);
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
            onPointerDown={onPointerDown}
            contentEditable={state.editing}
            suppressContentEditableWarning={true}
        >
            {initialValue}
        </div>
    );
};
