import React, { createRef, Ref, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ClinicalData } from 'cbioportal-ts-api-client';

import './style.scss';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import { useHistoryState } from 'shared/lib/hooks/use-history-state';
import { CreateTextIcon } from './icons/CreateTextIcon';
import { AddMutationTableIcon } from 'pages/patientView/presentation/icons/AddMutationTableIcon';
import { ToggleFullscreenIcon } from 'pages/patientView/presentation/icons/ToggleFullscreenIcon';
import { UndoIcon } from 'pages/patientView/presentation/icons/UndoIcon';
import { RedoIcon } from 'pages/patientView/presentation/icons/RedoIcon';
import { deepCopy } from 'pages/patientView/presentation/utils/utils';
import { Node } from './model/node';
import { Dynamic } from 'pages/patientView/presentation/model/dynamic-component';
import { DndContext, DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { PointerSensor } from 'pages/patientView/presentation/PointerSensor';
import { Draggable } from 'pages/patientView/presentation/Draggable';

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

interface Slide<T> {
    id: string;
    nodes: Node<T>[];
}

export const Presentation: React.FunctionComponent<PresentationProps> = observer(
    ({ clinicalData, ...mutationTableProps }: PresentationProps) => {
        const deckDivRef = useRef<HTMLDivElement>(null); // reference to deck container div
        const deckRef = useRef<Reveal.Api | null>(null); // reference to deck reveal instance

        const pointerSensor = useSensor(PointerSensor);
        const sensors = useSensors(pointerSensor);

        const [refs, setRefs] = React.useState<Record<string, Ref<any>>>({});

        const [idCounter, setIdCounter] = useState(2);
        const [slideIdCounter, setSlideIdCounter] = React.useState(0);
        const [currentSlideId, setCurrentSlideId] = useState('');

        const { state, set, undo, redo, canRedo, canUndo } = useHistoryState<
            (Node<string> | Node<null>)[]
        >({
            slideId: crypto.randomUUID(),
            initialPresent: [
                {
                    id: '1',
                    position: { left: 0, top: 0 },
                    type: 'text',
                    value: 'Hello World',
                    draggable: true,
                },
            ],
        });

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
                setCurrentSlideId(deckRef.current?.getCurrentSlide()?.id ?? '');
                deckRef.current?.on('slidechanged', (e: any) =>
                    setCurrentSlideId(e.currentSlide.id)
                );
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

        function getAndIncrementCounter() {
            const counter = idCounter;
            setIdCounter(counter => counter + 1);
            return `${counter}`;
        }

        function getAndIncrementSlideIdCounter() {
            const currentCount = slideIdCounter;
            setSlideIdCounter(counter => counter + 1);
            return `${currentCount}`;
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
            set(crypto.randomUUID(), []);
        }

        function createText() {
            const id = getAndIncrementCounter();

            const node: Node<string> = {
                id,
                position: { left: 0, top: 0 },
                type: 'text',
                value: 'Hello World',
                draggable: true,
            };

            const present = state.get(getCurrentSlideId())?.present ?? [];
            set(getCurrentSlideId(), [...present, node]);
        }

        function addMutationTable() {
            const id = getAndIncrementCounter();

            const node: Node<null> = {
                id,
                position: { left: 0, top: 0 },
                type: 'mutationTable',
                value: null,
                draggable: true,
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

        function onStateChanged(
            slideId: string,
            id: string,
            value: any,
            draggable: boolean
        ) {
            const present = state.get(slideId)?.present;

            if (!present) return;

            const copiedPresent = deepCopy(present);

            let modified = false;

            const nextPresent = copiedPresent.map(node => {
                if (
                    node.id === id &&
                    (node.value !== value || node.draggable !== draggable)
                ) {
                    node.value = value;
                    node.draggable = draggable;
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

        return (
            <div className="overview-presentation-container">
                {/*<div className="overview">*/}
                {/*    {Array.from({length: deckRef.current?.getTotalSlides() ?? 0}, (v, i) => i).map((number) => {*/}
                {/*        return `Slide ${number + 1}`*/}
                {/*    })}*/}
                {/*</div>*/}
                <div className="presentation-container">
                    <div className="toolbar">
                        <div onClick={createText}>
                            <CreateTextIcon></CreateTextIcon>
                        </div>
                        <div onClick={addMutationTable}>
                            <AddMutationTableIcon></AddMutationTableIcon>
                        </div>
                        <div
                            onClick={onUndoClick}
                            className={
                                canUndo(getCurrentSlideId()) ? '' : 'disabled'
                            }
                        >
                            <UndoIcon></UndoIcon>
                        </div>
                        <div
                            onClick={onRedoClick}
                            className={
                                canRedo(getCurrentSlideId()) ? '' : 'disabled'
                            }
                        >
                            <RedoIcon></RedoIcon>
                        </div>
                        <div onClick={onAddSlideClick}>Add Slide</div>
                        <div
                            className="toolbar__fullscreen"
                            onClick={toggleFullscreen}
                        >
                            <ToggleFullscreenIcon></ToggleFullscreenIcon>
                        </div>
                    </div>
                    <div className="presentation">
                        <div className="reveal" ref={deckDivRef}>
                            <div className="slides">
                                {Array.from(state.entries()).map(
                                    ([slideId, timeState]) => (
                                        <section id={slideId} key={slideId}>
                                            <DndContext
                                                sensors={sensors}
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
                                                                    key:
                                                                        node.id,
                                                                    draggable:
                                                                        node.draggable,
                                                                    children: Dynamic(
                                                                        node.type,
                                                                        {
                                                                            ...(node.type ===
                                                                                'mutationTable' && {
                                                                                ...mutationTableProps,
                                                                            }),
                                                                            innerRef: createRef(),
                                                                            initialValue:
                                                                                node.value,
                                                                            stateChanged: (
                                                                                value,
                                                                                draggable
                                                                            ) =>
                                                                                onStateChanged(
                                                                                    slideId,
                                                                                    node.id,
                                                                                    value,
                                                                                    draggable
                                                                                ),
                                                                        }
                                                                    ),
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
