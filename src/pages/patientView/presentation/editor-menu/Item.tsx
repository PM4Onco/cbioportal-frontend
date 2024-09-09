import React from 'react';

interface Props {
    active: boolean;
}

export const Item = ({
    children,
    disabled,
    onClick,
    active,
}: Props & React.HTMLProps<HTMLButtonElement>) => {
    return (
        <button
            className={`editor__menu-item ${
                active ? 'editor__menu-item--active' : ''
            }`}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
};
