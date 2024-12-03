import React from 'react';

import './toolbar-item.scss';

interface Props {
    active?: boolean;
    tourClass?: string;
}

export const Item = ({
    children,
    disabled,
    onClick,
    tourClass,
    className = '',
    active = false,
}: Props & React.HTMLProps<HTMLButtonElement>) => {
    return (
        <button
            data-tour={tourClass}
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
