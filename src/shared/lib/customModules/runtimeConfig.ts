import { ICustomFeatureConfig } from 'config/IAppConfig';

export type CustomMode = 'off' | 'compat' | 'full';

const DEFAULT_CUSTOM_MODE: CustomMode = 'full';

export const DEFAULT_CUSTOM_FEATURES: ICustomFeatureConfig = {
    mtb: true,
    followUp: true,
    clinicalTrialsGov: true,
    proms: true,
    absoluteTimeline: true,
};

function normalizeCustomMode(mode: unknown): CustomMode {
    if (mode === 'off' || mode === 'compat' || mode === 'full') {
        return mode;
    }

    return DEFAULT_CUSTOM_MODE;
}

function getServerConfig(): any {
    const win = window as any;

    if (typeof win.getServerConfig === 'function') {
        return win.getServerConfig() || {};
    }

    return {};
}

export function getCustomMode(): CustomMode {
    return normalizeCustomMode(getServerConfig().customMode);
}

export function isCustomModeEnabled(modes?: CustomMode[]): boolean {
    if (!modes || modes.length === 0) {
        return true;
    }

    return modes.includes(getCustomMode());
}

export function getCustomFeatures(): ICustomFeatureConfig {
    const raw = getServerConfig().customFeatures || {};

    return {
        ...DEFAULT_CUSTOM_FEATURES,
        ...raw,
    };
}

export type CustomFeatureKey = keyof ICustomFeatureConfig;

export function isCustomFeatureEnabled(feature: CustomFeatureKey): boolean {
    if (getCustomMode() === 'off') {
        return false;
    }

    return Boolean(getCustomFeatures()[feature]);
}
