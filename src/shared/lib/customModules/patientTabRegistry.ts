import * as React from 'react';
import { CustomMode, isCustomModeEnabled } from './runtimeConfig';

export interface PatientTabRenderContext {
    pageComponent: any;
    sampleManager: any;
    urlWrapper: any;
}

export interface PatientTabExtension {
    id: string;
    linkText: React.ReactNode;
    key?: string | number;
    order?: number;
    unmountOnHide?: boolean;
    modes?: CustomMode[];
    isVisible?: (context: PatientTabRenderContext) => boolean;
    render: (context: PatientTabRenderContext) => React.ReactNode;
}

type RegistryEntry = {
    extension: PatientTabExtension;
    seq: number;
};

const patientTabRegistry = new Map<string, RegistryEntry>();
let sequence = 0;

export function registerPatientTabExtension(extension: PatientTabExtension) {
    const existing = patientTabRegistry.get(extension.id);
    if (existing) {
        patientTabRegistry.set(extension.id, {
            extension,
            seq: existing.seq,
        });
        return;
    }

    patientTabRegistry.set(extension.id, {
        extension,
        seq: sequence++,
    });
}

export function unregisterPatientTabExtension(id: string) {
    patientTabRegistry.delete(id);
}

export function clearPatientTabExtensions() {
    patientTabRegistry.clear();
    sequence = 0;
}

export function getVisiblePatientTabExtensions(
    context: PatientTabRenderContext
): PatientTabExtension[] {
    return Array.from(patientTabRegistry.values())
        .filter(({ extension }) => {
            if (!isCustomModeEnabled(extension.modes)) {
                return false;
            }

            if (!extension.isVisible) {
                return true;
            }

            return extension.isVisible(context);
        })
        .sort((a, b) => {
            const orderA =
                a.extension.order === undefined
                    ? Number.MAX_SAFE_INTEGER
                    : a.extension.order;
            const orderB =
                b.extension.order === undefined
                    ? Number.MAX_SAFE_INTEGER
                    : b.extension.order;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.seq - b.seq;
        })
        .map(entry => entry.extension);
}
