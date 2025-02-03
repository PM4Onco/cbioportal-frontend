import { Step } from 'react-joyride';

export const steps: Array<Step> = [
    {
        target: '.toolbar',
        content:
            'This is the toolbar. From here you can add slides and components to the presentation, and undo/redo your changes.',
        disableBeacon: true,
    },
    {
        target: '.overview-deleted-container',
        content:
            'This is the overview. Here you can find all slides in the presentation, and delete or rearrange them.',
        placement: 'right',
        disableBeacon: true,
    },
    {
        target: '[data-tour="add-slide"]',
        content: "Let's get started by adding a new slide.",
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '.overview-deleted-container',
        content:
            "Great! The new slide is now visible in the overview. Next, let's try rearranging our slides.",
        placement: 'right',
        disableBeacon: true,
    },
    {
        target: '#overview-1',
        content: 'Right click a slide to open the action menu.',
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '.overview-contextmenu__move-down',
        content: 'Now click Move down.',
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '.overview-deleted-container',
        content: "Great! Let's try and delete a slide.",
        placement: 'right',
    },
    {
        target: '#overview-2',
        content: 'To delete a slide, open the action menu and press delete.',
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '.overview-contextmenu__delete',
        content: 'Now, click on delete.',
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '.overview-deleted-container',
        content: "Good job! Let's restore our title slide again.",
        placement: 'right',
    },
    {
        target: '.deleted-items__button',
        content: 'Click on Deleted Items, to view all deleted slides',
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '.deleted-items__item',
        content: 'Now, click on the slide to restore it.',
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '#overview-2',
        content:
            'Before we continue, move this slide up again. Right click to open the action menu.',
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '.overview-contextmenu__move-up',
        content: 'Now click Move up.',
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '.presentation',
        content: "Very good! Now let's get on with some content.",
    },
    {
        target: '[data-tour="add-text"]',
        content: 'Here, you can add a text field.',
    },
    {
        target: '.presentation .presentation__node--text',
        content: 'You can double-click the text field to edit it.',
    },
    {
        target: '.presentation .presentation__node--text',
        content:
            "You can also add data from the 'Clinical Data' tab with variables. Let's try to add the sex of our patient.",
    },
    {
        target: '.presentation .presentation__node--text',
        content: 'Edit the text field and add the variable {{sex}}',
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: '.presentation .presentation__node--text',
        content:
            "Great! The name of a variable is the same as its name in the 'Clinical Data' tab.",
    },
    {
        target: '[data-tour="add-mutation-table"]',
        content: 'You can also add a table with mutation data,',
    },
    {
        target: '[data-tour="add-timeline"]',
        content: "the timeline of the patient's treatment history,",
    },
    {
        target: '[data-tour="add-fusion-table"]',
        content: 'a table with fusion data,',
    },
    {
        target: '[data-tour="add-cnas"]',
        content: 'a table with copy number alterations,',
    },
    {
        target: '[data-tour="add-therapy-recommendation"]',
        content: 'select therapy recommendations from previous MTB sessions,',
    },
    {
        target: '[data-tour="add-clinical-data"]',
        content: "add a table with the data from the 'Clinical Data' tab,",
    },
    {
        target: '[data-tour="add-rectangle"]',
        content: 'and a rectangle to highlight things.',
    },
    {
        target: '.presentation',
        content:
            'To insert images copy & paste them via keyboard shortcuts or right click on the slide and select paste.',
    },
    {
        target: '[data-tour="help"]',
        content: 'For more information move your mouse over the question mark.',
        spotlightClicks: true,
    },
];
