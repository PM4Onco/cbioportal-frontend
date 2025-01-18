// Based on https://floating-ui.com/docs/popover
import React, { useEffect, useState } from 'react';

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
import { IMtb, ITherapyRecommendation } from 'cbioportal-utils';

type RecommendationSelectedFn = (
    recommendation: ITherapyRecommendation
) => void;

interface ItemProps {
    mtb: IMtb;
    recommendationSelected: (recommendation: ITherapyRecommendation) => void;
}

const MtbItem = ({
    mtb,
    recommendationSelected,
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
        <div className="mtb-selector__container">
            <div className="mtb-selector__info">
                <div className="mtb-selector__date">{formatDate(mtb.date)}</div>
                <div className="mtb-selector__status">{mtb.mtbState}</div>
            </div>
            <div className="mtb-selector__summary">
                {mtb.therapyRecommendations.map((recommendation, index) => (
                    <div
                        className="mtb-selector__recommendation"
                        onClick={() => recommendationSelected(recommendation)}
                        key={recommendation.id}
                    >
                        <div className="recommendation__info">
                            <div className="recommendation__prio">
                                Prio {index}
                            </div>
                            {recommendation.reasoning.geneticAlterations?.map(
                                geneticAlteration => (
                                    <div>
                                        <strong>
                                            {geneticAlteration.hugoSymbol}
                                        </strong>{' '}
                                        {geneticAlteration.alteration}
                                    </div>
                                )
                            )}
                            –
                            <div>
                                {recommendation.treatments
                                    .map(treatment => treatment.name)
                                    .join(', ')}
                            </div>
                        </div>
                        <div className="recommendation__comment">
                            {recommendation.comment}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface SelectorProps {
    active?: boolean;
    tourClass?: string;
    mtbs: IMtb[];
    recommendationSelected: RecommendationSelectedFn;
}

export const MtbSelector = ({
    mtbs,
    recommendationSelected,
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

    useEffect(() => {
        console.log(mtbs);
    }, [mtbs]);

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const role = useRole(context);

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss,
        role,
    ]);

    const headingId = useId();

    function onClick(recommendation: ITherapyRecommendation) {
        recommendationSelected(recommendation);
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
                            Add therapy recommendation from MTB
                        </h2>
                        {mtbs.map(mtb => (
                            <MtbItem
                                mtb={mtb}
                                key={mtb.id}
                                recommendationSelected={onClick}
                            />
                        ))}
                    </div>
                </FloatingFocusManager>
            )}
        </>
    );
};
