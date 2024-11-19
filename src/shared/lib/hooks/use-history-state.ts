// Based on https://github.com/uidotdev/usehooks/blob/main/index.js

import { Reducer, useCallback, useReducer } from 'react';
import { Node } from 'pages/patientView/presentation/model/node';

export type State<T> = Map<number, TimeState<T>>;

interface TimeState<T> {
    past: T[];
    present: T;
    future: T[];
}

interface UndoRedoAction {
    type: 'undo' | 'redo';
    slideId: number;
}

interface SetAction<T> {
    type: 'set';
    newPresent: T;
    slideId: number;
}

interface SetHistoryAction<T> {
    type: 'setHistory';
    state: TimeState<T>;
    slideId: number;
}

interface ClearAction {
    type: 'clear';
    slides: Slides;
}

interface RemoveAction {
    type: 'remove';
    slideId: number;
}

interface InsertAction<T> {
    type: 'insert';
    newPresent: T;
    slideId: number;
}

export type Action<T> =
    | UndoRedoAction
    | SetAction<T>
    | SetHistoryAction<T>
    | RemoveAction
    | InsertAction<T>
    | ClearAction;

export type Slides = { [slideId: number]: Node<any> };

const ensureValidActionForSlide = <T>(
    slide: TimeState<T> | undefined,
    action: Action<T>
) => {
    if (!slide && action.type !== 'set' && action.type !== 'insert') {
        throw new Error(`invalid action=(${action.type}) for new slide`);
    }
};

const getOrCreateTimeStateForSlide = <T>(
    slide: TimeState<T> | undefined
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
    action: Action<T>
): State<T> => {
    if (action.type === 'clear') {
        const slides = action.slides;
        const newState = new Map();

        for (const [slideId, nodes] of Object.entries(slides)) {
            newState.set(Number(slideId), {
                past: [],
                present: nodes,
                future: [],
            });
        }

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

        if (newPresent === present) {
            return state;
        }

        const newState = new Map(state);
        return newState.set(slideId, {
            past: [...past, present],
            present: newPresent,
            future: [],
        });
    } else if (action.type === 'setHistory') {
        const newState = new Map(state);

        return newState.set(slideId, action.state);
    } else if (action.type === 'remove') {
        const newState = new Map();
        let newId = 1;

        // we cannot just delete because we need to fix the indices
        for (const [oldId, value] of state.entries()) {
            if (oldId === slideId) {
                continue;
            }

            newState.set(newId++, value);
        }

        return newState;
    } else if (action.type === 'insert') {
        if (!state.has(slideId)) {
            const { newPresent } = action;

            if (newPresent === present) {
                return state;
            }

            const newState = new Map(state);

            return newState.set(slideId, {
                past: [...past, present],
                present: newPresent,
                future: [],
            });
        }

        const newState = new Map();
        let newId = 1;

        for (const [oldId, value] of state.entries()) {
            if (oldId === slideId) {
                newState.set(newId++, {
                    past: [...past, present],
                    present: action.newPresent,
                    future: [],
                });
            }

            newState.set(newId++, value);
        }

        return newState;
    } else {
        throw new Error('Unsupported action type');
    }
};

export function useHistoryState<T>(initialState?: {
    slideId: number;
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
        initialUseHistoryState
    );

    const canUndo = useCallback(
        (slideId: number) => {
            const slide = state.get(slideId);
            const pastLength = slide?.past.length ?? 0;
            return pastLength > 0;
        },
        [state]
    );

    const canRedo = useCallback(
        (slideId: number) => {
            const slide = state.get(slideId);
            const futureLength = slide?.future.length ?? 0;
            return futureLength > 0;
        },
        [state]
    );

    const undo = useCallback(
        (slideId: number) => {
            if (canUndo(slideId)) {
                dispatch({ type: 'undo', slideId });
            }
        },
        [canUndo]
    );

    const redo = useCallback(
        (slideId: number) => {
            if (canRedo(slideId)) {
                dispatch({ type: 'redo', slideId });
            }
        },
        [canRedo]
    );

    const set = useCallback(
        (slideId: number, newPresent: T) =>
            dispatch({ type: 'set', newPresent, slideId }),
        []
    );

    const setHistory = useCallback((slideId: number, state: TimeState<T>) => {
        dispatch({ type: 'setHistory', state, slideId });
    }, []);

    const remove = useCallback((slideId: number) => {
        dispatch({ type: 'remove', slideId });
    }, []);

    const insert = useCallback((slideId: number, newPresent: T) => {
        dispatch({ type: 'insert', newPresent, slideId });
    }, []);

    const clear = useCallback(
        (slides: Slides) => dispatch({ type: 'clear', slides }),
        []
    );

    return {
        state: state,
        set,
        setHistory,
        insert,
        remove,
        undo,
        redo,
        clear,
        canUndo,
        canRedo,
    };
}
