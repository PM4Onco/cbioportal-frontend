import { DraggableChangedFn } from 'pages/patientView/presentation/model/dynamic-component';
import React, { useEffect } from 'react';
import { Coordinates } from '@dnd-kit/utilities';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { DraggableAttributes } from '@dnd-kit/core';

interface Props {
    id: string;
    width: number;
    height?: number | null;
    children: any;
    draggableChanged: DraggableChangedFn;
    dimensionsChanged: (width: number, height: number | undefined) => void;
    className: string;
    onPointerDown: (event: React.PointerEvent) => void;
    forwardedRef: (element: HTMLDivElement) => void;
    style: Record<string, any>;
    listeners: SyntheticListenerMap | undefined;
    attributes: DraggableAttributes;
    selected: boolean;
}

interface State {
    resizing: boolean;
    pointerDownCoordinates: Coordinates;
    dx: number;
    dy: number;
}

export const Resizable = ({
    id,
    width,
    height,
    draggableChanged,
    children,
    dimensionsChanged,
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
        dy: 0,
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

    const startResize = (event: any) => {
        event.persist();
        setState(current => ({
            ...current,
            resizing: true,
            pointerDownCoordinates: { x: event.clientX, y: event.clientY },
        }));
    };

    const onPointerMove = (event: PointerEvent) => {
        if (!state.resizing) return;

        const dx = event.clientX - state.pointerDownCoordinates.x;
        const dy = event.clientY - state.pointerDownCoordinates.y;
        setState(current => ({ ...current, dx, dy }));
    };

    const onPointerUp = (event: PointerEvent) => {
        if (!state.resizing) return;

        dimensionsChanged(
            width + state.dx,
            height ? height + state.dy : undefined
        );
        draggableChanged(true);

        setState(current => ({
            ...current,
            resizing: false,
            dx: 0,
            dy: 0,
        }));
    };

    const style = {
        position: styleProps.position,
        transform: `translate3d(${styleProps.transformX}px, ${styleProps.transformY}px, 0)`,
        left: styleProps.left,
        top: styleProps.top,
        width: styleProps.width + state.dx,
        height: styleProps.height + state.dy,
    };

    return (
        <div
            {...listeners}
            {...attributes}
            className={className}
            onPointerDown={onPointerDown}
            style={style}
            ref={ref}
            id={id}
        >
            {children}
            {selected && (
                <div className="node__transform">
                    <div
                        className="node__anchor-point"
                        data-direction="se"
                        onMouseEnter={beforeResize}
                        onPointerDown={event => startResize(event)}
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
