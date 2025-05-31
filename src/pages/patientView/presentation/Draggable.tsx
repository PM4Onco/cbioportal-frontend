import React, { useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { observer } from 'mobx-react';
import {
    ComponentKeys,
    Dynamic,
    DynamicComponentProps,
    SelectedChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';
import { Resizable } from 'pages/patientView/presentation/Resizable';
import { ResizableScale } from 'pages/patientView/presentation/ResizableScale';

interface Props {
    id: string;
    slideId: number;
    left: number;
    top: number;
    width?: number | null;
    height?: number | null;
    scale?: number | null;
    component: {
        type: ComponentKeys;
        props: Omit<DynamicComponentProps<any>, 'draggableChanged'>;
    };
    selectedChanged: SelectedChangedFn;
    dimensionsChanged: DimensionsChangedFn;
    scaleChanged: ScaleChangedFn;
}

type DimensionsChangedFn = (width: number, height?: number) => void;
type ScaleChangedFn = (scale: number) => void;

interface State {
    selected: boolean;
    width?: number | null;
    height?: number | null;
    scale?: number | null;
    left: number;
}

export const Draggable = observer(
    ({
        id,
        left,
        top,
        component,
        slideId,
        selectedChanged,
        dimensionsChanged,
        scaleChanged,
        width,
        height,
        scale,
    }: Props) => {
        const containerRef = useRef<HTMLDivElement | null>(null);
        const [state, setState] = React.useState<State>({
            selected: false,
            width: width,
            height: height,
            scale: scale,
            left: 0,
        });
        const [draggable, setDraggable] = React.useState(true);

        const { attributes, listeners, setNodeRef, transform } = useDraggable({
            id,
            disabled: !draggable,
            data: {
                slideId,
            },
        });
        const toolbar = document.querySelector('.toolbar');

        useEffect(() => {
            setState(current => ({ ...current, width, height }));
        }, [width, height]);

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
            if (listeners && listeners.onPointerDown) {
                listeners.onPointerDown(event);
            }
            selectedChanged(true);
            setState(current => ({ ...current, selected: true }));
        };

        const onOutsideClick = (event: MouseEvent) => {
            if (
                event.target !== containerRef.current &&
                !containerRef.current?.contains(event.target as Node) &&
                !toolbar?.contains(event.target as Node)
            ) {
                handleEscapePress();
            }
        };

        const handleEscapePress = () => {
            setDraggable(true);
            unselectNode();
        };

        const unselectNode = () => {
            selectedChanged(false);
            setState(current => ({ ...current, selected: false }));
        };

        const style = {
            position: 'absolute' as const,
            transformX: transform?.x ?? 0,
            transformY: transform?.y ?? 0,
            transform: `translate3d(${transform?.x ?? 0}px, ${transform?.y ??
                0}px, 0)`,
            left: left + state.left,
            top,
            width: state.width ?? 'auto',
            height: state.height || 'auto',
        };

        const setContainerRef = (element: HTMLDivElement) => {
            setNodeRef(element);
            containerRef.current = element;
        };

        const onDimensionsChanged = (width: number, height?: number) => {
            setState(current => ({ ...current, width, height }));
            dimensionsChanged(width, height);
        };

        const onScaleChanged = (scale: number) => {
            setState(current => ({ ...current, scale }));
            scaleChanged(scale);
        };

        const onLeftChanged = (left: number) => {
            setState(current => ({ ...current, left }));
        };

        const disableDragging = () => {
            setDraggable(false);
        };

        return (
            <>
                {!!state.width ? (
                    <Resizable
                        id={id}
                        width={state.width}
                        height={state.height}
                        draggableChanged={draggable => setDraggable(draggable)}
                        dimensionsChanged={onDimensionsChanged}
                        selected={state.selected}
                        forwardedRef={setContainerRef}
                        style={style}
                        listeners={listeners}
                        attributes={attributes}
                        className={
                            state.selected ? 'presentation__node--selected' : ''
                        }
                        onPointerDown={onPointerDown}
                    >
                        {Dynamic(component.type, {
                            ...component.props,
                            draggableChanged: draggable =>
                                setDraggable(draggable),
                        })}
                    </Resizable>
                ) : [
                      'mutationTable',
                      'timeline',
                      'fusionTable',
                      'cnaTable',
                  ].includes(component.type) ? (
                    <ResizableScale
                        id={id}
                        scale={
                            typeof state.scale === 'number' ? state.scale : 1
                        }
                        left={state.left}
                        draggableChanged={draggable => setDraggable(draggable)}
                        scaleChanged={onScaleChanged}
                        leftChanged={onLeftChanged}
                        selected={state.selected}
                        forwardedRef={setContainerRef}
                        style={style}
                        listeners={listeners}
                        attributes={attributes}
                        className={`${
                            state.selected ? 'presentation__node--selected' : ''
                        } ${
                            draggable
                                ? 'presentation__node--draggable'
                                : 'presentation__node--not-draggable'
                        }`}
                        onPointerDown={onPointerDown}
                        onDoubleClick={() => disableDragging()}
                    >
                        {Dynamic(component.type, {
                            ...component.props,
                            draggableChanged: draggable =>
                                setDraggable(draggable),
                        })}
                    </ResizableScale>
                ) : (
                    <div
                        ref={setContainerRef}
                        style={style}
                        {...listeners}
                        {...attributes}
                        id={id}
                        className={
                            state.selected && component.type !== 'text'
                                ? 'presentation__node--selected presentation__node'
                                : 'presentation__node'
                        }
                        onPointerDown={onPointerDown}
                    >
                        {Dynamic(component.type, {
                            ...component.props,
                            draggableChanged: draggable =>
                                setDraggable(draggable),
                        })}
                    </div>
                )}
            </>
        );
    }
);
