import React, {
    Children,
    cloneElement,
    forwardRef,
    isValidElement,
    RefObject,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    autoUpdate,
    flip,
    FloatingFocusManager,
    FloatingPortal,
    offset,
    shift,
    useDismiss,
    useFloating,
    useInteractions,
    useListNavigation,
    useRole,
    useTypeahead,
} from '@floating-ui/react';

export const MenuItem = forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        label: string;
        disabled?: boolean;
    }
>(({ label, disabled, ...props }, ref) => {
    return (
        <button
            {...props}
            className="MenuItem"
            ref={ref}
            role="menuitem"
            disabled={disabled}
        >
            {label}
        </button>
    );
});

interface Props {
    label?: string;
    nested?: boolean;
}

export const Menu = forwardRef<
    HTMLDivElement,
    Props & React.HTMLProps<HTMLButtonElement>
>(({ children }, forwardedRef: RefObject<HTMLDivElement>) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const listItemsRef = useRef<Array<HTMLButtonElement | null>>([]);
    const listContentRef = useRef(
        Children.map(children, child =>
            isValidElement(child) ? child.props.label : null
        ) as Array<string | null>
    );
    const allowMouseUpCloseRef = useRef(false);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [
            offset({ mainAxis: 5, alignmentAxis: 4 }),
            flip({
                fallbackPlacements: ['left-start'],
            }),
            shift({ padding: 10 }),
        ],
        placement: 'right-start',
        strategy: 'fixed',
        whileElementsMounted: autoUpdate,
    });

    const role = useRole(context, { role: 'menu' });
    const dismiss = useDismiss(context);
    const listNavigation = useListNavigation(context, {
        listRef: listItemsRef,
        onNavigate: setActiveIndex,
        activeIndex,
    });
    const typeahead = useTypeahead(context, {
        enabled: isOpen,
        listRef: listContentRef,
        onMatch: setActiveIndex,
        activeIndex,
    });

    const { getFloatingProps, getItemProps } = useInteractions([
        role,
        dismiss,
        listNavigation,
        typeahead,
    ]);

    useEffect(() => {
        let timeout: number;

        function onContextMenu(e: MouseEvent) {
            e.preventDefault();

            refs.setPositionReference({
                getBoundingClientRect() {
                    return {
                        width: 0,
                        height: 0,
                        x: e.clientX,
                        y: e.clientY,
                        top: e.clientY,
                        right: e.clientX,
                        bottom: e.clientY,
                        left: e.clientX,
                    };
                },
            });

            setIsOpen(true);
            clearTimeout(timeout);

            allowMouseUpCloseRef.current = false;
            timeout = window.setTimeout(() => {
                allowMouseUpCloseRef.current = true;
            }, 300);
        }

        function onMouseUp() {
            if (allowMouseUpCloseRef.current) {
                setIsOpen(false);
            }
        }

        forwardedRef.current?.addEventListener('contextmenu', onContextMenu);
        forwardedRef.current?.addEventListener('mouseup', onMouseUp);
        return () => {
            forwardedRef.current?.removeEventListener(
                'contextmenu',
                onContextMenu
            );
            forwardedRef.current?.removeEventListener('mouseup', onMouseUp);
            clearTimeout(timeout);
        };
    }, [refs]);

    return (
        <FloatingPortal>
            {
                <FloatingFocusManager
                    context={context}
                    initialFocus={refs.floating}
                >
                    <div
                        className="ContextMenu"
                        ref={refs.setFloating}
                        style={{
                            ...floatingStyles,
                            visibility: isOpen ? 'visible' : 'hidden',
                        }}
                        {...getFloatingProps()}
                    >
                        {Children.map(
                            children,
                            (child, index) =>
                                isValidElement(child) &&
                                cloneElement(
                                    child,
                                    getItemProps({
                                        tabIndex:
                                            activeIndex === index ? 0 : -1,
                                        ref(node: HTMLButtonElement) {
                                            listItemsRef.current[index] = node;
                                        },
                                        onClick() {
                                            console.log('menu click');
                                            child.props.onClick?.();
                                            setIsOpen(false);
                                        },
                                        onMouseUp() {
                                            child.props.onClick?.();
                                            setIsOpen(false);
                                        },
                                    })
                                )
                        )}
                    </div>
                </FloatingFocusManager>
            }
        </FloatingPortal>
    );
});
