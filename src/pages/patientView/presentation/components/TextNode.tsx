import React, { useCallback, useEffect, useRef } from 'react';
import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';

interface State {
    down: boolean;
    selected: boolean;
    editing: boolean;
    resizing: boolean;
}

interface Props {
    stateChanged: StateChangedFn;
    selectedChanged: SelectedChangedFn;
    draggableChanged: DraggableChangedFn;
    initialValue: string;
}

export const TextNode = ({
    stateChanged,
    initialValue,
    draggableChanged,
    selectedChanged,
}: Props) => {
    const [state, setState] = React.useState<State>({
        down: false,
        selected: false,
        editing: false,
        resizing: false,
    });

    const documentRef = useRef(document);
    const containerRef = useRef<HTMLDivElement>(null);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const controller = new AbortController();

        documentRef.current.addEventListener('pointerup', onPointerUp, {
            signal: controller.signal,
        });
        documentRef.current.addEventListener('keydown', onKeyDown, {
            signal: controller.signal,
        });
        documentRef.current.addEventListener('pointerdown', onOutsideClick, {
            signal: controller.signal,
        });
        elementRef.current?.addEventListener('dblclick', () => startEditing(), {
            signal: controller.signal,
        });

        return () => {
            controller.abort();
        };
    }, [state, documentRef]);

    const focus = () => {
        if (!elementRef.current) return;

        elementRef.current.focus();
        document.getSelection()!.collapse(elementRef.current, 1);
    };

    const startEditing = useCallback(() => {
        if (state.editing) return;
        draggableChanged(false);
        setState(current => ({ ...current, editing: true }));
        focus();
    }, [state]);

    const onPointerDown = (event: React.PointerEvent) => {
        selectedChanged(true);
        setState(current => ({ ...current, down: true, selected: true }));
    };

    const onKeyDown = useCallback(
        (event: KeyboardEvent) => {
            switch (event.code) {
                case 'Escape':
                    handleEscapePress();
                    break;
            }
        },
        [state]
    );

    const handleEscapePress = () => {
        if (state.editing) {
            stopEditing();
        } else {
            unselectNode();
        }
    };

    const stopEditing = () => {
        const textNode = elementRef.current;
        if (!textNode) return;

        stateChanged(textNode.innerHTML);
        draggableChanged(true);
        setState(current => ({ ...current, editing: false }));
    };

    const unselectNode = () => {
        selectedChanged(false);
        setState(current => ({ ...current, selected: false }));
    };

    const onPointerUp = useCallback(() => {
        setState(current => ({ ...current, down: false, resizing: false }));
    }, []);

    const onOutsideClick = useCallback(
        (event: MouseEvent) => {
            if (
                event.target !== containerRef.current &&
                !containerRef.current?.contains(event.target as Node)
            ) {
                handleEscapePress();
            }
        },
        [state]
    );

    return (
        <div className="presentation__node" ref={containerRef}>
            <div
                className={`presentation__text-node
                     ${state.selected ? 'presentation__node--selected' : ''} 
                     ${state.editing ? 'presentation__node--editing' : ''}
                `}
                ref={elementRef}
                onPointerDown={onPointerDown}
                contentEditable={state.editing}
                suppressContentEditableWarning={true}
                dangerouslySetInnerHTML={{ __html: initialValue }}
            ></div>
        </div>
    );
};
