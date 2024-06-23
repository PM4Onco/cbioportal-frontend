// https://github.com/uidotdev/usehooks/blob/main/index.js

import React, { Reducer } from 'react';

type ActionType = 'undo' | 'redo' | 'set' | 'clear';

interface State<T> {
    past: T[];
    present: T;
    future: T[];
}

interface UndoRedoAction {
    type: 'undo' | 'redo';
}

interface SetAction<T> {
    type: 'set';
    newPresent: T;
}

interface ClearAction<T> {
    type: 'clear';
    initialPresent: T;
}

type Action<T> = UndoRedoAction | SetAction<T> | ClearAction<T>;

const initialUseHistoryStateState: State<any> = {
    past: [],
    present: {},
    future: [],
};

const useHistoryStateReducer = <T>(state: State<T>, action: Action<T>) => {
    const { past, present, future } = state;

    if (action.type === 'undo') {
        return {
            past: past.slice(0, past.length - 1),
            present: past[past.length - 1],
            future: [present, ...future],
        };
    } else if (action.type === 'redo') {
        return {
            past: [...past, present],
            present: future[0],
            future: future.slice(1),
        };
    } else if (action.type === 'set') {
        const { newPresent } = action;

        if (action.newPresent === present) {
            return state;
        }

        return {
            past: [...past, present],
            present: newPresent,
            future: [],
        };
    } else {
        throw new Error('Unsupported action type');
    }
};

export function useHistoryState<T>(initialPresent = {} as T) {
    const initialPresentRef = React.useRef(initialPresent);

    const [state, dispatch] = React.useReducer<Reducer<State<T>, Action<T>>>(
        useHistoryStateReducer,
        {
            ...initialUseHistoryStateState,
            present: initialPresentRef.current,
        }
    );

    const canUndo = state.past.length !== 0;
    const canRedo = state.future.length !== 0;

    const undo = React.useCallback(() => {
        if (canUndo) {
            dispatch({ type: 'undo' });
        }
    }, [canUndo]);

    const redo = React.useCallback(() => {
        if (canRedo) {
            dispatch({ type: 'redo' });
        }
    }, [canRedo]);

    const set = React.useCallback(
        (newPresent: T) => dispatch({ type: 'set', newPresent }),
        []
    );

    const clear = React.useCallback(
        () =>
            dispatch({
                type: 'clear',
                initialPresent: initialPresentRef.current,
            }),
        []
    );

    return { state: state.present, set, undo, redo, clear, canUndo, canRedo };
}
