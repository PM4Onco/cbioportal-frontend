import React, { useCallback, useEffect, useRef } from 'react';
import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';
import { EditorContent, useEditor } from '@tiptap/react';
import Typography from '@tiptap/extension-typography';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import TextStyle from '@tiptap/extension-text-style';

import ReactDOM from 'react-dom';
import { EditorMenu } from 'pages/patientView/presentation/editor-menu/EditorMenu';
import { FontSize } from 'tiptap-extension-font-size';

interface State {
    down: boolean;
    selected: boolean;
    editing: boolean;
    resizing: boolean;
}

interface Props {
    stateChanged: StateChangedFn;
    selectedChanged: SelectedChangedFn;
    draggableChanged: DraggableChangedFn;
    initialValue: string;
}

export const TextNode = ({
    stateChanged,
    initialValue,
    draggableChanged,
    selectedChanged,
}: Props) => {
    const [state, setState] = React.useState<State>({
        down: false,
        selected: false,
        editing: false,
        resizing: false,
    });

    const documentRef = useRef(document);
    const containerRef = useRef<HTMLDivElement>(null);
    const elementRef = useRef<HTMLDivElement>(null);
    const toolbarPortal = document.querySelector('.toolbar__editor-menu-items');

    const extensions = [
        Document,
        Paragraph,
        Typography,
        Text,
        Bold,
        Underline,
        Strike,
        TextAlign.configure({
            types: ['heading', 'paragraph'],
        }),
        BulletList,
        ListItem,
        TextStyle,
        FontSize,
    ];

    const editor = useEditor({
        extensions,
        content: initialValue,
    });

    useEffect(() => {
        editor?.setEditable(false);
    }, [editor]);

    useEffect(() => {
        const controller = new AbortController();

        documentRef.current.addEventListener('pointerup', onPointerUp, {
            signal: controller.signal,
        });
        documentRef.current.addEventListener('keydown', onKeyDown, {
            signal: controller.signal,
        });
        documentRef.current.addEventListener('pointerdown', onOutsideClick, {
            signal: controller.signal,
        });
        elementRef.current?.addEventListener('dblclick', () => startEditing(), {
            signal: controller.signal,
        });

        return () => {
            controller.abort();
        };
    }, [state, documentRef, editor]);

    const focus = () => {
        editor?.commands.focus('end');
    };

    const startEditing = useCallback(() => {
        if (state.editing) return;

        draggableChanged(false);
        editor?.setEditable(true);
        setState(current => ({ ...current, editing: true }));
        focus();
    }, [state]);

    const onPointerDown = (event: React.PointerEvent) => {
        selectedChanged(true);
        setState(current => ({ ...current, down: true, selected: true }));
    };

    const onKeyDown = useCallback(
        (event: KeyboardEvent) => {
            switch (event.code) {
                case 'Escape':
                    handleEscapePress();
                    break;
            }
        },
        [state]
    );

    const handleEscapePress = () => {
        if (state.editing) {
            stopEditing();
        } else {
            unselectNode();
        }
    };

    const stopEditing = () => {
        const textNode = elementRef.current;
        if (!textNode) return;

        editor?.setEditable(false);
        stateChanged(textNode.innerHTML);
        draggableChanged(true);
        setState(current => ({ ...current, editing: false }));
    };

    const unselectNode = () => {
        selectedChanged(false);
        setState(current => ({ ...current, selected: false }));
    };

    const onPointerUp = useCallback(() => {
        setState(current => ({ ...current, down: false, resizing: false }));
    }, []);

    const onOutsideClick = useCallback(
        (event: MouseEvent) => {
            if (
                event.target !== containerRef.current &&
                !containerRef.current?.contains(event.target as Node) &&
                !toolbarPortal?.contains(event.target as Node)
            ) {
                handleEscapePress();
            }
        },
        [state]
    );

    return (
        <div ref={containerRef}>
            {state.editing &&
                toolbarPortal &&
                ReactDOM.createPortal(
                    <EditorMenu editor={editor}></EditorMenu>,
                    toolbarPortal
                )}
            <div
                className={`presentation__node presentation__node--text ${
                    state.selected ? 'presentation__node--selected' : ''
                } ${state.editing ? 'presentation__node--editing' : ''}`}
            >
                <EditorContent
                    editor={editor}
                    ref={elementRef}
                    onPointerDown={onPointerDown}
                />
            </div>
        </div>
    );
};
