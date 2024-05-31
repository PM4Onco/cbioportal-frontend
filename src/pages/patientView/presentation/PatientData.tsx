import { observer } from 'mobx-react-lite';
import { PresentationClinicalData } from './Presentation';
import React from 'react';

interface Props {
    data: PresentationClinicalData;
}

export const PatientData: React.FunctionComponent<Props> = observer(
    ({ data }: Props) => {
        return (
            <div>
                <div>Name: {data.name}</div>
                <div>Gender: {data.gender}</div>
                <div>Age: {data.age}</div>
                <div>Disease free status: {data.dfsStatus}</div>
                <div>ECOG Status: {data.ecogStatus}</div>
                <div>
                    Karnofsky Performance Score:{' '}
                    {data.karnofskyPerformanceScore}
                </div>
                <div>KAS ID: {data.kasId}</div>
                <div>Overall Survival: {data.osMonths} months</div>
                <div>Overall Survival Status: {data.osStatus}</div>
                <div>Sample Count: {data.sampleCount}</div>
                <div>Cancer Type: {data.cancerType}</div>
            </div>
        );
    }
);
