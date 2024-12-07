import React, { RefObject } from 'react';
import { Item } from 'pages/patientView/presentation/toolbar/Item';
import { VerticalCenterIcon } from 'pages/patientView/presentation/icons/VerticalCenterIcon';
import { HorizontalCenterIcon } from '../icons/HorizontalCenterIcon';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from 'pages/patientView/presentation/Tooltip';
import { SelectedNode } from 'pages/patientView/presentation/Presentation';

interface Props {
    selectedNode: SelectedNode;
    positionChanged: PositionChangedFn;
}
type PositionChangedFn = (left?: number, top?: number) => void;

export const AlignmentMenu = ({ selectedNode, positionChanged }: Props) => {
    function centerHorizontally() {
        const node = document.querySelector(
            `#${CSS.escape(selectedNode.slideId.toString())} > #${
                selectedNode.nodeId
            }`
        );
        if (!node) return;
        const presentationWidth = 960;
        const presentationCenter = presentationWidth / 2;
        const selectedWidth = node.getBoundingClientRect().width ?? 0;

        const x = presentationCenter - selectedWidth / 2;

        positionChanged(x);
    }

    function centerVertically() {
        const node = document.querySelector(
            `#${CSS.escape(selectedNode.slideId.toString())} > #${
                selectedNode.nodeId
            }`
        );
        if (!node) return;
        const presentationHeight = 700;
        const presentationCenter = presentationHeight / 2;
        const selectedWidth = node.getBoundingClientRect().height ?? 0;

        const y = presentationCenter - selectedWidth / 2;

        positionChanged(undefined, y);
    }

    return (
        <div className="toolbar__item-container">
            <Tooltip>
                <TooltipTrigger>
                    <Item onClick={() => centerVertically()}>
                        <VerticalCenterIcon></VerticalCenterIcon>
                    </Item>
                </TooltipTrigger>
                <TooltipContent className="Tooltip">
                    Center vertically
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger>
                    <Item onClick={() => centerHorizontally()}>
                        <HorizontalCenterIcon></HorizontalCenterIcon>
                    </Item>
                </TooltipTrigger>
                <TooltipContent className="Tooltip">
                    Center horizontally
                </TooltipContent>
            </Tooltip>
        </div>
    );
};
