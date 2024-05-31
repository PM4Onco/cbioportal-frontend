import React from 'react';
import { boundMethod } from 'autobind-decorator';

interface Position {
    y: number;
    x: number;
}

interface State {
    position: Position;
    down: boolean;
    selected: boolean;
    editing: boolean;
}

class TextNode extends React.Component<{}, State> {
    ref = React.createRef<HTMLDivElement>();

    constructor(props: {}) {
        super(props);
        this.state = {
            down: false,
            selected: false,
            editing: false,
            position: {
                x: 0,
                y: 0,
            },
        };

        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp);
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('click', this.onOutsideClick);
    }

    focus() {
        this.ref.current?.focus();
        document.getSelection()!.collapse(this.ref.current, 1);
    }

    @boundMethod
    onPointerDown(event: React.PointerEvent) {
        this.setState({ ...this.state, down: true, selected: true });
    }

    @boundMethod
    onPointerUp(event: PointerEvent) {
        this.setState({ ...this.state, down: false });
    }

    @boundMethod
    onPointerMove(event: PointerEvent) {
        if (this.state.editing) {
            return;
        }
        const canvas = document.querySelector('.presentation');

        if (this.state.down) {
            const { y, x } = this.state.position;
            this.setState({
                ...this.state,
                position: {
                    x: x + event.movementX,
                    y: y + event.movementY,
                },
            });
        }
    }

    @boundMethod
    onOutsideClick(event: MouseEvent) {
        if (
            event.target !== this.ref.current &&
            !this.ref.current?.contains(event.target as Node)
        ) {
            this.handleEscapePress();
        }
    }

    unselectNode() {
        this.setState({ ...this.state, selected: false });
    }

    @boundMethod
    startEditing() {
        this.setState({ ...this.state, editing: true });
        setTimeout(() => this.focus());
    }

    stopEditing() {
        this.setState({ ...this.state, editing: false });
    }

    @boundMethod
    onKeyDown(event: KeyboardEvent) {
        switch (event.code) {
            case 'Escape':
                this.handleEscapePress();
                break;
            case 'Backspace':
                this.ref.current?.remove();
                break;
        }
    }

    render() {
        return (
            <div
                ref={this.ref}
                style={this.calculateTransformation()}
                className={`presentation__text-node 
                     ${
                         this.state.selected
                             ? 'presentation__node--selected'
                             : ''
                     } 
                     ${this.state.editing ? 'presentation__node--editing' : ''}
                `}
                onDoubleClick={this.startEditing}
                onPointerDown={this.onPointerDown}
                contentEditable={this.state.editing}
                suppressContentEditableWarning={true}
            >
                TextNode
            </div>
        );
    }

    private handleEscapePress() {
        if (this.state.editing) {
            this.stopEditing();
        } else {
            this.unselectNode();
        }
    }

    private calculateTransformation() {
        const { x, y } = this.state.position;

        return { transform: `translateX(${x}px) translateY(${y}px)` };
    }
}

export default TextNode;
