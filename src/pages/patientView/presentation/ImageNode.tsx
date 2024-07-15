import {
    DraggableChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';
import React, { RefObject, useEffect } from 'react';

interface Props {
    stateChanged: StateChangedFn;
    draggableChanged: DraggableChangedFn;
    innerRef: RefObject<HTMLImageElement>;
    initialValue: string;
}

interface State {
    selected: boolean;
}

export const ImageNode = ({
    innerRef,
    stateChanged,
    initialValue,
    draggableChanged,
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
        setState(current => ({ ...current, selected: false }));
    };

    return (
        <div>
            <img
                className={` 
                     ${state.selected ? 'presentation__node--selected' : ''}`}
                ref={innerRef}
                src={initialValue}
                onPointerDown={onPointerDown}
                alt="Image"
            />
        </div>
    );
};
