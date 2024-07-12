import MutationTableWrapper from 'pages/patientView/mutation/MutationTableWrapper';
import React, { RefObject, useEffect } from 'react';
import { boundMethod } from 'autobind-decorator';

interface State {
    down: boolean;
    selected: boolean;
    editing: boolean;
}

interface Props {
    stateChanged: (value: any, draggable: boolean) => void;
    draggableChanged: (draggable: boolean) => void;
    initialValue: null;
    innerRef: RefObject<HTMLDivElement>;
    patientViewPageStore: any;
    dataStore: any;
    sampleManager: any;
    sampleIds: string[];
    mergeOncoKbIcons: boolean;
    onOncoKbIconToggle: (mergeIcons: boolean) => void;
    columnVisibility: { [columnId: string]: boolean } | undefined;
    onFilterGenes: (option: any) => void;
    columnVisibilityProps: any;
    onSelectGenePanel: (name: string) => void;
    disableTooltip: boolean;
    onRowClick: (d: any[]) => void;
    onRowMouseEnter: (d: any[]) => void;
    onRowMouseLeave: (d: any[]) => void;
    namespaceColumns: any;
    columns: string[];
    pageMode: 'sample' | 'patient';
    alleleFreqHeaderRender: ((name: string) => JSX.Element) | undefined;
}

export const MutationTable = ({
    innerRef,
    stateChanged,
    draggableChanged,
    ...props
}: Props) => {
    const [state, setState] = React.useState<State>({
        down: false,
        selected: false,
        editing: false,
    });

    useEffect(() => {
        const controller = new AbortController();
        (document as any).addEventListener('pointerup', onPointerUp, {
            signal: controller.signal,
        });
        (document as any).addEventListener('keydown', onKeyDown, {
            signal: controller.signal,
        });
        (document as any).addEventListener('pointerdown', onOutsideClick, {
            signal: controller.signal,
        });

        return () => {
            controller.abort();
        };
    }, [state]);

    const focus = () => {
        if (!innerRef) return;
        innerRef.current?.focus();
        document.getSelection()!.collapse(innerRef.current, 1);
    };

    const startEditing = () => {
        setState(current => ({ ...current, editing: true }));
        setTimeout(() => focus());
    };

    const onPointerDown = (event: React.PointerEvent) => {
        setState(current => ({ ...current, down: true, selected: true }));
    };

    const onKeyDown = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'Escape':
                handleEscapePress();
                break;
            case 'Backspace':
                handleBackspacePress();
                break;
        }
    };

    const handleEscapePress = () => {
        if (state.editing) {
            stopEditing();
        } else {
            unselectNode();
        }
    };

    const handleBackspacePress = () => {
        if (state.editing) return;
        innerRef.current?.remove();
    };

    const stopEditing = () => {
        stateChanged(null, true);
        setState(current => ({ ...current, editing: false }));
    };

    const unselectNode = () => {
        setState(current => ({ ...current, selected: false }));
    };

    const onPointerUp = (event: PointerEvent) => {
        setState(current => ({ ...current, down: false }));
    };

    const onOutsideClick = (event: MouseEvent) => {
        if (
            state.selected &&
            event.target !== innerRef.current &&
            !innerRef.current?.contains(event.target as Node)
        ) {
            handleEscapePress();
        }
    };

    return (
        <div
            ref={innerRef}
            className={`presentation__mutation-table 
                     ${state.selected ? 'presentation__node--selected' : ''} 
                     ${state.editing ? 'presentation__node--editing' : ''}
                `}
            onPointerDown={onPointerDown}
        >
            <MutationTableWrapper
                patientViewPageStore={props.patientViewPageStore}
                dataStore={props.dataStore}
                sampleManager={props.sampleManager}
                sampleIds={
                    props.sampleManager
                        ? props.sampleManager.getActiveSampleIdsInOrder()
                        : []
                }
                mergeOncoKbIcons={props.mergeOncoKbIcons}
                onOncoKbIconToggle={props.onOncoKbIconToggle}
                columnVisibility={props.columnVisibility}
                onFilterGenes={props.onFilterGenes}
                columnVisibilityProps={props.columnVisibilityProps}
                onSelectGenePanel={props.onSelectGenePanel}
                disableTooltip={props.disableTooltip}
                onRowClick={props.onRowClick}
                onRowMouseEnter={props.onRowMouseEnter}
                onRowMouseLeave={props.onRowMouseLeave}
                namespaceColumns={props.namespaceColumns}
                columns={props.columns}
                pageMode={props.pageMode}
                alleleFreqHeaderRender={undefined}
            ></MutationTableWrapper>
        </div>
    );
};
