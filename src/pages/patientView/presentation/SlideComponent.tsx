import React, { ReactNode, Ref, RefObject, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useHistoryState } from 'shared/lib/hooks/use-history-state';
import { Node } from './model/node';
import { Draggable } from 'pages/patientView/presentation/Draggable';
import { Dynamic } from 'pages/patientView/presentation/model/dynamic-component';
import { DndContext, DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { PointerSensor } from 'pages/patientView/presentation/PointerSensor';
import { deepCopy } from 'pages/patientView/presentation/utils/utils';

interface Props {
    innerRef: RefObject<any>;
    children?: ReactNode;
}

export const SlideComponent: React.FunctionComponent<Props> = observer(
    ({ innerRef }: Props) => {
        // const { state, set, undo, redo, canRedo, canUndo } = useHistoryState<Node<string>[]>([]);
        // const [refs, setRefs] = useState<Record<string, Ref<any>>>();

        const pointerSensor = useSensor(PointerSensor);
        const sensors = useSensors(pointerSensor);

        function onDragEnd(event: DragEndEvent) {
            // const copiedState = deepCopy(state); // not sure why copy is needed here
            //
            // const nextItems = copiedState.map(
            //     item => {
            //         if (item.id === event.active.id) {
            //             item.position.left += event.delta.x;
            //             item.position.top += event.delta.y;
            //             return item;
            //         } else {
            //             return item;
            //         }
            //     },
            // );
            //
            // set(nextItems);
        }

        function onValueChanged(id: string, value: any) {
            // console.log('valueChanged');
            // const copiedState = deepCopy(state); // not sure why copy is needed here
            //
            // let modified = false;
            //
            // const nextItems = copiedState.map(
            //     item => {
            //         if (item.id === id) {
            //             if (item.value === value) return item;
            //
            //             item.value = value;
            //             modified = true;
            //             return item;
            //         } else {
            //             return item;
            //         }
            //     },
            // );
            //
            // if (modified) {
            //     console.log('set ');
            //     // set(nextItems);
            // }
        }

        return (
            <section>
                <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                    {/*{state.map(component => {*/}
                    {/*    const node = state.find(*/}
                    {/*        position =>*/}
                    {/*            position.id === component.id,*/}
                    {/*    );*/}
                    {/*    if (!node || !refs) return;*/}
                    {/*    const ref = refs[node.id];*/}
                    {/*    return React.createElement(Draggable, {*/}
                    {/*        id: component.id,*/}
                    {/*        top: node.position.top,*/}
                    {/*        left: node.position.left,*/}
                    {/*        key: component.id,*/}
                    {/*        children: Dynamic(component.type, {*/}
                    {/*            innerRef: ref,*/}
                    {/*            initialValue: component.value,*/}
                    {/*            valueChanged: (value) => onValueChanged(component.id, value),*/}
                    {/*        }),*/}
                    {/*    });*/}
                    {/*})}*/}
                </DndContext>
            </section>
        );
    }
);
