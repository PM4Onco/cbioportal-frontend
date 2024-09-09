import React from 'react';

import './toolbar-item.scss';

interface Props {
    active?: boolean;
}

export const Item = ({
    children,
    disabled,
    onClick,
    className = '',
    active = false,
}: Props & React.HTMLProps<HTMLButtonElement>) => {
    return (
        <button
            className={`toolbar__menu-item ${
                active ? 'toolbar__menu-item--active' : ''
            } ${className}`}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
};
