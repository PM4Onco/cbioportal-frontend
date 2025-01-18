import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    ClinicalData,
    DiscreteCopyNumberData,
    Mutation,
} from 'cbioportal-ts-api-client';
import 'react-toastify/dist/ReactToastify.css';
import './style.scss';
import Reveal from 'reveal.js';
import Overview from './reveal/overview';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import {
    Slides,
    TimeState,
    useHistoryState,
} from 'shared/lib/hooks/use-history-state';
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
import { PatientViewPageStore } from 'pages/patientView/clinicalInformation/PatientViewPageStore';
import { Item } from 'pages/patientView/presentation/toolbar/Item';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip';
import { restrictToAxis } from 'pages/patientView/presentation/restrictToAxis';
import { AddMutationTableIcon } from './icons/AddMutationTableIcon';
import { toast } from 'react-toastify';
import { TimelineIcon } from './icons/TimelineIcon';
import { fhirsparkURL } from 'shared/api/FhirsparkAPI';
import { minioURL } from 'shared/api/MinIOAPI';
import { UUID } from 'pages/patientView/presentation/model/uuid';
import Joyride, { CallBackProps, STATUS, StoreHelpers } from 'react-joyride';
import { AlignmentMenu } from 'pages/patientView/presentation/toolbar/AlignmentMenu';
import { IMtb, ITherapyRecommendation } from 'cbioportal-utils';
import { steps } from 'pages/patientView/presentation/tour/steps';
import { MtbSelector } from 'pages/patientView/presentation/toolbar/MtbSelector';
import { RectangleIcon } from 'pages/patientView/presentation/icons/RectangleIcon';

export interface PresentationClinicalData {
    name: string;
    age: string;
    gender: string;
    grade: string;
    diseaseStatus: string;
    race: string;
    osMonths: string;
    osStatus: string;
    sampleCount: string;
    anamnese: string;
}

interface PresentationProps {
    clinicalData: ClinicalData[];
    mutations: Mutation[];
    mtbs: IMtb[];
    cna: DiscreteCopyNumberData[];
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
    width: number;
}

type NodeTypes = Node<string> | Node<null>;
export type SelectedNode = { slideId: number; nodeId: string };

