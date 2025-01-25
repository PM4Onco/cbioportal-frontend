import React, { RefObject, useState } from 'react';
import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';
import StructuralVariantTableWrapper from 'pages/patientView/structuralVariant/StructuralVariantTableWrapper';
import { getServerConfig } from 'config/config';
import CopyNumberTableWrapper from 'pages/patientView/copyNumberAlterations/CopyNumberTableWrapper';
import PatientViewCnaDataStore from 'pages/patientView/copyNumberAlterations/PatientViewCnaDataStore';
import { IColumnVisibilityDef } from 'shared/components/columnVisibilityControls/ColumnVisibilityControls';
import { toggleColumnVisibility } from 'cbioportal-frontend-commons';

interface Props {
    stateChanged: StateChangedFn;
    draggableChanged: DraggableChangedFn;
    selectedChanged: SelectedChangedFn;
    initialValue: null;
    innerRef: RefObject<HTMLDivElement>;
    patientViewPageStore: any;
    dataStore: PatientViewCnaDataStore;
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

export const CNATable = ({
    innerRef,
    stateChanged,
    draggableChanged,
    ...props
}: Props) => {
    const [columnVisibility, setColumnVisibility] = useState<{
        [columnId: string]: boolean;
    }>({});

    function onCnaTableColumnVisibilityToggled(
        columnId: string,
        columnVisibilityDefs?: IColumnVisibilityDef[]
    ) {
        setColumnVisibility(
            toggleColumnVisibility(
                columnVisibility,
                columnId,
                columnVisibilityDefs
            )
        );
    }

    return (
        <div className="presentation__cna-table">
            <CopyNumberTableWrapper
                pageStore={props.patientViewPageStore}
                dataStore={props.dataStore}
                sampleIds={
                    props.sampleManager
                        ? props.sampleManager.getActiveSampleIdsInOrder()
                        : []
                }
                sampleManager={props.sampleManager}
                enableOncoKb={getServerConfig().show_oncokb}
                columnVisibility={columnVisibility}
                onFilterGenes={() => {}}
                columnVisibilityProps={{
                    onColumnToggled: onCnaTableColumnVisibilityToggled,
                }}
                onSelectGenePanel={() => {}}
                disableTooltip={false}
                mergeOncoKbIcons={props.mergeOncoKbIcons}
                onOncoKbIconToggle={props.onOncoKbIconToggle}
                onRowClick={() => {}}
                namespaceColumns={
                    props.patientViewPageStore.namespaceColumnConfig.cna
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
