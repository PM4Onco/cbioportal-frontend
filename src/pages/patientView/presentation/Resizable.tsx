import { DraggableChangedFn } from 'pages/patientView/presentation/model/dynamic-component';
import React, { useEffect } from 'react';
import { Coordinates } from '@dnd-kit/utilities';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { DraggableAttributes } from '@dnd-kit/core';

interface Props {
    width: number;
    left: number;
    children: any;
    draggableChanged: DraggableChangedFn;
    widthChanged: (width: number) => void;
    leftChanged: (left: number) => void;
    className: string;
    onPointerDown: (event: React.PointerEvent) => void;
    forwardedRef: (element: HTMLDivElement) => void;
    style: Record<string, any>;
    listeners: SyntheticListenerMap | undefined;
    attributes: DraggableAttributes;
    selected: boolean;
}

type Direction = 1 | -1;

interface State {
    resizing: boolean;
    pointerDownCoordinates: Coordinates;
    dx: number;
    direction: Direction;
}

export const Resizable = ({
    width,
    left,
    draggableChanged,
    children,
    widthChanged,
    leftChanged,
    className,
    onPointerDown,
    forwardedRef: ref,
    style: styleProps,
    listeners,
    attributes,
    selected,
}: Props) => {
    const [state, setState] = React.useState<State>({
        resizing: false,
        pointerDownCoordinates: { x: 0, y: 0 },
        dx: 0,
        direction: 1,
    });

    useEffect(() => {
        const controller = new AbortController();

        document.addEventListener('pointermove', onPointerMove, {
            signal: controller.signal,
        });
        document.addEventListener('pointerup', onPointerUp, {
            signal: controller.signal,
        });

        return () => {
            controller.abort();
        };
    }, [state]);

    const beforeResize = () => {
        draggableChanged(false);
    };

    const startResize = (
        event: any,
        direction: Pick<State, 'direction'>[keyof Pick<State, 'direction'>]
    ) => {
        event.persist();
        setState(current => ({
            ...current,
            resizing: true,
            pointerDownCoordinates: { x: event.clientX, y: event.clientY },
            direction,
        }));
    };

    const onPointerMove = (event: PointerEvent) => {
        if (!state.resizing) return;

        const dx =
            (event.clientX - state.pointerDownCoordinates.x) * state.direction;
        setState(current => ({ ...current, dx }));
    };

    const onPointerUp = (event: PointerEvent) => {
        if (!state.resizing) return;

        widthChanged(width + state.dx);

        if (state.direction === -1) {
            leftChanged(left - state.dx);
        }

        setState(current => ({
            ...current,
            resizing: false,
            dx: 0,
        }));
    };

    const style = {
        position: styleProps.position,
        transform: `translate3d(${styleProps.transformX -
            (state.direction === -1 ? state.dx : 0)}px, ${
            styleProps.transformY
        }px, 0)`,
        left: styleProps.left,
        top: styleProps.top,
        width: styleProps.width + state.dx,
    };

    return (
        <div
            {...listeners}
            {...attributes}
            className={className}
            onPointerDown={onPointerDown}
            style={style}
            ref={ref}
        >
            {children}
            {selected && (
                <div className="node__transform">
                    <div
                        className="node__anchor-point"
                        data-direction="nw"
                        onMouseEnter={beforeResize}
                        onPointerDown={event => startResize(event, -1)}
                    ></div>
                    <div
                        className="node__anchor-point"
                        data-direction="ne"
                        onMouseEnter={beforeResize}
                        onPointerDown={event => startResize(event, 1)}
                    ></div>
                    <div
                        className="node__anchor-point"
                        data-direction="se"
                        onMouseEnter={beforeResize}
                        onPointerDown={event => startResize(event, 1)}
                    ></div>
                    <div
                        className="node__anchor-point"
                        data-direction="sw"
                        onMouseEnter={beforeResize}
                        onPointerDown={event => startResize(event, -1)}
                    ></div>
                </div>
            )}
        </div>
    );
};
