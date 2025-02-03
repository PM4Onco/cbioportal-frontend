import React, { useCallback, useEffect, useRef } from 'react';
import {
    DraggableChangedFn,
    SelectedChangedFn,
    StateChangedFn,
} from 'pages/patientView/presentation/model/dynamic-component';
import {
    AnyExtension,
    EditorContent,
    Extensions,
    useEditor,
} from '@tiptap/react';
import Typography from '@tiptap/extension-typography';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import TextStyle from '@tiptap/extension-text-style';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import History from '@tiptap/extension-history';

import ReactDOM from 'react-dom';
import { EditorMenu } from 'pages/patientView/presentation/toolbar/editor-menu/EditorMenu';
import { FontSize } from 'tiptap-extension-font-size';
import { TableToolbar } from 'pages/patientView/presentation/toolbar/TableToolbar';
import { Item } from 'pages/patientView/presentation/toolbar/Item';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from 'pages/patientView/presentation/Tooltip';
import { ClinicalDataReplacer } from 'pages/patientView/presentation/editor/clinicalDataReplacer';
import { ClinicalData } from 'cbioportal-ts-api-client';
import { StoreHelpers } from 'react-joyride';

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
    clinicalData: ClinicalData[];
    tourRunning: boolean;
    tourHelpers: StoreHelpers | undefined;
}

