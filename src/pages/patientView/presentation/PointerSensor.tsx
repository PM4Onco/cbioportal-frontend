import {
    subtract as getCoordinatesDelta,
    getEventCoordinates,
    getOwnerDocument,
    getWindow,
} from '@dnd-kit/utilities';

import {
    DistanceMeasurement,
    DraggableNode,
    SensorContext,
    UniqueIdentifier,
} from '@dnd-kit/core';
import { Coordinates } from '@dnd-kit/utilities';
import { MutableRefObject } from 'react';

const defaultCoordinates: Coordinates = Object.freeze({
    x: 0,
    y: 0,
});

function getEventListenerTarget(
    target: EventTarget | null
): EventTarget | Document {
    // If the `event.target` element is removed from the document events will still be targeted
    // at it, and hence won't always bubble up to the window or document anymore.
    // If there is any risk of an element being removed while it is being dragged,
    // the best practice is to attach the event listeners directly to the target.
    // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget

    const { EventTarget } = getWindow(target);

    return target instanceof EventTarget ? target : getOwnerDocument(target);
}

function hasExceededDistance(
    delta: Coordinates,
    measurement: DistanceMeasurement
): boolean {
    const dx = Math.abs(delta.x);
    const dy = Math.abs(delta.y);

    if (typeof measurement === 'number') {
        return Math.sqrt(dx ** 2 + dy ** 2) > measurement;
    }

    if ('x' in measurement && 'y' in measurement) {
        return dx > measurement.x && dy > measurement.y;
    }

    if ('x' in measurement) {
        return dx > measurement.x;
    }

    if ('y' in measurement) {
        return dy > measurement.y;
    }

    return false;
}

class Listeners {
    private listeners: [
        string,
        EventListenerOrEventListenerObject,
        AddEventListenerOptions | boolean | undefined
    ][] = [];

    constructor(private target: EventTarget | null) {}

    public add<T extends Event>(
        eventName: string,
        handler: (event: T) => void,
        options?: AddEventListenerOptions | boolean
    ) {
        this.target?.addEventListener(
            eventName,
            handler as EventListener,
            options
        );
        this.listeners.push([eventName, handler as EventListener, options]);
    }

    public removeAll = () => {
        this.listeners.forEach(listener =>
            this.target?.removeEventListener(...listener)
        );
    };
}

enum EventName {
    Click = 'click',
    DragStart = 'dragstart',
    Keydown = 'keydown',
    ContextMenu = 'contextmenu',
    Resize = 'resize',
    SelectionChange = 'selectionchange',
    VisibilityChange = 'visibilitychange',
}

function preventDefault(event: Event) {
    event.preventDefault();
}

function stopPropagation(event: Event) {
    event.stopPropagation();
}

enum KeyboardCode {
    Space = 'Space',
    Down = 'ArrowDown',
    Right = 'ArrowRight',
    Left = 'ArrowLeft',
    Up = 'ArrowUp',
    Esc = 'Escape',
    Enter = 'Enter',
}

export type SensorOptions = {};

export interface SensorProps<T> {
    active: UniqueIdentifier;
    activeNode: DraggableNode;
    event: Event;
    context: MutableRefObject<SensorContext>;
    options: T;
    onStart(coordinates: Coordinates): void;
    onCancel(): void;
    onMove(coordinates: Coordinates): void;
    onEnd(): void;
}

export type SensorInstance = {
    autoScrollEnabled: boolean;
};

interface DistanceConstraint {
    distance: DistanceMeasurement;
    tolerance?: DistanceMeasurement;
}

interface DelayConstraint {
    delay: number;
    tolerance: DistanceMeasurement;
}

interface EventDescriptor {
    name: keyof DocumentEventMap;
    passive?: boolean;
}

export interface PointerEventHandlers {
    move: EventDescriptor;
    end: EventDescriptor;
}

export type PointerActivationConstraint =
    | DelayConstraint
    | DistanceConstraint
    | (DelayConstraint & DistanceConstraint);

function isDistanceConstraint(
    constraint: PointerActivationConstraint
): constraint is PointerActivationConstraint & DistanceConstraint {
    return Boolean(constraint && 'distance' in constraint);
}

function isDelayConstraint(
    constraint: PointerActivationConstraint
): constraint is DelayConstraint {
    return Boolean(constraint && 'delay' in constraint);
}

export interface AbstractPointerSensorOptions extends SensorOptions {
    activationConstraint?: PointerActivationConstraint;
    bypassActivationConstraint?(
        props: Pick<
            AbstractPointerSensorProps,
            'activeNode' | 'event' | 'options'
        >
    ): boolean;
    onActivation?({ event }: { event: Event }): void;
}

export type AbstractPointerSensorProps = SensorProps<
    AbstractPointerSensorOptions
>;

export class AbstractPointerSensor implements SensorInstance {
    public autoScrollEnabled = true;
    private document: Document;
    private activated: boolean = false;
    private initialCoordinates: Coordinates;
    private timeoutId: NodeJS.Timeout | null = null;
    private listeners: Listeners;
    private documentListeners: Listeners;
    private windowListeners: Listeners;

