import React from 'react';
import {
    autoUpdate,
    flip,
    offset,
    shift,
    useFloating,
} from '@floating-ui/react';

interface Props {
    referenceRef: HTMLDivElement | null;
}

export const TableToolbar = ({
    referenceRef,
    children,
}: Props & React.HTMLProps<HTMLButtonElement>) => {
    const { refs, floatingStyles, context } = useFloating({
        open: true,
        middleware: [offset(10), shift(), flip()],
        placement: 'top',
        whileElementsMounted: autoUpdate,
        elements: {
            reference: referenceRef,
        },
    });

    return (
        <div ref={refs.setFloating} style={floatingStyles} className="toolbar">
            <div className="toolbar__item-container">{children}</div>
        </div>
    );
};
