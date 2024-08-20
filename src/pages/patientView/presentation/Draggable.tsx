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

type Width = number | 'auto';

interface Props {
    id: string;
    slideId: string;
    left: number;
    top: number;
    width: Width;
    resizable: boolean;
    component: {
        type: ComponentKeys;
        props: Omit<DynamicComponentProps<any>, 'draggableChanged'>;
    };
    selectedChanged: SelectedChangedFn;
}

interface State {
    selected: boolean;
    width: Width;
    left: number;
}

export const Draggable = observer(
    ({ id, left, top, component, slideId, selectedChanged, width }: Props) => {
        const containerRef = useRef<HTMLDivElement | null>(null);
        const [state, setState] = React.useState<State>({
            selected: false,
            width: width || 'auto',
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

        const onPointerUp = () => {
            setDraggable(true);
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
                !containerRef.current?.contains(event.target as Node)
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

        const style = {
            position: 'absolute' as const,
            transformX: transform?.x ?? 0,
            transformY: transform?.y ?? 0,
            transform: `translate3d(${transform?.x ?? 0}px, ${transform?.y ??
                0}px, 0)`,
            left: left + state.left,
            top,
            width: state.width,
        };

        const setContainerRef = (element: HTMLDivElement) => {
            setNodeRef(element);
            containerRef.current = element;
        };

        const onWidthChanged = (width: number) => {
            setState(current => ({ ...current, width }));
        };

        const onLeftChanged = (left: number) => {
            setState(current => ({ ...current, left }));
        };

        return width !== 'auto' ? (
            <Resizable
                width={typeof state.width === 'number' ? state.width : 200}
                left={state.left}
                draggableChanged={draggable => setDraggable(draggable)}
                widthChanged={onWidthChanged}
                leftChanged={onLeftChanged}
                selected={state.selected}
                forwardedRef={setContainerRef}
                style={style}
                listeners={listeners}
                attributes={attributes}
                className={state.selected ? 'presentation__node--selected' : ''}
                onPointerDown={onPointerDown}
            >
                {Dynamic(component.type, {
                    ...component.props,
                    draggableChanged: draggable => setDraggable(draggable),
                })}
            </Resizable>
        ) : (
            <div
                ref={setContainerRef}
                style={style}
                {...listeners}
                {...attributes}
                className={state.selected ? 'presentation__node--selected' : ''}
                onPointerDown={onPointerDown}
            >
                {Dynamic(component.type, {
                    ...component.props,
                    draggableChanged: draggable => setDraggable(draggable),
                })}
            </div>
        );
    }
);
