import React from 'react';
import { Editor } from '@tiptap/react';

interface Props {
    editor: Editor;
}

export const FontSize = ({
    editor,
}: Props & React.HTMLProps<HTMLButtonElement>) => {
    function updateFontSize(value: number) {
        editor
            .chain()
            .setFontSize(`${value}px`)
            .run();
    }

    const fontSize = Number(
        editor.getAttributes('textStyle').fontSize?.replace('px', '') ?? 16
    );

    return (
        <div className="editor__font-size-container">
            <button onClick={() => updateFontSize(fontSize - 1)}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path d="M3.75 7.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" />
                </svg>
            </button>
            <input
                type="number"
                value={fontSize}
                onChange={event => updateFontSize(Number(event.target.value))}
            />
            <button onClick={() => updateFontSize(fontSize + 1)}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
                </svg>
            </button>
        </div>
    );
};
