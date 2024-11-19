import { Api } from 'reveal.js';

import './overview.scss';

export default () => ({
    id: 'overview',
    init: (reveal: Api) => {
        reveal.on('overview:update', () => updateOverview(reveal));
        reveal.on('slidechanged', () => updateSelectedSlide(reveal));
    },
});

let contextMenu: HTMLDivElement;
let controller: AbortController;

const openContextMenu = (reveal: Api, event: PointerEvent, slideId: number) => {
    event.preventDefault();

    slideClicked(reveal, slideId);
    closeContextMenu();

    const menu = document.createElement('div');
    menu.classList.add('overview-contextmenu');
    menu.innerHTML = `
        <h2>Actions</h2>
        <ul>
            <li class="overview-contextmenu__delete">Delete</li>
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

const deleteClicked = (reveal: Api, slideId: number) => {
    reveal.dispatchEvent({
        type: 'overview:action:delete',
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
