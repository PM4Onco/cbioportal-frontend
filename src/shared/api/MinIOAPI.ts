import { getServerConfig } from 'config/config';

export const minioURL = () => {
    const { minio } = getServerConfig();
    const host =
        minio?.host ??
        `${window.location.protocol}//${window.location.hostname}`;
    const port = minio?.port ?? window.location.port; // default minio port
    const portSeparator = port ? ':' : '';

    return `${host}${portSeparator}${port}`;
};
