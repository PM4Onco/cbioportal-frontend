type tumorType = {
    code?: string;
    color?: string;
    name?: string;
    mainType?: string;
    externalReferences?: {
        UMLS?: Array<string>;
        NCI?: Array<string>;
    };
    tissue?: string;
    children?: object;
    parent?: string;
    history?: Array<any>;
    level?: number;
    revocations?: Array<any>;
    precursors?: Array<any>;
};

function loadOncoTreeTumorTypes(): Array<tumorType> {
    // Keep tests and offline environments deterministic.
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
        return [];
    }

    let url = '/tumorTypes.json';
    if (
        window.location.hostname === 'localhost' ||
        window.location.port === '3000'
    ) {
        url = 'https://oncotree.info/api/tumorTypes';
    }

    try {
        const getRequest = new XMLHttpRequest();
        getRequest.open('Get', url, false);
        getRequest.send(null);
        return JSON.parse(getRequest.responseText || '[]');
    } catch (error) {
        return [];
    }
}

const oncoTreeTumorTypes: Array<tumorType> = loadOncoTreeTumorTypes();

export default oncoTreeTumorTypes;
