import {
    clearPatientTabExtensions,
    getVisiblePatientTabExtensions,
    registerPatientTabExtension,
} from './patientTabRegistry';

describe('patient tab registry', () => {
    const win = window as any;
    let serverConfig: any = {};
    const originalGetServerConfig = win.getServerConfig;

    const context = {
        pageComponent: {} as any,
        sampleManager: null,
        urlWrapper: {} as any,
    };

    beforeEach(() => {
        serverConfig = { customMode: 'full' };
        win.getServerConfig = () => serverConfig;
        clearPatientTabExtensions();
    });

    afterAll(() => {
        clearPatientTabExtensions();
        win.getServerConfig = originalGetServerConfig;
    });

    it('returns tabs sorted by order then by registration sequence', () => {
        registerPatientTabExtension({
            id: 'tab-b',
            linkText: 'Tab B',
            order: 20,
            render: () => null,
        });
        registerPatientTabExtension({
            id: 'tab-a',
            linkText: 'Tab A',
            order: 10,
            render: () => null,
        });
        registerPatientTabExtension({
            id: 'tab-c',
            linkText: 'Tab C',
            order: 20,
            render: () => null,
        });

        const ids = getVisiblePatientTabExtensions(context).map(tab => tab.id);
        expect(ids).toEqual(['tab-a', 'tab-b', 'tab-c']);
    });

    it('filters tabs by custom mode', () => {
        registerPatientTabExtension({
            id: 'tab-full',
            linkText: 'Tab Full',
            modes: ['full'],
            render: () => null,
        });
        registerPatientTabExtension({
            id: 'tab-compat',
            linkText: 'Tab Compat',
            modes: ['compat'],
            render: () => null,
        });

        serverConfig.customMode = 'compat';
        const ids = getVisiblePatientTabExtensions(context).map(tab => tab.id);
        expect(ids).toEqual(['tab-compat']);
    });

    it('respects isVisible callback', () => {
        registerPatientTabExtension({
            id: 'tab-hidden',
            linkText: 'Tab Hidden',
            isVisible: () => false,
            render: () => null,
        });

        expect(getVisiblePatientTabExtensions(context)).toHaveLength(0);
    });
});
