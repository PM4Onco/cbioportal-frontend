import {
    Action,
    State,
    useHistoryStateReducer,
} from 'shared/lib/hooks/use-history-state';

test('undo on invalid slide', () => {
    const state: State<any> = new Map();
    const action: Action<any> = {
        type: 'undo',
        slideId: 'test',
    };

    expect(() => useHistoryStateReducer(state, action)).toThrow();
});

test('redo on invalid slide', () => {
    const state: State<any> = new Map();
    const action: Action<any> = {
        type: 'redo',
        slideId: 'test',
    };

    expect(() => useHistoryStateReducer(state, action)).toThrow();
});

test('set on empty state', () => {
    const slideId = 'test';
    const state: State<string> = new Map();
    const action: Action<string> = {
        type: 'set',
        slideId: slideId,
        newPresent: 'Hello World',
    };

    const newState = useHistoryStateReducer(state, action);
    const slide = newState.get(slideId);

    expect(slide).toBeDefined();
    expect(slide?.past.length).toBe(1);
    expect(slide?.present).toBe('Hello World');
    expect(slide?.future.length).toBe(0);
});

test('set on non-empty state', () => {
    const slideId = 'test';
    const state: State<string> = new Map(
        Object.entries({ default: { past: [], present: 'Moin', future: [] } })
    );
    const action: Action<string> = {
        type: 'set',
        slideId: slideId,
        newPresent: 'Hello World',
    };

    const newState = useHistoryStateReducer(state, action);
    const slide = newState.get(slideId);

    expect(slide).toBeDefined();
    console.log(newState);
    expect(slide?.past.length).toBe(1);
    expect(slide?.present).toBe('Hello World');
    expect(slide?.future.length).toBe(0);
});

test('set on existing slide', () => {
    const slideId = 'test';
    const state: State<string> = new Map(
        Object.entries({ test: { past: [], present: 'Moin', future: [] } })
    );
    const action: Action<string> = {
        type: 'set',
        slideId: slideId,
        newPresent: 'Hello World',
    };

    const newState = useHistoryStateReducer(state, action);
    const slide = newState.get(slideId);

    expect(slide).toBeDefined();
    console.log(newState);
    expect(slide?.past.length).toBe(1);
    expect(slide?.present).toBe('Hello World');
    expect(slide?.past[0]).toBe('Moin');
    expect(slide?.future.length).toBe(0);
});
