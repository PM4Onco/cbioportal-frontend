import { DraggableChangedFn } from 'pages/patientView/presentation/model/dynamic-component';
import React, { MouseEventHandler, useEffect, useRef } from 'react';
import { Coordinates } from '@dnd-kit/utilities';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { DraggableAttributes } from '@dnd-kit/core';

interface Props {
    id: string;
    scale: number;
    left: number;
    children: any;
    draggableChanged: DraggableChangedFn;
    scaleChanged: (scale: number) => void;
    leftChanged: (left: number) => void;
    className: string;
    onPointerDown: (event: React.PointerEvent) => void;
    onDoubleClick: MouseEventHandler<HTMLDivElement>;
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
    ds: number;
    direction: Direction;
    initialWidth: number;
}

export const ResizableScale = ({
    id,
    scale,
    draggableChanged,
    children,
    scaleChanged,
    className,
    onPointerDown,
    onDoubleClick,
    forwardedRef,
    style: styleProps,
    listeners,
    attributes,
    selected,
}: Props) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [state, setState] = React.useState<State>({
        resizing: false,
        pointerDownCoordinates: { x: 0, y: 0 },
        ds: 0,
        direction: 1,
        initialWidth: -1,
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

    const mouseLeftResizeHandle = () => {
        if (state.resizing) return;

        draggableChanged(true);
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
            initialWidth:
                containerRef.current?.getBoundingClientRect().width ?? -1,
        }));
    };

    const onPointerMove = (event: PointerEvent) => {
        if (!state.resizing) return;

        const dx = (event.clientX - state.pointerDownCoordinates.x) * -1;
        const ds = dx / state.initialWidth;

        setState(current => ({ ...current, ds }));
    };

    const onPointerUp = (event: PointerEvent) => {
        if (!state.resizing) return;

        scaleChanged(scale - state.ds);
        draggableChanged(true);

        setState(current => ({
            ...current,
            resizing: false,
            ds: 0,
        }));
    };

    const setRef = (element: HTMLDivElement) => {
        forwardedRef(element);
        containerRef.current = element;
    };

    const style = {
        position: styleProps.position,
        transform: `translate3d(${styleProps.transformX}px, ${
            styleProps.transformY
        }px, 0) scale(${scale - state.ds})`,
        transformOrigin: 'left',
        left: styleProps.left,
        top: styleProps.top,
    };

    return (
        <div
            {...listeners}
            {...attributes}
            id={id}
            className={className}
            onPointerDown={onPointerDown}
            onDoubleClick={onDoubleClick}
            style={style}
            ref={setRef}
        >
            {children}
            {selected && (
                <div className="node__transform">
                    <div
                        className="node__anchor-point"
                        data-direction="se"
                        onPointerEnter={beforeResize}
                        onPointerLeave={mouseLeftResizeHandle}
                        onPointerDown={event => startResize(event, 1)}
                    >
                        <svg
                            viewBox="0 0 18 18"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M1.5 1.5L16.5 16.5M16.5 16.5V7.25M16.5 16.5H7.25M1 10.25V1H10.25"
                                stroke="#3786c2"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
};
