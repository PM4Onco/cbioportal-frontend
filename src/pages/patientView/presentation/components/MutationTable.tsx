import MutationTableWrapper from 'pages/patientView/mutation/MutationTableWrapper';
import React, { RefObject, useEffect } from 'react';
import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';

interface Props {
    stateChanged: StateChangedFn;
    draggableChanged: DraggableChangedFn;
    selectedChanged: SelectedChangedFn;
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
    return (
        <div className="presentation__mutation-table">
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
