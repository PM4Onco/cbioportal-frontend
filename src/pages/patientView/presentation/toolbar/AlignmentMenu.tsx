import React, { RefObject } from 'react';
import { Item } from 'pages/patientView/presentation/toolbar/Item';
import { VerticalCenterIcon } from 'pages/patientView/presentation/icons/VerticalCenterIcon';
import { HorizontalCenterIcon } from '../icons/HorizontalCenterIcon';
import { PositionChangedFn } from 'pages/patientView/presentation/Draggable';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from 'pages/patientView/presentation/Tooltip';

interface Props {
    selected: RefObject<HTMLDivElement>;
    positionChanged: PositionChangedFn;
}

export const AlignmentMenu = ({ selected, positionChanged }: Props) => {
    function centerHorizontally() {
        const presentationWidth = 960;
        const presentationCenter = presentationWidth / 2;
        const selectedWidth =
            selected.current?.getBoundingClientRect().width ?? 0;

        const x = presentationCenter - selectedWidth / 2;

        positionChanged(x);
    }

    function centerVertically() {
        const presentationHeight = 700;
        const presentationCenter = presentationHeight / 2;
        const selectedWidth =
            selected.current?.getBoundingClientRect().height ?? 0;

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
