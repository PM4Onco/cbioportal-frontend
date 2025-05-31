import { getServerConfig } from 'config/config';

export const fhirsparkURL = () => {
    let host: string | null = window.location.hostname;
    let port = ':' + window.location.port;
    if (
        getServerConfig().fhirspark &&
        getServerConfig().fhirspark!.host &&
        getServerConfig().fhirspark!.host !== 'undefined'
    )
        host = getServerConfig().fhirspark!.host;
    if (
        getServerConfig().fhirspark &&
        getServerConfig().fhirspark!.port &&
        getServerConfig().fhirspark!.port !== 'undefined'
    )
        port = ':' + getServerConfig().fhirspark!.port;

    return `//${host}${port}`;
};