    constructor(
        private props: AbstractPointerSensorProps,
        private events: PointerEventHandlers,
        listenerTarget = getEventListenerTarget(props.event.target)
    ) {
        const { event } = props;
        const { target } = event;

        this.props = props;
        this.events = events;
        this.document = getOwnerDocument(target);
        this.documentListeners = new Listeners(this.document);
        this.listeners = new Listeners(listenerTarget);
        this.windowListeners = new Listeners(getWindow(target));
        this.initialCoordinates =
            getEventCoordinates(event) ?? defaultCoordinates;
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        // this.removeTextSelection = this.removeTextSelection.bind(this);

        this.attach();
    }

    private attach() {
        const {
            events,
            props: {
                options: { activationConstraint, bypassActivationConstraint },
            },
        } = this;

        this.listeners.add(events.move.name, this.handleMove, {
            passive: false,
        });
        this.listeners.add(events.end.name, this.handleEnd);
        this.windowListeners.add(EventName.Resize, this.handleCancel);
        this.windowListeners.add(EventName.DragStart, preventDefault);
        this.windowListeners.add(EventName.VisibilityChange, this.handleCancel);
        this.windowListeners.add(EventName.ContextMenu, preventDefault);
        this.documentListeners.add(EventName.Keydown, this.handleKeydown);

        if (activationConstraint) {
            if (
                bypassActivationConstraint?.({
                    event: this.props.event,
                    activeNode: this.props.activeNode,
                    options: this.props.options,
                })
            ) {
                return this.handleStart();
            }

            if (isDelayConstraint(activationConstraint)) {
                this.timeoutId = setTimeout(
                    this.handleStart,
                    activationConstraint.delay
                );
                return;
            }

            if (isDistanceConstraint(activationConstraint)) {
                return;
            }
        }

        this.handleStart();
    }

    private detach() {
        this.listeners.removeAll();
        this.windowListeners.removeAll();

        // Wait until the next event loop before removing document listeners
        // This is necessary because we listen for `click` and `selection` events on the document
        setTimeout(this.documentListeners.removeAll, 50);

        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    private handleStart() {
        const { initialCoordinates } = this;
        const { onStart } = this.props;

        if (initialCoordinates) {
            this.activated = true;

            // Stop propagation of click events once activation constraints are met
            this.documentListeners.add(EventName.Click, stopPropagation, {
                capture: true,
            });

            // Prevent further text selection while dragging
            // this.documentListeners.add(
            //     EventName.SelectionChange,
            //     this.removeTextSelection
            // );

            onStart(initialCoordinates);
        }
    }

    private handleMove(event: Event) {
        const { activated, initialCoordinates, props } = this;
        const {
            onMove,
            options: { activationConstraint },
        } = props;

        if (!initialCoordinates) {
            return;
        }

        const coordinates = getEventCoordinates(event) ?? defaultCoordinates;
        const delta = getCoordinatesDelta(initialCoordinates, coordinates);

        // Constraint validation
        if (!activated && activationConstraint) {
            if (isDistanceConstraint(activationConstraint)) {
                if (
                    activationConstraint.tolerance != null &&
                    hasExceededDistance(delta, activationConstraint.tolerance)
                ) {
                    return this.handleCancel();
                }

                if (hasExceededDistance(delta, activationConstraint.distance)) {
                    return this.handleStart();
                }
            }

            if (isDelayConstraint(activationConstraint)) {
                if (
                    hasExceededDistance(delta, activationConstraint.tolerance)
                ) {
                    return this.handleCancel();
                }
            }

            return;
        }

        if (event.cancelable) {
            event.preventDefault();
        }

        onMove(coordinates);
    }

    private handleEnd() {
        const { onEnd } = this.props;

        this.detach();
        onEnd();
    }

    private handleCancel() {
        const { onCancel } = this.props;

        this.detach();
        onCancel();
    }

    private handleKeydown(event: KeyboardEvent) {
        if (event.code === KeyboardCode.Esc) {
            this.handleCancel();
        }
    }

    private removeTextSelection() {
        this.document.getSelection()?.removeAllRanges();
    }
}

const events: PointerEventHandlers = {
    move: { name: 'pointermove' },
    end: { name: 'pointerup' },
};

export interface PointerSensorOptions extends AbstractPointerSensorOptions {}

export type PointerSensorProps = SensorProps<PointerSensorOptions>;

export class PointerSensor extends AbstractPointerSensor {
    constructor(props: PointerSensorProps) {
        const { event } = props;
        // Pointer events stop firing if the target is unmounted while dragging
        // Therefore we attach listeners to the owner document instead
        const listenerTarget = getOwnerDocument(event.target);

        super(props, events, listenerTarget);
    }

    static activators = [
        {
            eventName: 'onPointerDown' as const,
            handler: (
                { nativeEvent: event }: any,
                { onActivation }: PointerSensorOptions
            ) => {
                if (!event.isPrimary || event.button !== 0) {
                    return false;
                }

                onActivation?.({ event });

                return true;
            },
        },
    ];
}
