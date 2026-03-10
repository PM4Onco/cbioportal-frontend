type AxiosResponse<T = any> = {
    data: T;
    status: number;
};

const resolved = <T>(data: T): Promise<AxiosResponse<T>> =>
    Promise.resolve({ data, status: 200 });

const axios = {
    create: () => axios,
    get: () => resolved({}),
    post: () => resolved({}),
    put: () => resolved({}),
    delete: () => resolved({}),
    request: () => resolved({}),
    defaults: {},
    interceptors: {
        request: { use: () => 0, eject: () => undefined },
        response: { use: () => 0, eject: () => undefined },
    },
};

export default axios;
