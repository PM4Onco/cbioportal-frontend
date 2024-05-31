import MutationTableWrapper from 'pages/patientView/mutation/MutationTableWrapper';
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

interface Props {
    patientViewPageStore: any;
    dataStore: any;
    sampleManager: any;
    sampleIds: string[];
    mergeOncoKbIcons: boolean;
    onOncoKbIconToggle: (mergeIcons: boolean) => void;
    columnVisibility: { [columnId: string]: boolean } | undefined;
    onFilterGenes: (option: any) => void;
    columnVisibilityProps: any;
    onSelectGenePanel: (name: string) => void;
    disableTooltip: boolean;
    onRowClick: (d: any[]) => void;
    onRowMouseEnter: (d: any[]) => void;
    onRowMouseLeave: (d: any[]) => void;
    namespaceColumns: any;
    columns: string[];
    pageMode: 'sample' | 'patient';
    alleleFreqHeaderRender: ((name: string) => JSX.Element) | undefined;
}

export class MutationTable extends React.Component<Props, State> {
    ref = React.createRef<HTMLDivElement>();

    constructor(props: Props) {
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

    @boundMethod
    onPointerUp(event: PointerEvent) {
        this.setState({ ...this.state, down: false });
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
    onPointerDown(event: React.PointerEvent) {
        this.setState({ ...this.state, down: true, selected: true });
    }

    stopEditing() {
        this.setState({ ...this.state, editing: false });
    }

    unselectNode() {
        this.setState({ ...this.state, selected: false });
    }

    render() {
        return (
            <div
                ref={this.ref}
                style={this.calculateTransformation()}
                className={`presentation__mutation-table 
                     ${
                         this.state.selected
                             ? 'presentation__node--selected'
                             : ''
                     } 
                     ${this.state.editing ? 'presentation__node--editing' : ''}
                `}
                onPointerDown={this.onPointerDown}
            >
                <MutationTableWrapper
                    patientViewPageStore={this.props.patientViewPageStore}
                    dataStore={this.props.dataStore}
                    sampleManager={this.props.sampleManager}
                    sampleIds={
                        this.props.sampleManager
                            ? this.props.sampleManager.getActiveSampleIdsInOrder()
                            : []
                    }
                    mergeOncoKbIcons={this.props.mergeOncoKbIcons}
                    onOncoKbIconToggle={this.props.onOncoKbIconToggle}
                    columnVisibility={this.props.columnVisibility}
                    onFilterGenes={this.props.onFilterGenes}
                    columnVisibilityProps={this.props.columnVisibilityProps}
                    onSelectGenePanel={this.props.onSelectGenePanel}
                    disableTooltip={this.props.disableTooltip}
                    onRowClick={this.props.onRowClick}
                    onRowMouseEnter={this.props.onRowMouseEnter}
                    onRowMouseLeave={this.props.onRowMouseLeave}
                    namespaceColumns={this.props.namespaceColumns}
                    columns={this.props.columns}
                    pageMode={this.props.pageMode}
                    alleleFreqHeaderRender={undefined}
                ></MutationTableWrapper>
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
