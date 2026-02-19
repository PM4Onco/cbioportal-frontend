import React, { useEffect, useRef } from 'react';
import MtbTherapyRecommendationTable from '../therapyRecommendation/MtbTherapyRecommendationTable';

type Props = React.ComponentProps<typeof MtbTherapyRecommendationTable>;

export default function MtbTherapyRecommendationTableNoAddButtons(
    props: Props
) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const labelsToHide = new Set([
            'Add',
            'Add from OncoKB',
            'Add from template',
            'OncoKB unavailable',
        ]);

        const hide = () => {
            const buttons = Array.from(root.querySelectorAll('button'));
            for (const b of buttons) {
                const label = (b.textContent || '').replace(/\s+/g, ' ').trim();
                if (labelsToHide.has(label)) {
                    (b as HTMLButtonElement).style.display = 'none';
                }
            }
        };

        hide();
        const mo = new MutationObserver(hide);
        mo.observe(root, { childList: true, subtree: true });
        return () => mo.disconnect();
    }, []);

    return (
        <div ref={rootRef}>
            <MtbTherapyRecommendationTable {...props} />
        </div>
    );
}