export const Presentation: React.FunctionComponent<PresentationProps> = observer(
    ({
        clinicalData,
        mutations,
        mtbs,
        cna,
        patientViewPageStore,
        width,
        dataStore,
        sampleManager,
        ...mutationTableProps
    }: PresentationProps) => {
        const deckDivRef = useRef<HTMLDivElement>(null); // reference to deck container div
        const deckRef = useRef<Reveal.Api | null>(null); // reference to deck reveal instance

        const pointerSensor = useSensor(PointerSensor);
        const sensors = useSensors(pointerSensor);

        const [currentSlideId, setCurrentSlideId] = useState(1);
        const [shiftDown, setShiftDown] = useState(false);

        const [deletedSlides, setDeletedSlides] = useState<
            Record<UUID, TimeState<NodeTypes[]>>
        >({});

        const [tourRun, setTourRun] = useState<boolean>(shouldShowTour());
        const tourHelpers = useRef<StoreHelpers>();

        const setTourHelpers = (storeHelpers: StoreHelpers) => {
            tourHelpers.current = storeHelpers;
        };

        const {
            state,
            set,
            setHistory,
            insert,
            insertHistory,
            remove,
            undo,
            redo,
            clear,
            canRedo,
            canUndo,
        } = useHistoryState<NodeTypes[]>({
            slideId: currentSlideId,
            initialPresent: [],
        });

        const [selectedNodes, setSelectedNodes] = useState<SelectedNode[]>([]);

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
            console.log(mtbs);
        }, [mtbs]);

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
            deckRef.current?.dispatchEvent({
                type: 'overview:update',
                bubbles: false,
                data: undefined,
                target: undefined,
            });
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
                overview: false,
            });

            deckRef.current.initialize({ plugins: [Overview] }).then(reveal => {
                deckRef.current?.on('slidechanged', (e: any) =>
                    setCurrentSlideId(Number(e.currentSlide.id))
                );
            });

            loadPresentation()
                .then((slides: Slides) => {
                    clear(slides);
                    const slideIds = Object.keys(slides).map(id => Number(id));
                    setCurrentSlideId(slideIds[0]);
                    deckRef.current?.slide(0);
                })
                .catch(() => createTitle())
                .finally(() => {
                    const updateEvent = {
                        type: 'overview:update',
                        bubbles: false,
                        data: undefined,
                        target: undefined,
                    };
                    deckRef.current?.dispatchEvent(updateEvent);
                    updateOverviewAfterTimeout();
                });

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

        useEffect(() => {
            const controller = new AbortController();

            deckRef.current?.on(
                'overview:action:move-up',
                (
                    event: Event & {
                        slideId: number;
                    }
                ) => moveSlideUp(event.slideId),
                {
                    signal: controller.signal,
                }
            );

            deckRef.current?.on(
                'overview:action:move-down',
                (event: Event & { slideId: number }) =>
                    moveSlideDown(event.slideId),
                {
                    signal: controller.signal,
                }
            );

            deckRef.current?.on(
                'overview:menu:open',
                () => {
                    const stepIndex = tourHelpers.current?.info().index;
                    if (stepIndex === 4 || stepIndex === 7) {
                        tourHelpers.current?.next();
                    }
                },
                {
                    signal: controller.signal,
                }
            );

            deckRef.current?.on(
                'overview:action:delete',
                (
                    event: Event & {
                        slideId: number;
                        uuid: UUID;
                    }
                ) => removeSlide(event.slideId, event.uuid),
                {
                    signal: controller.signal,
                }
            );

            deckRef.current?.on(
                'overview:action:restore',
                (
                    event: Event & {
                        uuid: UUID;
                    }
                ) => restoreSlide(event.uuid),
                {
                    signal: controller.signal,
                }
            );

            deckRef.current?.on(
                'overview:deleted-slides:open',
                (event: Event) => tourHelpers.current?.next(),
                {
                    signal: controller.signal,
                }
            );
            return () => {
                controller.abort();
            };
        }, [state, deletedSlides]);

        function shouldShowTour() {
            return (
                !localStorage.getItem('mtb-presentation-tour-complete') ||
                localStorage.getItem('mtb-presentation-tour-complete') ===
                    'false'
            );
        }

        function updateOverviewAfterTimeout(timeout = 2000) {
            const updateEvent = {
                type: 'overview:update',
                bubbles: false,
                data: undefined,
                target: undefined,
            };
            // update after some time when timeline and mutation tables are loaded.
            // it would be better to have some kind of loaded event form these components.
            setTimeout(
                () => deckRef.current?.dispatchEvent(updateEvent),
                timeout
            );
        }

        async function loadPresentation() {
            const patientId = patientViewPageStore.getSafePatientId();

            const response = await fetch(
                `${fhirsparkURL()}/presentation/${patientId}`
            );
            if (response.status === 200) {
                const presentation = await response.json();
                return presentation.slides;
            } else {
                throw Error('not found');
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
            const patientId = patientViewPageStore.getSafePatientId();
            const data = await blobToBase64(blob);
            const response = await fetch(
                `${fhirsparkURL()}/presentation/${patientId}/image`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        contentType: blob.type,
                        data,
                    }),
                }
            );

            const responseData = await response.json();

            createImage(`${minioURL()}${responseData.location}`);
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
                        await copyAsText(presentOfSelectedNode.value as string);
                        break;
                    case 'image':
                        await copyAsImage(
                            presentOfSelectedNode.value as string
                        );
                        break;
                    case 'html':
                        await copyAsHTML(presentOfSelectedNode.value as string);
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
            const slideId =
                (Number(deckRef.current?.getCurrentSlide().id) ?? 0) + 1;

            insert(slideId, []);
            setActiveSlide(slideId - 1);

            if (tourRun) {
                tourHelpers.current?.next();
            }
        }

        function removeSlide(slideId: number, uuid: UUID) {
            const historyState = state.get(slideId);
            console.log(deletedSlides);
            if (!historyState) return;

            setDeletedSlides({
                ...deletedSlides,
                [uuid]: historyState,
            });
            remove(slideId);
            deckRef.current?.prev();
            if (tourRun) {
                tourHelpers.current?.next();
            }
        }

        function restoreSlide(uuid: UUID) {
            const deletedSlide = deletedSlides[uuid];
            if (!deletedSlide) return;

            const slideId =
                (Number(deckRef.current?.getCurrentSlide().id) ?? 0) + 1;

            insertHistory(slideId, deletedSlide);
            setDeletedSlides(
                Object.fromEntries(
                    Object.entries(deletedSlides).filter(
                        ([oUUID, _]) => oUUID !== uuid
                    )
                )
            );

            if (tourRun) {
                tourHelpers.current?.next();
            }
        }

        function moveSlideUp(slideId: number) {
            const slide = state.get(slideId);
            const previousSlide = state.get(slideId - 1);

            if (!slide || !previousSlide) return;

            setHistory(slideId - 1, slide);
            setHistory(slideId, previousSlide);
            setActiveSlide(slideId - 2);
            updateOverviewAfterTimeout(0);
        }

        function moveSlideDown(slideId: number) {
            const slide = state.get(slideId);
            const nextSlide = state.get(slideId + 1);

            if (!slide || !nextSlide) return;

            setHistory(slideId + 1, slide);
            setHistory(slideId, nextSlide);
            setActiveSlide(slideId);
            updateOverviewAfterTimeout(0);
            if (tourRun) {
                tourHelpers.current?.next();
            }
        }

        function setActiveSlide(slideNumber: number) {
            setTimeout(() => {
                deckRef.current?.slide(slideNumber);
            });
        }

        function createTitle() {
            const id = crypto.randomUUID();
            const value = `<p style="text-align: center;"><span style="font-size: 42px; font-weight: bold;">${findClinicalAttributeOrEmptyString(
                'PATIENT_DISPLAY_NAME'
            )}</span></p><p style="text-align: center;"><span style="font-size: 42px">${findClinicalAttributeOrEmptyString(
                'AGE'
            )} years old</span></p>`;

            const component = Dynamic('text', {
                selectedChanged: () => {},
                stateChanged: value => {},
                initialValue: value,
                draggableChanged: draggable => {},
            });
            const container = document.createElement('div');
            container.classList.add('reveal', 'temp');
            container.style.display = 'inline-flex';
            container.style.visibility = 'hidden';
            document.body.appendChild(container);
            ReactDOM.render(component, container);

            setTimeout(() => {
                const rendered = document.querySelector(
                    '.temp.reveal .presentation__node--text'
                );
                const { width, height } = rendered?.getBoundingClientRect() ?? {
                    width: 0,
                    height: 0,
                };

                const left = 960 / 2 - width / 2;
                const top = 700 / 2 - height / 2;

                document.body.removeChild(container);

                const node: Node<string> = {
                    id,
                    position: { left, top },
                    type: 'text',
                    value: value,
                };

                const present = state.get(getCurrentSlideId())?.present ?? [];
                set(getCurrentSlideId(), [...present, node]);
            });
        }

        function createText(value?: string) {
            const id = crypto.randomUUID();

            const node: Node<string> = {
                id,
                position: { left: 20, top: 20 },
                type: 'text',
                value: value ?? 'Neuer Textbaustein',
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
            if (tourRun) {
                tourHelpers.current?.next();
            }
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
                position: { left: 20, top: 20, scale: 1 },
                type: 'mutationTable',
                value: null,
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
        }

        function addTimeline() {
            const id = crypto.randomUUID();

            const node: Node<null> = {
                id,
                position: { left: 20, top: 20, scale: 1 },
                type: 'timeline',
                value: null,
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
        }

        function addTherapyRecommendations(
            recommendation: ITherapyRecommendation
        ) {
            const id = crypto.randomUUID();

            const node: Node<string> = {
                id,
                position: { left: 20, top: 20 },
                type: 'therapyRecommendations',
                value: recommendation.id,
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
        }

        function addClinicalData() {
            const clinicalData = mapClinicalData();
            createText(`
                <table>
                    <tr><th>Name</th><td>${clinicalData.name}</td></tr>
                    <tr><th>Age</th><td>${clinicalData.age}</td></tr>
                    <tr><th>Gender</th><td>${clinicalData.gender}</td></tr>
                    <tr><th>Race Category</th><td>${clinicalData.race}</td></tr>
                    <tr><th>Disease Status</th><td>${clinicalData.diseaseStatus}</td></tr>
                    <tr><th>Patient Tumor Grade</th><td>${clinicalData.grade}</td></tr>
                    <tr><th>Overall Survival (Months)</th><td>${clinicalData.osMonths}</td></tr>
                    <tr><th>Overall Survival Status</th><td>${clinicalData.osStatus}</td></tr>
                    <tr><th>Sample count</th><td>${clinicalData.sampleCount}</td></tr>
                    <tr><th>Anamnese</th><td>${clinicalData.anamnese}</td></tr>
                </table>
            `);
        }

        function addRectangle() {
            const id = crypto.randomUUID();

            const node: Node<null> = {
                id,
                position: { left: 20, top: 20, width: 100, height: 20 },
                type: 'rectangle',
                value: null,
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
        }

        function createHTML(html: string) {
            const id = crypto.randomUUID();

            const node: Node<string> = {
                id,
                position: { left: 20, top: 20 },
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
            const diseaseStatus = findClinicalAttributeOrEmptyString(
                'DISEASE_STATUS'
            );
            const gender = findClinicalAttributeOrEmptyString('SEX');
            const race = findClinicalAttributeOrEmptyString('RACE');
            const osMonths = findClinicalAttributeOrEmptyString('OS_MONTHS');
            const osStatus = findClinicalAttributeOrEmptyString('OS_STATUS');
            const grade = findClinicalAttributeOrEmptyString('PATIENT_GRADE');
            const sampleCount = findClinicalAttributeOrEmptyString(
                'SAMPLE_COUNT'
            );
            const anamnese = findClinicalAttributeOrEmptyString(
                'PATIENT_ANAMNESE'
            );

            return {
                name,
                age,
                race,
                grade,
                diseaseStatus,
                gender,
                osMonths,
                osStatus,
                sampleCount,
                anamnese,
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

            setPresentForSlideId(slideId, nextPresent);
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
                setPresentForSlideId(slideId, nextPresent);
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

        function onDimensionsChanged(
            slideId: number,
            id: string,
            width: number,
            height?: number
        ) {
            const present = state.get(slideId)?.present;

            if (!present) return;

            const copiedPresent = deepCopy(present);

            let modified = false;

            const nextPresent = copiedPresent.map(node => {
                if (
                    node.id === id &&
                    (node.position.width !== width ||
                        node.position.height !== height)
                ) {
                    node.position.width = width;
                    node.position.height = height;
                    modified = true;
                    return node;
                } else {
                    return node;
                }
            });

            if (modified) {
                setPresentForSlideId(slideId, nextPresent);
            }
        }

        function onScaleChanged(slideId: number, id: string, scale: number) {
            const present = state.get(slideId)?.present;

            if (!present) return;

            const copiedPresent = deepCopy(present);

            let modified = false;

            const nextPresent = copiedPresent.map(node => {
                if (node.id === id && node.position.scale !== scale) {
                    node.position.scale = scale;
                    modified = true;
                    return node;
                } else {
                    return node;
                }
            });

            if (modified) {
                setPresentForSlideId(slideId, nextPresent);
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
                setPresentForSlideId(slideId, nextPresent);
            }
        }

        function setPresentForSlideId(slideId: number, present: NodeTypes[]) {
            set(slideId, present);
        }

        async function savePresentation() {
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
                `${fhirsparkURL()}/presentation/${patientId}`,
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

        async function deletePresentation() {
            const confirmed = confirm(
                'Do you really want to delete the presentation?\nThis cannot be undone.'
            );
            if (!confirmed) return;

            const patientId = patientViewPageStore.getSafePatientId();

            const response = await fetch(
                `${fhirsparkURL()}/presentation/${patientId}`,
                {
                    method: 'DELETE',
                }
            );

            if (response.status === 204) {
                location.reload();
            }
        }

        function handleJoyrideCallback(callback: CallBackProps) {
            const { type, status, action, step } = callback;
            // @ts-ignore
            if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
                setTourRun(false);
                localStorage.setItem('mtb-presentation-tour-complete', 'true');
            }
        }

        return (
            <>
                <Joyride
                    steps={steps}
                    continuous
                    run={tourRun}
                    disableOverlayClose={true}
                    callback={handleJoyrideCallback}
                    getHelpers={setTourHelpers}
                    showSkipButton={true}
                    styles={{
                        options: {
                            primaryColor: '#3786c2',
                            zIndex: 300,
                        },
                    }}
                    locale={{
                        last: 'Finish tour',
                        skip: 'Skip tour',
                    }}
                />
                <div className="overview-presentation-container">
                    <div className="overview-deleted-container">
                        <div className="reveal-overview"></div>
                        <div className="overview-deleted-items">
                            <div
                                className="deleted-items__button"
                                hidden={Object.keys(deletedSlides).length < 1}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                                    />
                                </svg>
                                Deleted Slides (
                                {Object.keys(deletedSlides).length})
                            </div>
                            <div
                                className="deleted-items__item-container"
                                hidden
                            ></div>
                        </div>
                    </div>
                    <div className="presentation-container">
                        <div className="toolbar">
                            <div className="toolbar__row-container">
                                <Item
                                    onClick={onAddSlideClick}
                                    tourClass="add-slide"
                                >
                                    Add Slide
                                </Item>
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
                                            disabled={
                                                !canUndo(getCurrentSlideId())
                                            }
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
                                            disabled={
                                                !canRedo(getCurrentSlideId())
                                            }
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
                                            <Item
                                                tourClass="add-text"
                                                onClick={() => createText()}
                                            >
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
                                                tourClass="add-mutation-table"
                                                onClick={() =>
                                                    addMutationTable()
                                                }
                                            >
                                                <AddMutationTableIcon></AddMutationTableIcon>
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
                                                onClick={() => addTimeline()}
                                            >
                                                <TimelineIcon></TimelineIcon>
                                            </Item>
                                        </TooltipTrigger>
                                        <TooltipContent className="Tooltip">
                                            Add timeline
                                        </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <MtbSelector
                                                mtbs={mtbs}
                                                recommendationSelected={
                                                    addTherapyRecommendations
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
                                                onClick={() =>
                                                    addClinicalData()
                                                }
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
                                                onClick={() => addRectangle()}
                                            >
                                                <RectangleIcon></RectangleIcon>
                                            </Item>
                                        </TooltipTrigger>
                                        <TooltipContent className="Tooltip">
                                            Add highlighting rectangle
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <div className="toolbar__alignment toolbar__menu-item--space">
                                    {selectedNodes.length > 0 && (
                                        <AlignmentMenu
                                            positionChanged={(left, top) =>
                                                onPositionChanged(
                                                    selectedNodes[0].slideId,
                                                    selectedNodes[0].nodeId,
                                                    left,
                                                    top
                                                )
                                            }
                                            selectedNode={selectedNodes[0]}
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
                                            Adding images is currently available
                                            via copy (<kbd>Ctrl</kbd>+
                                            <kbd>c</kbd>) and paste (
                                            <kbd>Ctrl</kbd>+<kbd>v</kbd>).
                                            <br />
                                            To limit the direction to one axis
                                            when moving an element, hold{' '}
                                            <kbd>Shift</kbd>.
                                        </TooltipContent>
                                    </TooltipTrigger>
                                </Tooltip>
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
                                                        restrictToAxis(
                                                            shiftDown
                                                        ),
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
                                                                        id:
                                                                            node.id,
                                                                        top:
                                                                            node
                                                                                .position
                                                                                .top,
                                                                        left:
                                                                            node
                                                                                .position
                                                                                .left,
                                                                        width:
                                                                            node
                                                                                .position
                                                                                .width,
                                                                        height:
                                                                            node
                                                                                .position
                                                                                .height,
                                                                        scale:
                                                                            node
                                                                                .position
                                                                                .scale,
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
                                                                        dimensionsChanged: (
                                                                            width: number,
                                                                            height?: number
                                                                        ) =>
                                                                            onDimensionsChanged(
                                                                                slideId,
                                                                                node.id,
                                                                                width,
                                                                                height
                                                                            ),
                                                                        scaleChanged: (
                                                                            scale: number
                                                                        ) =>
                                                                            onScaleChanged(
                                                                                slideId,
                                                                                node.id,
                                                                                scale
                                                                            ),
                                                                        component: {
                                                                            type:
                                                                                node.type,
                                                                            props: {
                                                                                ...(node.type ===
                                                                                    'mutationTable' && {
                                                                                    patientViewPageStore,
                                                                                    dataStore,
                                                                                    sampleManager,
                                                                                    ...mutationTableProps,
                                                                                    columnVisibility: {
                                                                                        Exon: true,
                                                                                        'Allele Freq': true,
                                                                                        HGVSc: true,
                                                                                        HGVSg: true,
                                                                                        ClinVar: true,
                                                                                        MS: false,
                                                                                        COSMIC: false,
                                                                                        gnomAD: false,
                                                                                        dbSNP: false,
                                                                                    },
                                                                                }),
                                                                                ...(node.type ===
                                                                                    'timeline' && {
                                                                                    patientViewPageStore,
                                                                                    dataStore,
                                                                                    width,
                                                                                    sampleManager,
                                                                                }),
                                                                                ...(node.type ===
                                                                                    'therapyRecommendations' && {
                                                                                    mtbs,
                                                                                    sampleManager,
                                                                                    mutations,
                                                                                    cna,
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
            </>
        );
    }
);
