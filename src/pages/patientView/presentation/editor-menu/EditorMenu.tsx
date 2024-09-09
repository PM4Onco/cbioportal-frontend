import { Editor } from '@tiptap/react';
import { Item } from 'pages/patientView/presentation/editor-menu/Item';
import React from 'react';

import './editor-menu.scss';
import { FontSize } from './FontSize';

export const EditorMenu = ({ editor }: { editor: Editor | null }) => {
    if (!editor) return null;

    return (
        <div className="editor__menu-container">
            <FontSize editor={editor!}></FontSize>
            <Item
                onClick={() =>
                    editor!
                        .chain()
                        .focus()
                        .toggleBold()
                        .run()
                }
                active={editor.isActive('bold')}
                disabled={
                    !editor!
                        .can()
                        .chain()
                        .toggleBold()
                        .run()
                }
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M3 3a1 1 0 0 1 1-1h5a3.5 3.5 0 0 1 2.843 5.541A3.75 3.75 0 0 1 9.25 14H4a1 1 0 0 1-1-1V3Zm2.5 3.5v-2H9a1 1 0 0 1 0 2H5.5Zm0 2.5v2.5h3.75a1.25 1.25 0 1 0 0-2.5H5.5Z"
                        clipRule="evenodd"
                    />
                </svg>
            </Item>
            <Item
                onClick={() =>
                    editor!
                        .chain()
                        .focus()
                        .toggleUnderline()
                        .run()
                }
                active={editor.isActive('underline')}
                disabled={
                    !editor!
                        .can()
                        .chain()
                        .toggleUnderline()
                        .run()
                }
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M4.75 2a.75.75 0 0 1 .75.75V7a2.5 2.5 0 0 0 5 0V2.75a.75.75 0 0 1 1.5 0V7a4 4 0 0 1-8 0V2.75A.75.75 0 0 1 4.75 2ZM2 13.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
                        clipRule="evenodd"
                    />
                </svg>
            </Item>
            <Item
                onClick={() =>
                    editor!
                        .chain()
                        .focus()
                        .toggleStrike()
                        .run()
                }
                active={editor.isActive('strike')}
                disabled={
                    !editor!
                        .can()
                        .chain()
                        .toggleStrike()
                        .run()
                }
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M9.165 3.654c-.95-.255-1.921-.273-2.693-.042-.769.231-1.087.624-1.173.947-.087.323-.008.822.543 1.407.389.412.927.77 1.55 1.034H13a.75.75 0 0 1 0 1.5H3A.75.75 0 0 1 3 7h1.756l-.006-.006c-.787-.835-1.161-1.849-.9-2.823.26-.975 1.092-1.666 2.191-1.995 1.097-.33 2.36-.28 3.512.029.75.2 1.478.518 2.11.939a.75.75 0 0 1-.833 1.248 5.682 5.682 0 0 0-1.665-.738Zm2.074 6.365a.75.75 0 0 1 .91.543 2.44 2.44 0 0 1-.35 2.024c-.405.585-1.052 1.003-1.84 1.24-1.098.329-2.36.279-3.512-.03-1.152-.308-2.27-.897-3.056-1.73a.75.75 0 0 1 1.092-1.029c.552.586 1.403 1.056 2.352 1.31.95.255 1.92.273 2.692.042.55-.165.873-.417 1.038-.656a.942.942 0 0 0 .13-.803.75.75 0 0 1 .544-.91Z"
                        clipRule="evenodd"
                    />
                </svg>
            </Item>
            <Item
                onClick={() =>
                    editor!
                        .chain()
                        .focus()
                        .toggleBulletList()
                        .run()
                }
                active={editor.isActive('bulletList')}
                disabled={
                    !editor!
                        .can()
                        .chain()
                        .toggleBulletList()
                        .run()
                }
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path d="M3 4.75a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM6.25 3a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7ZM6.25 7.25a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7ZM6.25 11.5a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7ZM4 12.25a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM3 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
                </svg>
            </Item>
            <Item
                onClick={() =>
                    editor!
                        .chain()
                        .focus()
                        .setTextAlign('left')
                        .run()
                }
                active={editor.isActive({ textAlign: 'left' })}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 4.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Z"
                        clipRule="evenodd"
                    />
                </svg>
            </Item>
            <Item
                onClick={() =>
                    editor!
                        .chain()
                        .focus()
                        .setTextAlign('center')
                        .run()
                }
                active={editor.isActive({ textAlign: 'center' })}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 4.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
                        clipRule="evenodd"
                    />
                </svg>
            </Item>
            <Item
                onClick={() =>
                    editor!
                        .chain()
                        .focus()
                        .setTextAlign('right')
                        .run()
                }
                active={editor.isActive({ textAlign: 'right' })}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm6 4.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Z"
                        clipRule="evenodd"
                    />
                </svg>
            </Item>
        </div>
    );
};
