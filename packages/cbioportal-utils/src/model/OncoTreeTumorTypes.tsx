type TumorType = {
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

function loadOncoTreeTumorTypes(): TumorType[] {
    if (
        typeof window === 'undefined' ||
        typeof XMLHttpRequest === 'undefined'
    ) {
        return [];
    }

    const url = '/tumorTypes.json';

    try {
        const getRequest = new XMLHttpRequest();
        getRequest.open('GET', url, false);
        getRequest.send(null);
        return JSON.parse(getRequest.responseText);
    } catch (error) {
        return [];
    }
}

const oncoTreeTumorTypes: TumorType[] = loadOncoTreeTumorTypes();

export default oncoTreeTumorTypes;
