// colors

export const cBioPortalFontColor = '#333';

const lineColors1 = [
    '#ec407a', // pink lighten-1
    '#5c6bc0', // indigo lighten-1
    '#26c6da', // cyan lighten-1
    '#66bb6a', // green lighten-1
    '#ff7043', // deep-orange lighten-1
    '#ffa726', // orange lighten-1
    //
    '#ab47bc', // purple lighten-1
    '#42a5f5', // blue lighten-1
    '#26a69a', // teal lighten-1
    '#d4e157', // lime lighten-1
    '#ffca28', // amber lighten-1
];

export const lineColors = [
    '#e91e63', // pink
    '#00bcd4', // cyan
    '#4caf50', // green
    '#ff9800', // orange
    '#009688', // teal
    '#2196f3', // blue
    '#ffc107', // amber
    '#ff5722', // deep-orange
    '#cddc39', // lime
    '#9c27b0', // purple
    '#3f51b5', // indigo
];

export const defaultPieColors = ['#616161', '#e0e0e0']; // grey darken-2, gray lighten-2
export const thresholdColorScale = [
    '#e53935',
    '#fb8c00',
    '#fdd835',
    '#c0ca33',
    '#43a047',
]; // red darken-1, orange darken-1, yellow darken-1, lime darken-1, green darken-1

export const eqLayoutValues = {
    color: '#5e35b1', // deep-purple darken-1
    colorNegative: '#e53935', // red darken-1
    symbol: 'triangleUp',
    symbolNegative: 'triangleDown',
};

export const vasLayoutValues = {
    color: '#039be5', // light-blue darken-1
    symbol: 'diamond',
};

export const averageLayoutValues = {
    color: '#607d8b', // blue-grey
    symbol: 'plus',
};

export const standardRangeLayoutValues = {
    color: '#424242', // grey darken-3
    symbol: 'square',
    areaOpacity: 0.04,
    symbolOpacity: 0.12,
    labelOpacity: 0.9,
};

// base layout constants
export const STROKE_WIDTH = 1;
export const TEXT_FONTSIZE = 8;
export const LABEL_TITLE_FONTSIZE = 18;

// fontsize
export const TICKLABEL_FONTSIZE = TEXT_FONTSIZE;
export const AXISLABEL_FONTSIZE = TICKLABEL_FONTSIZE + 1;
export const TITLE_FONTSIZE = TICKLABEL_FONTSIZE + 2;
export const LEGEND_FONTSIZE = AXISLABEL_FONTSIZE;
export const LABEL_FONTSIZE = TEXT_FONTSIZE;

// stroke width
export const LINE_STROKE_WIDTH = STROKE_WIDTH / 2;
export const GRID_STROKE_WIDTH = 0.75 * STROKE_WIDTH;
export const TICK_STROKE_WIDTH = STROKE_WIDTH;
export const AXIS_STROKE_WIDTH = LINE_STROKE_WIDTH;

// size
export const SCATTER_POINT_SIZE = 5 * LINE_STROKE_WIDTH;
export const GRID_SIZE = 5;
export const TICK_SIZE = GRID_SIZE + 1;

// grid colors
export const AXIS_COLOR = cBioPortalFontColor;
export const TICK_COLOR = AXIS_COLOR;
// export const GRID_COLOR = '#ECEFF1'; // color from CBIOPORTAL

// arrows
export const ARROW_HEIGHT = (2 / 3) * 2 * TICK_SIZE + 2 / 3;
export const ARROW_WIDTH = 2 * TICK_SIZE + 1;
export const REF_Y = ARROW_HEIGHT / 2;
export const POLYGON =
    '0 0, ' + ARROW_WIDTH + ' ' + REF_Y + ', 0 ' + ARROW_HEIGHT;
