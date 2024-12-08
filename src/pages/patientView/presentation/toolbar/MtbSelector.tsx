// Based on https://floating-ui.com/docs/popover
import React, { useState } from 'react';

import './toolbar-item.scss';
import {
    autoUpdate,
    flip,
    FloatingFocusManager,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useId,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import { IMtb } from 'cbioportal-utils';

type MtbSelectedFn = (mtb: IMtb) => void;

interface ItemProps {
    mtb: IMtb;
}

const MtbItem = ({
    mtb,
    onClick,
}: ItemProps & React.HTMLProps<HTMLDivElement>) => {
    function formatDate(dateAsString: string) {
        const date = new Date(dateAsString);
        return (
            ('0' + date.getDate()).slice(-2) +
            '.' +
            ('0' + (date.getMonth() + 1)).slice(-2) +
            '.' +
            date.getFullYear()
        );
    }

    return (
        <div className="mtb-selector__container" onClick={onClick}>
            <div className="mtb-selector__info">
                <div className="mtb-selector__date">{formatDate(mtb.date)}</div>
                <div className="mtb-selector__status">{mtb.mtbState}</div>
            </div>
            <div className="mtb-selector__summary">
                {mtb.generalRecommendation}
            </div>
        </div>
    );
};

interface SelectorProps {
    active?: boolean;
    tourClass?: string;
    mtbs: IMtb[];
    mtbSelected: MtbSelectedFn;
}

export const MtbSelector = ({
    mtbs,
    mtbSelected,
    tourClass,
}: SelectorProps & React.HTMLProps<HTMLButtonElement>) => {
    const [isOpen, setIsOpen] = useState(false);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [
            offset(10),
            flip({ fallbackAxisSideDirection: 'end' }),
            shift(),
        ],
        whileElementsMounted: autoUpdate,
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const role = useRole(context);

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss,
        role,
    ]);

    const headingId = useId();

    function onClick(mtb: IMtb) {
        mtbSelected(mtb);
        setIsOpen(false);
    }

    return (
        <>
            <button
                ref={refs.setReference}
                {...getReferenceProps()}
                data-tour={tourClass}
                className="toolbar__menu-item"
            >
                <i className="fa fa-medkit"></i>
            </button>
            {isOpen && (
                <FloatingFocusManager context={context} modal={false}>
                    <div
                        className="toolbar__mtb-selector"
                        ref={refs.setFloating}
                        style={floatingStyles}
                        aria-labelledby={headingId}
                        {...getFloatingProps()}
                    >
                        <h2 id={headingId}>
                            Add therapy recommendations from MTB
                        </h2>
                        {mtbs.map(mtb => (
                            <MtbItem mtb={mtb} onClick={() => onClick(mtb)} />
                        ))}
                    </div>
                </FloatingFocusManager>
            )}
        </>
    );
};
