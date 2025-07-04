import React, { useState } from 'react';

import PatientViewMutationsTab from 'pages/patientView/mutation/PatientViewMutationsTab'; // Show-Hide button from here
import TimelineWrapper from 'pages/patientView/timeline/TimelineWrapper'; // CNA Timeline from here

import { PatientViewPageStore } from 'pages/patientView/clinicalInformation/PatientViewPageStore';
import PatientViewMutationsDataStore from 'pages/patientView/mutation/PatientViewMutationsDataStore';
import WindowStore from 'shared/components/window/WindowStore';

// Define props of timeline
interface PatientTimelineProps {
    patientViewPageStore: PatientViewPageStore;
    sampleManager: any;
    dataStore: PatientViewMutationsDataStore;
}

const Timeline = ({
    patientViewPageStore,
    sampleManager,
    dataStore,
}: PatientTimelineProps) => {
    // Use useState to manage the visibility state
    const [showTimeline, setShowTimeline] = useState(false); // Initialize as false (initially hidden)
    // Define the toggle function
    const toggleTimeline = () => {
        setShowTimeline(prevShowTimeline => !prevShowTimeline); // Toggle the state
    };

    // Check if necessary data is available before rendering the timeline section
    const canShowTimelineSection =
        !!sampleManager &&
        patientViewPageStore.clinicalEvents.isComplete &&
        patientViewPageStore.clinicalEvents.result.length > 0;

    return (
        <div>
            {canShowTimelineSection && (
                <div>
                    <div
                        style={{
                            marginTop: 20,
                            marginBottom: 20,
                        }}
                    >
                        <button
                            className="btn btn-xs btn-default displayBlock"
                            onClick={toggleTimeline}
                            data-test="ToggleTimeline"
                        >
                            {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
                        </button>
                        {showTimeline && (
                            <TimelineWrapper
                                dataStore={dataStore}
                                caseMetaData={{
                                    color: sampleManager.sampleColors,
                                    label: sampleManager.sampleLabels,
                                    index: sampleManager.sampleIndex,
                                }}
                                data={
                                    patientViewPageStore.clinicalEvents.result
                                }
                                sampleManager={sampleManager}
                                width={WindowStore.size.width}
                                samples={patientViewPageStore.samples.result}
                                mutationProfileId={
                                    patientViewPageStore
                                        .mutationMolecularProfileId.result!
                                }
                            />
                        )}
                    </div>
                    <hr />
                </div>
            )}
        </div>
    );
};

export default Timeline;
