import { getServerConfig } from 'config/config';

export const minioURL = () => {
    const { minio } = getServerConfig();
    const host =
        minio?.host ??
        `${window.location.protocol}//${window.location.hostname}`;
    const port = minio?.port ?? 9000; // default minio port

    return `${host}:${port}`;
};
