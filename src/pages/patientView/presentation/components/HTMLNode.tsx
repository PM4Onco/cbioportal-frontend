import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';
import React, { RefObject, useEffect } from 'react';

interface Props {
    stateChanged: StateChangedFn;
    draggableChanged: DraggableChangedFn;
    selectedChanged: SelectedChangedFn;
    innerRef: RefObject<HTMLImageElement>;
    initialValue: string;
}

interface State {
    selected: boolean;
}

export const HTMLNode = ({
    innerRef,
    stateChanged,
    initialValue,
    draggableChanged,
    selectedChanged,
}: Props) => {
    const [state, setState] = React.useState<State>({
        selected: false,
    });

    useEffect(() => {
        const controller = new AbortController();

        document.addEventListener('keydown', onKeyDown, {
            signal: controller.signal,
        });

        document.addEventListener('pointerdown', onOutsideClick, {
            signal: controller.signal,
        });

        return () => {
            controller.abort();
        };
    }, [state]);

    const onKeyDown = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'Escape':
                handleEscapePress();
                break;
        }
    };

    const onPointerDown = (event: React.PointerEvent) => {
        selectedChanged(true);
        setState(current => ({ ...current, selected: true }));
    };

    const onOutsideClick = (event: MouseEvent) => {
        if (
            event.target !== innerRef.current &&
            !innerRef.current?.contains(event.target as Node)
        ) {
            handleEscapePress();
        }
    };

    const handleEscapePress = () => {
        unselectNode();
    };

    const unselectNode = () => {
        selectedChanged(false);
        setState(current => ({ ...current, selected: false }));
    };

    return (
        <div
            ref={innerRef}
            onPointerDown={onPointerDown}
            className={`${
                state.selected
                    ? 'presentation__node--selected presentation__node--html'
                    : 'presentation__node--html'
            }`}
            dangerouslySetInnerHTML={{ __html: initialValue }}
        ></div>
    );
};
