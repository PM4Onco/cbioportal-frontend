import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ClinicalData } from 'cbioportal-ts-api-client';
import 'react-toastify/dist/ReactToastify.css';
import './style.scss';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import { Slides, useHistoryState } from 'shared/lib/hooks/use-history-state';
import { CreateTextIcon } from './icons/CreateTextIcon';
import { ToggleFullscreenIcon } from 'pages/patientView/presentation/icons/ToggleFullscreenIcon';
import { UndoIcon } from 'pages/patientView/presentation/icons/UndoIcon';
import { RedoIcon } from 'pages/patientView/presentation/icons/RedoIcon';
import { deepCopy } from 'pages/patientView/presentation/utils/utils';
import { Node } from './model/node';
import { DndContext, DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { PointerSensor } from 'pages/patientView/presentation/PointerSensor';
import { Draggable } from 'pages/patientView/presentation/Draggable';
import { useHotkeys } from 'react-hotkeys-hook';
import { Menu, MenuItem } from 'pages/patientView/presentation/ContextMenu';
import { Dynamic } from 'pages/patientView/presentation/model/dynamic-component';
import ReactDOM from 'react-dom';
import { getServerConfig } from 'config/config';
import { PatientViewPageStore } from 'pages/patientView/clinicalInformation/PatientViewPageStore';
import { Item } from 'pages/patientView/presentation/toolbar/Item';
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip';
import { restrictToAxis } from 'pages/patientView/presentation/restrictToAxis';
import { AddMutationTableIcon } from './icons/AddMutationTableIcon';
import { toast } from 'react-toastify';

export interface PresentationClinicalData {
    name: string;
    age: string;
    dfsStatus: string;
    ecogStatus: string;
    gender: string;
    karnofskyPerformanceScore: string;
    kasId: string;
    osMonths: string;
    osStatus: string;
    sampleCount: string;
    cancerType: string;
}

interface PresentationProps {
    clinicalData: ClinicalData[];
    patientViewPageStore: PatientViewPageStore;
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

export const Presentation: React.FunctionComponent<PresentationProps> = observer(
    ({
        clinicalData,
        patientViewPageStore,
        ...mutationTableProps
    }: PresentationProps) => {
        const deckDivRef = useRef<HTMLDivElement>(null); // reference to deck container div
        const deckRef = useRef<Reveal.Api | null>(null); // reference to deck reveal instance

        const pointerSensor = useSensor(PointerSensor);
        const sensors = useSensors(pointerSensor);

        const [currentSlideId, setCurrentSlideId] = useState(1);
        const [shiftDown, setShiftDown] = useState(false);

        const {
            state,
            set,
            undo,
            redo,
            clear,
            canRedo,
            canUndo,
        } = useHistoryState<(Node<string> | Node<null>)[]>({
            slideId: currentSlideId,
            initialPresent: [],
        });

        const [selectedNodes, setSelectedNodes] = useState<
            { slideId: number; nodeId: string }[]
        >([]);

        useHotkeys('ctrl+v,meta+v', () => handlePaste(), [
            state,
            currentSlideId,
        ]);

        useHotkeys('ctrl+c,meta+c', () => handleCopy(), [
            state,
            currentSlideId,
            selectedNodes,
        ]);

        useHotkeys('ctrl+z,meta+z', () => onUndoClick(), [
            undo,
            currentSlideId,
        ]);
        useHotkeys('ctrl+shift+z,meta+shift+z', () => onRedoClick(), [
            redo,
            currentSlideId,
        ]);

        useHotkeys('backspace', () => onBackspacePressed(), [selectedNodes]);

        useEffect(() => {
            const controller = new AbortController();

            document.addEventListener('keydown', () => setShiftDown(true), {
                signal: controller.signal,
            });
            document.addEventListener('keyup', () => setShiftDown(false), {
                signal: controller.signal,
            });

            return () => {
                controller.abort();
            };
        }, [state]);

        useEffect(() => {
            // Prevents double initialization in strict mode
            if (deckRef.current) return;

            deckRef.current = new Reveal(deckDivRef.current!, {
                transition: 'slide',
                controls: false,
                progress: false,
                embedded: true,
                center: false,
            });

            deckRef.current.initialize().then(reveal => {
                deckRef.current?.on('slidechanged', (e: any) =>
                    setCurrentSlideId(Number(e.currentSlide.id))
                );
            });

            // createTitle();
            loadPresentation()
                .then((slides: Slides) => {
                    clear(slides);
                    const slideIds = Object.keys(slides).map(id => Number(id));
                    setCurrentSlideId(slideIds[0]);
                    deckRef.current?.slide(0);
                })
                .catch(() => createTitle());

            return () => {
                try {
                    if (deckRef.current) {
                        deckRef.current.destroy();
                        deckRef.current = null;
                    }
                } catch (e) {
                    console.warn('Reveal.js destroy call failed.');
                }
            };
        }, []);

        async function loadPresentation() {
            const { fhirspark } = getServerConfig();
            if (fhirspark && fhirspark.port) {
                const { port } = fhirspark;
                const patientId = patientViewPageStore.getSafePatientId();

                const response = await fetch(
                    `http://localhost:${port}/presentation/${patientId}`
                );
                if (response.status === 200) {
                    const presentation = await response.json();
                    return presentation.slides;
                } else {
                    throw Error('not found');
                }
            }
        }

        async function handlePaste() {
            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const clipboardItem of clipboardItems) {
                    for (const type of clipboardItem.types) {
                        const asImage = clipboardItem.types.find(type =>
                            type.startsWith('image/')
                        );
                        if (asImage) {
                            const blob = await clipboardItem.getType(asImage);
                            await handlePasteAsImage(blob);
                            return;
                        }

                        const asHTML = clipboardItem.types.find(
                            type => type === 'text/html'
                        );
                        if (asHTML) {
                            const blob = await clipboardItem.getType(asHTML);
                            await handlePasteAsHTML(blob);
                            return;
                        }

                        const asText = clipboardItem.types.find(
                            type => type === 'text/plain'
                        );
                        if (asText) {
                            const blob = await clipboardItem.getType(asText);
                            await handlePasteAsText(blob);
                            return;
                        }
                    }
                }
            } catch (err) {
                console.error(err.name, err.message);
            }
        }

        async function handlePasteAsHTML(blob: Blob) {
            const html = await blob.text();
            createHTML(html);
        }

        async function handlePasteAsImage(blob: Blob) {
            const { fhirspark } = getServerConfig();
            if (fhirspark && fhirspark.port) {
                const { port } = fhirspark;
                const patientId = patientViewPageStore.getSafePatientId();
                const data = await blobToBase64(blob);
                const response = await fetch(
                    `http://localhost:${port}/presentation/${patientId}/image`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            contentType: blob.type,
                            data,
                        }),
                    }
                );

                const responseData = await response.json();

                createImage(responseData.location);
            }
        }

        const blobToBase64 = (blob: Blob): Promise<string> => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            return new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    if (reader.result && typeof reader.result === 'string') {
                        resolve(
                            reader.result.replace(/oata:.+\/.+base64,/, '')
                        );
                    } else {
                        reject();
                    }
                };
            });
        };

        async function handlePasteAsText(blob: Blob) {
            const text = await blob.text();
            createText(text);
        }

        function noNodesSelected() {
            return selectedNodes.length < 1;
        }

        async function handleCopy() {
            if (noNodesSelected()) return;

            const selectedNode = selectedNodes[0];
            const present = state.get(selectedNode.slideId)?.present;
            const presentOfSelectedNode = present?.find(
                node => node.id === selectedNode.nodeId
            );

            if (presentOfSelectedNode) {
                const type = presentOfSelectedNode.type;

                switch (type) {
                    case 'text':
                        await copyAsText(presentOfSelectedNode.value);
                        break;
                    case 'image':
                        await copyAsImage(presentOfSelectedNode.value);
                        break;
                    case 'html':
                        await copyAsHTML(presentOfSelectedNode.value);
                        break;
                }
            }
        }

        async function copyAsText(value: string | null) {
            if (!value) return;

            try {
                await navigator.clipboard.writeText(value);
            } catch (err) {
                console.error(err.name, err.message);
            }
        }

        async function copyAsImage(value: string | null) {
            if (!value) return;

            try {
                const blob = await fetch(value).then(response =>
                    response.blob()
                );
                const clipboardItem = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([clipboardItem]);
            } catch (err) {
                console.error(err.name, err.message);
            }
        }

        async function copyAsHTML(value: string | null) {
            if (!value) return;

            try {
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([value], { type: 'text/html' }),
                });
                await navigator.clipboard.write([clipboardItem]);
            } catch (err) {
                console.error(err.name, err.message);
            }
        }

        function onBackspacePressed() {
            if (noNodesSelected()) return;

            const selectedNode = selectedNodes[0];
            const present = state.get(selectedNode.slideId)?.present;
            if (present) {
                const presentWithoutSelected = present.filter(
                    node => node.id !== selectedNode.nodeId
                );
                set(selectedNode.slideId, presentWithoutSelected);
                onSelectedChanged(
                    selectedNode.slideId,
                    selectedNode.nodeId,
                    false
                );
            }
        }

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                const fullscreenElement = document.querySelector(
                    '.presentation'
                );

                fullscreenElement!.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }

        function findClinicalAttributeOrEmptyString(
            attributeId: string
        ): string {
            const attribute = clinicalData.find(
                cd => cd.clinicalAttributeId === attributeId
            );
            return attribute ? attribute.value : '';
        }

        function getCurrentSlideId() {
            return currentSlideId;
        }

        function onUndoClick() {
            const slideId = getCurrentSlideId();

            if (slideId) {
                undo(slideId);
            }
        }

        function onRedoClick() {
            const slideId = getCurrentSlideId();

            if (slideId) {
                redo(slideId);
            }
        }

        function onAddSlideClick() {
            const slideId = state.size + 1;

            set(slideId, []);
            setTimeout(() => {
                deckRef.current?.slide(slideId + 1);
            });
        }

        function createTitle() {
            const id = crypto.randomUUID();
            const value = `${findClinicalAttributeOrEmptyString(
                'PATIENT_DISPLAY_NAME'
            )}<br>${findClinicalAttributeOrEmptyString('AGE')} years old`;

            const component = Dynamic('text', {
                selectedChanged: () => {},
                stateChanged: value => {},
                initialValue: value,
                draggableChanged: draggable => {},
            });
            const container = document.createElement('div');
            container.classList.add('reveal', 'temp');
            container.style.visibility = 'hidden';
            document.body.appendChild(container);
            ReactDOM.render(component, container);

            setTimeout(() => {
                const rendered = document.querySelector(
                    '.temp.reveal .presentation__text-node'
                );
                const { width, height } = rendered?.getBoundingClientRect() ?? {
                    width: 0,
                    height: 0,
                };
                const left = 960 / 2 - width / 2;
                const top = 700 / 2 - height / 2;

                const node: Node<string> = {
                    id,
                    position: { left, top, width: null },
                    type: 'text',
                    value: `${findClinicalAttributeOrEmptyString(
                        'PATIENT_DISPLAY_NAME'
                    )}<br>${findClinicalAttributeOrEmptyString(
                        'AGE'
                    )} years old`,
                };

                const present = state.get(getCurrentSlideId())?.present ?? [];
                set(getCurrentSlideId(), [...present, node]);
            });
        }

        function createText(value?: string) {
            const id = crypto.randomUUID();

            const node: Node<string> = {
                id,
                position: { left: 20, top: 20, width: null },
                type: 'text',
                value: value ?? 'Neuer Textbaustein',
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
        }

        function createImage(location: string) {
            const id = crypto.randomUUID();

            const node: Node<string> = {
                id,
                position: { left: 20, top: 20, width: 200 },
                type: 'image',
                value: location,
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
        }

        function addMutationTable() {
            const id = crypto.randomUUID();

            const node: Node<null> = {
                id,
                position: { left: 20, top: 20, width: null },
                type: 'mutationTable',
                value: null,
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
        }

        function createHTML(html: string) {
            const id = crypto.randomUUID();

            const node: Node<string> = {
                id,
                position: { left: 20, top: 20, width: null },
                type: 'html',
                value: html,
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
        }

        function mapClinicalData(): PresentationClinicalData {
            const name = findClinicalAttributeOrEmptyString(
                'PATIENT_DISPLAY_NAME'
            );
            const age = findClinicalAttributeOrEmptyString('AGE');
            const dfsStatus = findClinicalAttributeOrEmptyString('DFS_STATUS');
            const ecogStatus = findClinicalAttributeOrEmptyString(
                'ECOG _STATUS'
            );
            const gender = findClinicalAttributeOrEmptyString('GENDER');
            const karnofskyPerformanceScore = findClinicalAttributeOrEmptyString(
                'KARNOFSKY_PERFORMANCE_SCORE'
            );
            const kasId = findClinicalAttributeOrEmptyString('KAS_ID');
            const osMonths = findClinicalAttributeOrEmptyString('OS_MONTHS');
            const osStatus = findClinicalAttributeOrEmptyString('OS_STATUS');
            const sampleCount = findClinicalAttributeOrEmptyString(
                'SAMPLE_COUNT'
            );
            const cancerType = findClinicalAttributeOrEmptyString('TEST');

            return {
                name,
                age,
                dfsStatus,
                ecogStatus,
                gender,
                karnofskyPerformanceScore,
                kasId,
                osMonths,
                osStatus,
                sampleCount,
                cancerType,
            };
        }

        function onDragEnd(event: DragEndEvent) {
            if (
                !event.active.data.current ||
                (Math.abs(event.delta.x) < 1 && Math.abs(event.delta.y) < 1)
            )
                return;

            const slideId = event.active.data.current.slideId;
            const present = state.get(slideId)?.present;

            if (!present) return;

            const copiedPresent = deepCopy(present);

            const nextPresent = copiedPresent.map(node => {
                if (node.id === event.active.id) {
                    node.position.left += event.delta.x;
                    node.position.top += event.delta.y;
                    return node;
                } else {
                    return node;
                }
            });

            set(slideId, nextPresent);
        }

        function onStateChanged(slideId: number, id: string, value: any) {
            const present = state.get(slideId)?.present;

            if (!present) return;

            const copiedPresent = deepCopy(present);

            let modified = false;

            const nextPresent = copiedPresent.map(node => {
                if (node.id === id && node.value !== value) {
                    node.value = value;
                    modified = true;
                    return node;
                } else {
                    return node;
                }
            });

            if (modified) {
                set(slideId, nextPresent);
            }
        }

        function onSelectedChanged(
            slideId: number,
            id: string,
            selected: boolean
        ) {
            if (selected) {
                setSelectedNodes(current => [
                    ...current,
                    { slideId, nodeId: id },
                ]);
            } else {
                setSelectedNodes(current => {
                    return current.filter(
                        ({ slideId: currentSlideId, nodeId: currentNodeId }) =>
                            currentNodeId !== id
                    );
                });
            }
        }

        function onWidthChanged(slideId: number, id: string, width: number) {
            const present = state.get(slideId)?.present;

            if (!present) return;

            const copiedPresent = deepCopy(present);

            let modified = false;

            const nextPresent = copiedPresent.map(node => {
                if (node.id === id && node.position.width !== width) {
                    node.position.width = width;
                    modified = true;
                    return node;
                } else {
                    return node;
                }
            });

            if (modified) {
                set(slideId, nextPresent);
            }
        }

        function onPositionChanged(
            slideId: number,
            id: string,
            left?: number,
            top?: number
        ) {
            const present = state.get(slideId)?.present;

            if (!present) return;

            const copiedPresent = deepCopy(present);

            let modified = false;

            const nextPresent = copiedPresent.map(node => {
                if (node.id === id) {
                    if (left && node.position.left !== left) {
                        node.position.left = left;
                        modified = true;
                        return node;
                    }

                    if (top && node.position.top !== top) {
                        node.position.top = top;
                        modified = true;
                        return node;
                    }

                    return node;
                } else {
                    return node;
                }
            });

            if (modified) {
                set(slideId, nextPresent);
            }
        }

        async function savePresentation() {
            const { fhirspark } = getServerConfig();
            if (fhirspark && fhirspark.port) {
                const { port } = fhirspark;
                const patientId = patientViewPageStore.getSafePatientId();
                let presentation = {};

                for (const slide of state) {
                    const [slideId, history] = slide;
                    presentation = {
                        ...presentation,
                        [slideId]: history.present,
                    };
                }

                const response = await fetch(
                    `http://localhost:${port}/presentation/${patientId}`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            slides: presentation,
                        }),
                    }
                );

                if (response.status === 200) {
                    toast.success('Presentation saved successfully', {
                        delay: 0,
                        position: 'top-right',
                        autoClose: 4000,
                        hideProgressBar: true,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: 'light',
                    });
                }
            }
        }

        async function deletePresentation() {
            const { fhirspark } = getServerConfig();
            if (fhirspark && fhirspark.port) {
                const { port } = fhirspark;
                const patientId = patientViewPageStore.getSafePatientId();

                const response = await fetch(
                    `http://localhost:${port}/presentation/${patientId}`,
                    {
                        method: 'DELETE',
                    }
                );

                if (response.status === 204) {
                    location.reload();
                }
            }
        }

        return (
            <div className="overview-presentation-container">
                {/*<div className="overview">*/}
                {/*    {Array.from({length: deckRef.current?.getTotalSlides() ?? 0}, (v, i) => i).map((number) => {*/}
                {/*        return `Slide ${number + 1}`*/}
                {/*    })}*/}
                {/*</div>*/}
                <div className="presentation-container">
                    <div className="toolbar">
                        <div className="toolbar__row-container">
                            <Item onClick={onAddSlideClick}>Add Slide</Item>
                            <Item onClick={savePresentation}>
                                Save Presentation
                            </Item>
                            <Item onClick={deletePresentation}>
                                Delete Presentation
                            </Item>
                            <Tooltip>
                                <TooltipTrigger className="toolbar__menu-item--hug-right">
                                    <Item
                                        className="toolbar__menu-item--hug-right"
                                        onClick={onUndoClick}
                                        disabled={!canUndo(getCurrentSlideId())}
                                    >
                                        <UndoIcon></UndoIcon>
                                    </Item>
                                </TooltipTrigger>
                                <TooltipContent className="Tooltip">
                                    Undo
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Item
                                        onClick={onRedoClick}
                                        disabled={!canRedo(getCurrentSlideId())}
                                    >
                                        <RedoIcon></RedoIcon>
                                    </Item>
                                </TooltipTrigger>
                                <TooltipContent className="Tooltip">
                                    Redo
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Item onClick={toggleFullscreen}>
                                        <ToggleFullscreenIcon></ToggleFullscreenIcon>
                                    </Item>
                                </TooltipTrigger>
                                <TooltipContent className="Tooltip">
                                    Enable fullscreen
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="toolbar__row-container">
                            <div className="toolbar__editor-menu">
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Item onClick={() => createText()}>
                                            <CreateTextIcon></CreateTextIcon>
                                        </Item>
                                    </TooltipTrigger>
                                    <TooltipContent className="Tooltip">
                                        Add text
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Item
                                            onClick={() => addMutationTable()}
                                        >
                                            <AddMutationTableIcon></AddMutationTableIcon>
                                        </Item>
                                    </TooltipTrigger>
                                    <TooltipContent className="Tooltip">
                                        Add mutation table
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="toolbar__alignment toolbar__menu-item--space"></div>
                        </div>
                    </div>
                    <div className="presentation">
                        <Menu ref={deckDivRef}>
                            <MenuItem label="Paste" onClick={handlePaste} />
                        </Menu>
                        <div className="reveal" ref={deckDivRef}>
                            <div className="slides">
                                {Array.from(state.entries()).map(
                                    ([slideId, timeState]) => (
                                        <section
                                            id={`${slideId}`}
                                            key={slideId}
                                        >
                                            <DndContext
                                                sensors={sensors}
                                                modifiers={[
                                                    restrictToAxis(shiftDown),
                                                ]}
                                                onDragEnd={onDragEnd}
                                            >
                                                {timeState.present &&
                                                    timeState.present.map(
                                                        node =>
                                                            React.createElement(
                                                                Draggable,
                                                                {
                                                                    slideId,
                                                                    id: node.id,
                                                                    top:
                                                                        node
                                                                            .position
                                                                            .top,
                                                                    left:
                                                                        node
                                                                            .position
                                                                            .left,
                                                                    width:
                                                                        node.type ===
                                                                        'image'
                                                                            ? node
                                                                                  .position
                                                                                  .width ||
                                                                              200
                                                                            : null,
                                                                    resizable:
                                                                        node.type ===
                                                                        'image',
                                                                    key:
                                                                        node.id,
                                                                    selectedChanged: (
                                                                        selected: boolean
                                                                    ) =>
                                                                        onSelectedChanged(
                                                                            slideId,
                                                                            node.id,
                                                                            selected
                                                                        ),
                                                                    widthChanged: (
                                                                        width: number
                                                                    ) =>
                                                                        onWidthChanged(
                                                                            slideId,
                                                                            node.id,
                                                                            width
                                                                        ),
                                                                    positionChanged: (
                                                                        left?: number,
                                                                        top?: number
                                                                    ) =>
                                                                        onPositionChanged(
                                                                            slideId,
                                                                            node.id,
                                                                            left,
                                                                            top
                                                                        ),
                                                                    component: {
                                                                        type:
                                                                            node.type,
                                                                        props: {
                                                                            ...(node.type ===
                                                                                'mutationTable' && {
                                                                                marco:
                                                                                    'test',
                                                                                patientViewPageStore,
                                                                                ...mutationTableProps,
                                                                                columnVisibility: {
                                                                                    Exon: true,
                                                                                    'Allele Freq': true,
                                                                                    HGVSc: true,
                                                                                    HGVSg: true,
                                                                                    ClinVar: false,
                                                                                    MS: false,
                                                                                    COSMIC: false,
                                                                                    gnomAD: false,
                                                                                    dbSNP: false,
                                                                                },
                                                                            }),
                                                                            initialValue:
                                                                                node.value,
                                                                            selectedChanged: (
                                                                                selected: boolean
                                                                            ) =>
                                                                                onSelectedChanged(
                                                                                    slideId,
                                                                                    node.id,
                                                                                    selected
                                                                                ),
                                                                            stateChanged: (
                                                                                value: any
                                                                            ) =>
                                                                                onStateChanged(
                                                                                    slideId,
                                                                                    node.id,
                                                                                    value
                                                                                ),
                                                                        },
                                                                    },
                                                                }
                                                            )
                                                    )}
                                            </DndContext>
                                        </section>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);
