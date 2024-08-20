// Based on https://github.com/uidotdev/usehooks/blob/main/index.js

import { Reducer, useCallback, useReducer } from 'react';
import { Node } from 'pages/patientView/presentation/model/node';

export type State<T> = Map<string, TimeState<T>>;

interface TimeState<T> {
    past: T[];
    present: T;
    future: T[];
}

interface UndoRedoAction {
    type: 'undo' | 'redo';
    slideId: string;
}

interface SetAction<T> {
    type: 'set';
    newPresent: T;
    slideId: string;
}

interface ClearAction {
    type: 'clear';
    slides: Slides;
}

export type Action<T> = UndoRedoAction | SetAction<T> | ClearAction;

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export type Slides = {[slideId: UUID]: Node<any>};

const ensureValidActionForSlide = <T>(
    slide: TimeState<T> | undefined,
    action: Action<T>,
) => {
    if (!slide && action.type !== 'set') {
        throw new Error(`invalid action=(${action.type}) for new slide`);
    }
};

const getOrCreateTimeStateForSlide = <T>(
    slide: TimeState<T> | undefined,
): TimeState<T> => {
    if (slide) {
        return slide;
    }

    return {
        past: [],
        present: null!, // TODO: fix this type
        future: [],
    };
};

export const useHistoryStateReducer = <T>(
    state: State<T>,
    action: Action<T>,
): State<T> => {
    if(action.type === 'clear') {
        const slides = action.slides;
        const newState = new Map();

        for(const [slideId, nodes] of Object.entries(slides)) {
           newState.set(slideId, {
               past: [],
               present: nodes,
               future: []
           });
        }

        console.log(newState)

        return newState;
    }

    const slideId = action.slideId;
    const slide = state.get(slideId);

    ensureValidActionForSlide(slide, action);

    const { past, present, future } = getOrCreateTimeStateForSlide(slide);

    if (action.type === 'undo') {
        const newState = new Map(state);
        return newState.set(slideId, {
            past: past.slice(0, past.length - 1),
            present: past[past.length - 1],
            future: [present, ...future],
        });
    } else if (action.type === 'redo') {
        const newState = new Map(state);
        return newState.set(slideId, {
            past: [...past, present],
            present: future[0],
            future: future.slice(1),
        });
    } else if (action.type === 'set') {
        const { newPresent } = action;

        if (action.newPresent === present) {
            return state;
        }

        const newState = new Map(state);
        return newState.set(slideId, {
            past: [...past, present],
            present: newPresent,
            future: [],
        });
    } else {
        throw new Error('Unsupported action type');
    }
};

export function useHistoryState<T>(initialState?: {
    slideId: string;
    initialPresent: T;
}) {
    const initialUseHistoryState = new Map();

    if (initialState) {
        const { slideId, initialPresent } = initialState;
        initialUseHistoryState.set(slideId, {
            past: [],
            present: initialPresent,
            future: [],
        });
    }

    const [state, dispatch] = useReducer<Reducer<State<T>, Action<T>>>(
        useHistoryStateReducer,
        initialUseHistoryState,
    );

    const canUndo = useCallback(
        (slideId: string) => {
            const slide = state.get(slideId);
            const pastLength = slide?.past.length ?? 0;
            return pastLength > 0;
        },
        [state],
    );

    const canRedo = useCallback(
        (slideId: string) => {
            const slide = state.get(slideId);
            const futureLength = slide?.future.length ?? 0;
            return futureLength > 0;
        },
        [state],
    );

    const undo = useCallback(
        (slideId: string) => {
            if (canUndo(slideId)) {
                dispatch({ type: 'undo', slideId });
            }
        },
        [canUndo],
    );

    const redo = useCallback(
        (slideId: string) => {
            if (canRedo(slideId)) {
                dispatch({ type: 'redo', slideId });
            }
        },
        [canRedo],
    );

    const set = useCallback(
        (slideId: string, newPresent: T) =>
            dispatch({ type: 'set', newPresent, slideId }),
        [],
    );

    const clear = useCallback((slides: Slides) => dispatch({ type: 'clear', slides }), []);

    return { state: state, set, undo, redo, clear, canUndo, canRedo };
}