export const TextNode = ({
    stateChanged,
    initialValue,
    draggableChanged,
    selectedChanged,
    clinicalData,
    tourRunning,
    tourHelpers,
}: Props) => {
    const DEFAULT_VALUE = 'Neuer Textbaustein';
    const [state, setState] = React.useState<State>({
        down: false,
        selected: false,
        editing: false,
        resizing: false,
    });

    const documentRef = useRef(document);
    const containerRef = useRef<HTMLDivElement>(null);
    const elementRef = useRef<HTMLDivElement>(null);
    const [
        referenceRef,
        setReferenceRef,
    ] = React.useState<HTMLDivElement | null>(null);
    const toolbar = document.querySelector('.toolbar');
    const toolbarEditorMenu = document.querySelector('.toolbar__editor-menu');

    const [onUpdateEnabled, setOnUpdateEnabled] = React.useState(true);

    const extensions: Extensions = [
        Document,
        Paragraph,
        Typography,
        Text,
        Bold,
        Italic,
        Underline,
        Strike,
        TextAlign.configure({
            types: ['heading', 'paragraph'],
        }),
        BulletList,
        ListItem,
        TextStyle,
        Color,
        Table.configure({
            resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        History,
        FontSize as AnyExtension,
        ClinicalDataReplacer.configure({
            clinicalData,
        }),
    ];

    const editor = useEditor({
        extensions,
        content: initialValue,
        onUpdate: ({ editor }) => {
            if (!onUpdateEnabled) return;

            const text = editor.getText();
            if (tourRunning && text.includes('Male')) {
                tourHelpers?.next();
                setOnUpdateEnabled(false);
            }
        },
    });

    useEffect(() => {
        editor?.commands.setContent(initialValue);
    }, [initialValue]);

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
        if (state.editing || !editor) return;

        draggableChanged(false);
        editor.setEditable(true);
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
        if (!textNode || !editor) return;

        editor.setEditable(false);
        stateChanged(editor?.getHTML());
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
                !toolbar?.contains(event.target as Node)
            ) {
                handleEscapePress();
            }
        },
        [state]
    );

    return (
        <div ref={containerRef}>
            {state.editing &&
                toolbarEditorMenu &&
                ReactDOM.createPortal(
                    <EditorMenu editor={editor}></EditorMenu>,
                    toolbarEditorMenu
                )}
            {state.editing && editor?.can().addColumnAfter() && (
                <TableToolbar referenceRef={referenceRef}>
                    <Tooltip>
                        <TooltipTrigger>
                            <Item onClick={editor?.commands.addColumnBefore}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    width="24"
                                    height="24"
                                    stroke-width="2"
                                >
                                    <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1z"></path>
                                    <path d="M5 12l4 0"></path>
                                    <path d="M7 10l0 4"></path>
                                </svg>
                            </Item>
                        </TooltipTrigger>
                        <TooltipContent className="Tooltip">
                            Add column before
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger>
                            <Item onClick={editor?.commands.addColumnAfter}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    width="24"
                                    height="24"
                                    stroke-width="2"
                                >
                                    <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1z"></path>
                                    <path d="M5 12l4 0"></path>
                                    <path d="M7 10l0 4"></path>
                                </svg>
                            </Item>
                        </TooltipTrigger>
                        <TooltipContent className="Tooltip">
                            Add column after
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger>
                            <Item onClick={editor?.commands.deleteColumn}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    width="24"
                                    height="24"
                                    stroke-width="2"
                                >
                                    <path d="M6 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1z"></path>
                                    <path d="M16 10l4 4"></path>
                                    <path d="M16 14l4 -4"></path>
                                </svg>
                            </Item>
                        </TooltipTrigger>
                        <TooltipContent className="Tooltip">
                            Remove column
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger>
                            <Item onClick={editor?.commands.addRowBefore}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    width="24"
                                    height="24"
                                    stroke-width="2"
                                >
                                    <path d="M4 18v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1z"></path>
                                    <path d="M12 9v-4"></path>
                                    <path d="M10 7l4 0"></path>
                                </svg>
                            </Item>
                        </TooltipTrigger>
                        <TooltipContent className="Tooltip">
                            Add row before
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger>
                            <Item onClick={editor?.commands.addRowAfter}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    width="24"
                                    height="24"
                                    stroke-width="2"
                                >
                                    <path d="M20 6v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1z"></path>
                                    <path d="M12 15l0 4"></path>
                                    <path d="M14 17l-4 0"></path>
                                </svg>
                            </Item>
                        </TooltipTrigger>
                        <TooltipContent className="Tooltip">
                            Add row after
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger>
                            <Item onClick={editor?.commands.deleteRow}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    width="24"
                                    height="24"
                                    stroke-width="2"
                                >
                                    <path d="M20 6v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1z"></path>
                                    <path d="M10 16l4 4"></path>
                                    <path d="M10 20l4 -4"></path>
                                </svg>
                            </Item>
                        </TooltipTrigger>
                        <TooltipContent className="Tooltip">
                            Delete row
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger>
                            <Item onClick={editor?.commands.toggleHeaderRow}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    width="24"
                                    height="24"
                                    stroke-width="2"
                                >
                                    <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z"></path>
                                    <path d="M21 9h-18"></path>
                                    <path d="M15 3l-6 6"></path>
                                    <path d="M9.5 3l-6 6"></path>
                                    <path d="M20 3.5l-5.5 5.5"></path>
                                </svg>
                            </Item>
                        </TooltipTrigger>
                        <TooltipContent className="Tooltip">
                            Toggle header row
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger>
                            <Item onClick={editor?.commands.toggleHeaderColumn}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    width="24"
                                    height="24"
                                    stroke-width="2"
                                >
                                    <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z"></path>
                                    <path d="M10 10h11"></path>
                                    <path d="M10 3v18"></path>
                                    <path d="M9 3l-6 6"></path>
                                    <path d="M10 7l-7 7"></path>
                                    <path d="M10 12l-7 7"></path>
                                    <path d="M10 17l-4 4"></path>
                                </svg>
                            </Item>
                        </TooltipTrigger>
                        <TooltipContent className="Tooltip">
                            Toggle header column
                        </TooltipContent>
                    </Tooltip>
                </TableToolbar>
            )}
            <div
                className={`presentation__node presentation__node--text  ${
                    state.selected ? 'presentation__node--selected' : ''
                } ${state.editing ? 'presentation__node--editing' : ''}`}
                ref={setReferenceRef}
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
