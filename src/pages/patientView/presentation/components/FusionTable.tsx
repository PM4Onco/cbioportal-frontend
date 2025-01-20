import MutationTableWrapper from 'pages/patientView/mutation/MutationTableWrapper';
import React, { RefObject, useEffect, useRef } from 'react';
import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';
import StructuralVariantTableWrapper from 'pages/patientView/structuralVariant/StructuralVariantTableWrapper';
import { getServerConfig } from 'config/config';

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

export const FusionTable = ({
    innerRef,
    stateChanged,
    draggableChanged,
    ...props
}: Props) => {
    return (
        <div className="presentation__fusion-table">
            <StructuralVariantTableWrapper
                store={props.patientViewPageStore}
                onSelectGenePanel={() => console.log('hm')}
                mergeOncoKbIcons={props.mergeOncoKbIcons}
                onOncoKbIconToggle={() => console.log('oncokbtoggle')}
                enableOncoKb={getServerConfig().show_oncokb}
                sampleIds={
                    props.sampleManager
                        ? props.sampleManager.getActiveSampleIdsInOrder()
                        : []
                }
                namespaceColumns={
                    props.patientViewPageStore.namespaceColumnConfig.structVar
                }
                customDriverName={
                    getServerConfig()
                        .oncoprint_custom_driver_annotation_binary_menu_label!
                }
                customDriverDescription={
                    getServerConfig()
                        .oncoprint_custom_driver_annotation_binary_menu_description!
                }
                customDriverTiersName={
                    getServerConfig()
                        .oncoprint_custom_driver_annotation_tiers_menu_label!
                }
                customDriverTiersDescription={
                    getServerConfig()
                        .oncoprint_custom_driver_annotation_tiers_menu_description!
                }
            />
        </div>
    );
};
