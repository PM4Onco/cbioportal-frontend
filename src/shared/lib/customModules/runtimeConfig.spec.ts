import {
    getCustomFeatures,
    getCustomMode,
    isCustomFeatureEnabled,
} from './runtimeConfig';

describe('custom module runtime config', () => {
    const win = window as any;
    let serverConfig: any = {};
    const originalGetServerConfig = win.getServerConfig;

    beforeEach(() => {
        serverConfig = {};
        win.getServerConfig = () => serverConfig;
    });

    afterAll(() => {
        win.getServerConfig = originalGetServerConfig;
    });

    it('uses full as default mode', () => {
        serverConfig.customMode = undefined;
        expect(getCustomMode()).toBe('full');
    });

    it('merges feature defaults with overrides', () => {
        serverConfig.customMode = 'full';
        serverConfig.customFeatures = { proms: false };

        expect(getCustomFeatures().mtb).toBe(true);
        expect(getCustomFeatures().proms).toBe(false);
    });

    it('forces all custom features off when mode is off', () => {
        serverConfig.customMode = 'off';
        serverConfig.customFeatures = { proms: true };

        expect(isCustomFeatureEnabled('proms')).toBe(false);
        expect(isCustomFeatureEnabled('mtb')).toBe(false);
    });
});
