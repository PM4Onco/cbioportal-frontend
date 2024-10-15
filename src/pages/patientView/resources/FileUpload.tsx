import React, { useState } from 'react';
import './file-upload.scss';

interface Props {
    patientId: string;
}

export const FileUpload = ({ patientId }: Props) => {
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            console.log(e.target.files[0]);
            setFile(e.target.files[0]);
        }
    };

    const uploadFile = async () => {
        if (file) {
            const body = new FormData();
            body.append('file', file);

            const response = await fetch(
                `http://localhost:3001/resources/${patientId}/upload`,
                {
                    method: 'POST',
                    body: body,
                }
            );

            if (response.status === 201) {
                location.reload();
            }
        }
    };

    return (
        <div className="file-upload__container">
            <input
                id="fileUpload"
                className="file-upload__button"
                type="file"
                onChange={handleFileChange}
            />
            {file && (
                <button className="file-upload__button" onClick={uploadFile}>
                    Upload
                </button>
            )}
        </div>
    );
};
