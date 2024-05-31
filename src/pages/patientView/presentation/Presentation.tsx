import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ClinicalData } from 'cbioportal-ts-api-client';

import './style.scss';
import TextNode from './TextNode';
import { MutationTable } from 'pages/patientView/presentation/MutationTable';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';

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

export const Presentation: React.FunctionComponent<PresentationProps> = observer(
    ({
         clinicalData,
         patientViewPageStore,
         dataStore,
         sampleManager,
         sampleIds,
         mergeOncoKbIcons,
         onOncoKbIconToggle,
         columnVisibility,
         onFilterGenes,
         columnVisibilityProps,
         onSelectGenePanel,
         disableTooltip,
         onRowClick,
         onRowMouseEnter,
         onRowMouseLeave,
         namespaceColumns,
         columns,
         pageMode,
         alleleFreqHeaderRender,
     }: PresentationProps) => {
        const [components, setComponents] = useState<any[]>([]);
        const ref = useRef<any>(null);

        const deckDivRef = useRef<HTMLDivElement>(null); // reference to deck container div
        const deckRef = useRef<Reveal.Api | null>(null); // reference to deck reveal instance

        useEffect(() => {
            // Prevents double initialization in strict mode
            if (deckRef.current) return;

            deckRef.current = new Reveal(deckDivRef.current!, {
                transition: 'slide',
                controls: false,
                progress: false,
                embedded: true,
                disableLayout: true
            });

            deckRef.current.initialize().then(() => {
                // good place for event handlers and plugin setups
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
                    '.presentation',
                );

                fullscreenElement!.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }

        function findClinicalAttributeOrEmptyString(
            attributeId: string,
        ): string {
            const attribute = clinicalData.find(
                cd => cd.clinicalAttributeId === attributeId,
            );
            return attribute ? attribute.value : '';
        }

        function createText() {
            const comp = React.createElement(TextNode, { ref: ref });

            setComponents(components.concat(comp));

            setTimeout(() => {
                ref.current?.focus();
            });
        }

        function addMutationTable() {
            const comp = React.createElement(MutationTable, {
                patientViewPageStore,
                dataStore,
                sampleManager,
                sampleIds,
                mergeOncoKbIcons,
                onOncoKbIconToggle,
                columnVisibility,
                onFilterGenes,
                columnVisibilityProps,
                onSelectGenePanel,
                disableTooltip,
                onRowClick,
                onRowMouseEnter,
                onRowMouseLeave,
                namespaceColumns,
                columns,
                pageMode,
                alleleFreqHeaderRender,
            });

            setComponents(components.concat(comp));
        }

        function mapClinicalData(): PresentationClinicalData {
            const name = findClinicalAttributeOrEmptyString(
                'PATIENT_DISPLAY_NAME',
            );
            const age = findClinicalAttributeOrEmptyString('AGE');
            const dfsStatus = findClinicalAttributeOrEmptyString('DFS_STATUS');
            const ecogStatus = findClinicalAttributeOrEmptyString(
                'ECOG _STATUS',
            );
            const gender = findClinicalAttributeOrEmptyString('GENDER');
            const karnofskyPerformanceScore = findClinicalAttributeOrEmptyString(
                'KARNOFSKY_PERFORMANCE_SCORE',
            );
            const kasId = findClinicalAttributeOrEmptyString('KAS_ID');
            const osMonths = findClinicalAttributeOrEmptyString('OS_MONTHS');
            const osStatus = findClinicalAttributeOrEmptyString('OS_STATUS');
            const sampleCount = findClinicalAttributeOrEmptyString(
                'SAMPLE_COUNT',
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

        return (
            <div>
                <div className="toolbar">
                    <div onClick={createText}>
                        <svg
                            width="26"
                            height="15"
                            viewBox="0 0 26 15"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <rect
                                x="1"
                                y="1"
                                width="24"
                                height="13"
                                rx="2"
                                stroke="black"
                                stroke-width="2"
                            />
                            <path
                                d="M6.01 8.05H8.43L7.24 4.72H7.22L6.01 8.05ZM6.72 3.86H7.77L10.56 11H9.51L8.73 8.85H5.71L4.91 11H3.94L6.72 3.86ZM12.2144 6.93H14.1144C14.6544 6.93 15.041 6.83667 15.2744 6.65C15.5144 6.45667 15.6344 6.17 15.6344 5.79C15.6344 5.53667 15.5944 5.33667 15.5144 5.19C15.4344 5.04333 15.3244 4.93 15.1844 4.85C15.0444 4.77 14.881 4.72 14.6944 4.7C14.5144 4.67333 14.321 4.66 14.1144 4.66H12.2144V6.93ZM11.2644 3.86H13.8544C14.0077 3.86 14.171 3.86333 14.3444 3.87C14.5244 3.87 14.701 3.88 14.8744 3.9C15.0477 3.91333 15.2077 3.93667 15.3544 3.97C15.5077 4.00333 15.6377 4.05333 15.7444 4.12C15.9777 4.26 16.1744 4.45333 16.3344 4.7C16.501 4.94667 16.5844 5.25 16.5844 5.61C16.5844 5.99 16.491 6.32 16.3044 6.6C16.1244 6.87333 15.8644 7.07667 15.5244 7.21V7.23C15.9644 7.32333 16.301 7.52333 16.5344 7.83C16.7677 8.13667 16.8844 8.51 16.8844 8.95C16.8844 9.21 16.8377 9.46333 16.7444 9.71C16.651 9.95667 16.511 10.1767 16.3244 10.37C16.1444 10.5567 15.9177 10.71 15.6444 10.83C15.3777 10.9433 15.0677 11 14.7144 11H11.2644V3.86ZM12.2144 10.2H14.5944C15.0144 10.2 15.341 10.0867 15.5744 9.86C15.8144 9.63333 15.9344 9.32 15.9344 8.92C15.9344 8.68667 15.891 8.49333 15.8044 8.34C15.7177 8.18667 15.601 8.06667 15.4544 7.98C15.3144 7.88667 15.151 7.82333 14.9644 7.79C14.7777 7.75 14.5844 7.73 14.3844 7.73H12.2144V10.2Z"
                                fill="black"
                            />
                        </svg>
                    </div>
                    <div onClick={addMutationTable}>
                        <svg
                            width="26"
                            height="26"
                            viewBox="0 0 26 26"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M8.66001 8.932H10.22L12.92 16.132L15.632 8.932H17.192V17.5H16.112V10.372H16.088L13.412 17.5H12.44L9.76401 10.372H9.74001V17.5H8.66001V8.932Z"
                                fill="black"
                            />
                            <circle
                                cx="13"
                                cy="13"
                                r="12"
                                stroke="black"
                                stroke-width="2"
                            />
                        </svg>
                    </div>
                    <div onClick={toggleFullscreen}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            className="presentation__toolbar-item"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                            />
                        </svg>
                    </div>
                </div>
                <div className="presentation">
                    <div className="reveal" ref={deckDivRef}>
                        <div className="slides">
                            <section>
                                {React.Children.toArray(components)}
                            </section>
                            <section>Slide 2</section>
                        </div>
                    </div>
                    {/*<PatientData data={mapClinicalData()}></PatientData>*/}
                </div>
            </div>
        );
    },
);
