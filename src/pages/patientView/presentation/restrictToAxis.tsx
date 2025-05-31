import { Modifier } from '@dnd-kit/core';
import {
    restrictToHorizontalAxis,
    restrictToVerticalAxis,
} from '@dnd-kit/modifiers';

export const restrictToAxis = (shiftDown: boolean): Modifier => {
    return ({ transform, ...args }) => {
        if (shiftDown) {
            const xAxis = Math.abs(transform.x) > Math.abs(transform.y);

            if (xAxis) {
                return restrictToHorizontalAxis({ transform, ...args });
            } else {
                return restrictToVerticalAxis({ transform, ...args });
            }
        }

        return transform;
    };
};
