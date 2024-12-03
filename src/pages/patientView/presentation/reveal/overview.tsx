import { Api } from 'reveal.js';

import './overview.scss';
import { UUID } from 'pages/patientView/presentation/model/uuid';

export default () => ({
    id: 'overview',
    init: (reveal: Api) => {
        document
            .querySelector('.deleted-items__button')
            ?.addEventListener('click', () => toggleDeletedSlides(reveal));
        reveal.on('overview:update', () => updateOverview(reveal));
        reveal.on('slidechanged', () => updateSelectedSlide(reveal));
    },
});

let contextMenu: HTMLDivElement;
let controller: AbortController;
let deletedSlidesVisible = false;

const openContextMenu = (reveal: Api, event: PointerEvent, slideId: number) => {
    event.preventDefault();

    slideClicked(reveal, slideId);
    closeContextMenu();

    const menu = document.createElement('div');
    menu.classList.add('overview-contextmenu');
    menu.innerHTML = `
        <h2>Actions</h2>
        <ul>
            <div class="overview-contextmenu__action-group">
                <li class="overview-contextmenu__move-up">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z" clip-rule="evenodd" />
                    </svg>
 
                    Move up
                </li>
                <li class="overview-contextmenu__move-down">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clip-rule="evenodd" />
                    </svg>
                    Move down
                </li>
            </div>
            <div class="overview-contextmenu__action-group">
                <li class="overview-contextmenu__delete" ${
                    reveal.getTotalSlides() === 1 ? 'disabled' : ''
                }>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd" />
                    </svg>
                    Delete
                </li>
            </div>
        </ul>
    `;

    menu.style.top = `${event.pageY}px`;
    menu.style.left = `${event.clientX}px`;

    contextMenu = menu;
    controller = new AbortController();

    document.body.appendChild(menu);
    document.body.addEventListener(
        'click',
        (event: PointerEvent) => bodyClicked(event),
        { signal: controller.signal }
    );
    document.body.addEventListener(
        'keydown',
        (event: KeyboardEvent) => keyPressed(event),
        { signal: controller.signal }
    );
    menu.querySelector('.overview-contextmenu__delete')?.addEventListener(
        'click',
        () => {
            deleteClicked(reveal, slideId);
        },
        {
            signal: controller.signal,
        }
    );

    menu.querySelector('.overview-contextmenu__move-up')?.addEventListener(
        'click',
        () => {
            moveUpClicked(reveal, slideId);
        },
        {
            signal: controller.signal,
        }
    );
    menu.querySelector('.overview-contextmenu__move-down')?.addEventListener(
        'click',
        () => {
            moveDownClicked(reveal, slideId);
        },
        {
            signal: controller.signal,
        }
    );
    reveal.dispatchEvent({
        type: 'overview:menu:open',
        bubbles: false,
        data: {
            slideId,
        },
        target: undefined,
    });
};

const closeContextMenu = () => {
    if (contextMenu) {
        contextMenu.remove();
        controller.abort();
    }
};

const keyPressed = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
        closeContextMenu();
    }
};

const bodyClicked = (event: PointerEvent) => {
    if (event.target && !contextMenu.contains(event.target as Node)) {
        closeContextMenu();
    }
};

const toggleDeletedSlides = (reveal: Api) => {
    if (deletedSlidesVisible) {
        deletedSlidesVisible = false;
        document
            .querySelector('.deleted-items__item-container')
            ?.setAttribute('hidden', '');
        reveal.dispatchEvent({
            type: 'overview:deleted-slides:close',
            data: undefined,
            bubbles: false,
            target: undefined,
        });
    } else {
        deletedSlidesVisible = true;
        document
            .querySelector('.deleted-items__item-container')
            ?.removeAttribute('hidden');
        reveal.dispatchEvent({
            type: 'overview:deleted-slides:open',
            data: undefined,
            bubbles: false,
            target: undefined,
        });
    }
};

const deleteClicked = (reveal: Api, slideId: number) => {
    if (reveal.getTotalSlides() === 1) return;

    const uuid = crypto.randomUUID();

    addSlideToTrash(reveal, uuid);
    reveal.dispatchEvent({
        type: 'overview:action:delete',
        bubbles: false,
        data: {
            slideId,
            uuid,
        },
        target: undefined,
    });
    closeContextMenu();
};

const addSlideToTrash = (reveal: Api, uuid: UUID) => {
    const slideToDelete = reveal.getCurrentSlide().cloneNode(true);
    const deletedContainer = document.querySelector(
        '.deleted-items__item-container'
    );

    if (!deletedContainer) return;

    const container = createContainer();
    const controller = new AbortController();

    container.addEventListener(
        'click',
        () => {
            restoreSlide(reveal, deletedContainer, container, uuid);
            controller.abort();
        },
        { signal: controller.signal }
    );
    container.appendChild(slideToDelete);
    deletedContainer.appendChild(container);
};

const createContainer = () => {
    const container = document.createElement('div');
    const overlay = document.createElement('div');
    overlay.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
    Restore
    `;
    container.classList.add('deleted-items__item');
    overlay.classList.add('deleted-items__overlay');

    container.appendChild(overlay);

    return container;
};

const restoreSlide = (
    reveal: Api,
    deletedContainer: Element,
    container: HTMLDivElement,
    uuid: UUID
) => {
    deletedContainer.removeChild(container);
    reveal.dispatchEvent({
        type: 'overview:action:restore',
        bubbles: false,
        data: {
            uuid,
        },
        target: undefined,
    });
};

const moveUpClicked = (reveal: Api, slideId: number) => {
    reveal.dispatchEvent({
        type: 'overview:action:move-up',
        bubbles: false,
        data: {
            slideId,
        },
        target: undefined,
    });
    closeContextMenu();
};

const moveDownClicked = (reveal: Api, slideId: number) => {
    reveal.dispatchEvent({
        type: 'overview:action:move-down',
        bubbles: false,
        data: {
            slideId,
        },
        target: undefined,
    });
    closeContextMenu();
};

const updateOverview = (reveal: Api) => {
    const overviewContainer = document.querySelector('.reveal-overview');
    const slides = reveal.getSlidesElement();

    if (!overviewContainer || !slides) return;

    overviewContainer.innerHTML = '';

    const selectedId = reveal.getCurrentSlide().id;

    const copiedSlides = slides.cloneNode(true);
    // @ts-ignore
    for (const node: Element of copiedSlides.children) {
        if (node.id === selectedId) {
            node.classList.add('selected');
        }

        node.id = `overview-${node.id}`;
        node.addEventListener('click', () =>
            slideClicked(reveal, originalSlideId(node.id))
        );
        node.addEventListener('contextmenu', (event: PointerEvent) =>
            openContextMenu(reveal, event, originalSlideId(node.id))
        );
    }

    overviewContainer.appendChild(copiedSlides);
};

const updateSelectedSlide = (reveal: Api) => {
    const selectedId = reveal.getCurrentSlide().id;
    const oldSelection = document.querySelector('.reveal-overview .selected');
    const newSelection = document.querySelector(`#overview-${selectedId}`);

    if (!oldSelection || !newSelection) return;

    oldSelection.classList.remove('selected');
    newSelection.classList.add('selected');
};

const slideClicked = (reveal: Api, id: number) => {
    reveal.slide(id - 1);
};

const originalSlideId = (id: string) => {
    return Number(id.replace('overview-', ''));
};
