import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { Item } from './Item';
import { UndoIcon } from 'pages/patientView/presentation/icons/UndoIcon';
import { ToggleFullscreenIcon } from 'pages/patientView/presentation/icons/ToggleFullscreenIcon';
import { RedoIcon } from 'pages/patientView/presentation/icons/RedoIcon';
import { CreateTextIcon } from 'pages/patientView/presentation/icons/CreateTextIcon';
import { AddMutationTableIcon } from 'pages/patientView/presentation/icons/AddMutationTableIcon';
import { TimelineIcon } from 'pages/patientView/presentation/icons/TimelineIcon';
import { MtbSelector } from './MtbSelector';
import { RectangleIcon } from 'pages/patientView/presentation/icons/RectangleIcon';
import { AlignmentMenu } from 'pages/patientView/presentation/toolbar/AlignmentMenu';
import { SelectedNode } from 'pages/patientView/presentation/Presentation';
import { IMtb, ITherapyRecommendation } from 'cbioportal-utils';
import { FusionIcon } from 'pages/patientView/presentation/icons/FusionIcon';
import { CNAIcon } from 'pages/patientView/presentation/icons/CNAIcon';

type VoidFn = () => void;

interface Props {
    addSlideClick: VoidFn;
    savePresentationClick: VoidFn;
    deletePresentationClick: VoidFn;
    undoClick: VoidFn;
    canUndo: boolean;
    redoClick: VoidFn;
    canRedo: boolean;
    toggleFullscreenClick: VoidFn;
    createTextClick: VoidFn;
    addMutationTableClick: VoidFn;
    addTimelineClick: VoidFn;
    addFusionTableClick: VoidFn;
    addCNATableClick: VoidFn;
    mtbs: IMtb[];
    addTherapyRecommendationClick: (
        recommendation: ITherapyRecommendation
    ) => void;
    addClinicalDataClick: VoidFn;
    addRectangleClick: VoidFn;
    showAlignmentMenu: boolean;
    selectedNode: SelectedNode;
    selectedNodePositionChange: (
        slideId: number,
        nodeId: string,
        left: number | undefined,
        top: number | undefined
    ) => void;
}

export const Toolbar = ({
    addSlideClick,
    createTextClick,
    addMutationTableClick,
    addRectangleClick,
    addClinicalDataClick,
    canRedo,
    canUndo,
    addTimelineClick,
    mtbs,
    deletePresentationClick,
    redoClick,
    savePresentationClick,
    selectedNodePositionChange,
    showAlignmentMenu,
    toggleFullscreenClick,
    undoClick,
    addTherapyRecommendationClick,
    selectedNode,
    addFusionTableClick,
    addCNATableClick,
}: Props) => {
    return (
        <div className="toolbar">
            <div className="toolbar__row-container">
                <Item onClick={addSlideClick} tourClass="add-slide">
                    Add Slide
                </Item>
                <Item onClick={savePresentationClick}>Save Presentation</Item>
                <Item onClick={deletePresentationClick}>
                    Delete Presentation
                </Item>
                <Tooltip>
                    <TooltipTrigger className="toolbar__menu-item--hug-right">
                        <Item
                            className="toolbar__menu-item--hug-right"
                            onClick={undoClick}
                            disabled={!canUndo}
                        >
                            <UndoIcon />
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">Undo</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <Item onClick={redoClick} disabled={!canRedo}>
                            <RedoIcon />
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">Redo</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <Item onClick={toggleFullscreenClick}>
                            <ToggleFullscreenIcon />
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">
                        Enable fullscreen
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="toolbar__row-container">
                <Tooltip>
                    <TooltipTrigger>
                        <Item tourClass="add-text" onClick={createTextClick}>
                            <CreateTextIcon />
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">
                        Add text
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <Item
                            tourClass="add-mutation-table"
                            onClick={addMutationTableClick}
                        >
                            <AddMutationTableIcon />
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">
                        Add mutation table
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <Item
                            tourClass="add-timeline"
                            onClick={addTimelineClick}
                        >
                            <TimelineIcon />
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">
                        Add timeline
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <Item
                            tourClass="add-fusion-table"
                            onClick={addFusionTableClick}
                        >
                            <FusionIcon />
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">
                        Add structural variants/fusion table
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <Item tourClass="add-cnas" onClick={addCNATableClick}>
                            <CNAIcon />
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">
                        Add copy number alterations table
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <MtbSelector
                            mtbs={mtbs}
                            recommendationSelected={
                                addTherapyRecommendationClick
                            }
                        />
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">
                        Add therapy recommendations
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <Item
                            tourClass="add-clinical-data"
                            onClick={addClinicalDataClick}
                        >
                            <i className="fa fa-user-md"></i>
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">
                        Add clinical data
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger>
                        <Item
                            tourClass="add-rectangle"
                            onClick={addRectangleClick}
                        >
                            <RectangleIcon />
                        </Item>
                    </TooltipTrigger>
                    <TooltipContent className="Tooltip">
                        Add highlighting rectangle
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="toolbar__row-container">
                <div className="toolbar__editor-menu"></div>
                <div className="toolbar__alignment toolbar__menu-item--space">
                    {showAlignmentMenu && (
                        <AlignmentMenu
                            positionChanged={(left, top) =>
                                selectedNodePositionChange(
                                    selectedNode.slideId,
                                    selectedNode.nodeId,
                                    left,
                                    top
                                )
                            }
                            selectedNode={selectedNode}
                        ></AlignmentMenu>
                    )}
                </div>
                <Tooltip>
                    <TooltipTrigger className="toolbar__menu-item--hug-right">
                        <Item
                            tourClass="help"
                            className="toolbar__menu-item--hug-right"
                        >
                            ?
                        </Item>
                        <TooltipContent className="Tooltip">
                            Adding images is currently available via copy (
                            <kbd>Ctrl</kbd>+<kbd>c</kbd>) and paste (
                            <kbd>Ctrl</kbd>+<kbd>v</kbd>).
                            <br />
                            To limit the direction to one axis when moving an
                            element, hold <kbd>Shift</kbd>.
                        </TooltipContent>
                    </TooltipTrigger>
                </Tooltip>
            </div>
        </div>
    );
};
