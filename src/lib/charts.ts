/**
 * Below this width (px) a chart is on a phone: the axis titles give way (the card's title already names what's
 * plotted), the dates stay level and the legend tightens, so the plot keeps its room.
 */
export const NARROW_CHART_WIDTH = 480;

/** Legend labels on a narrow chart: smaller and closer together, so they wrap onto fewer lines. */
export const NARROW_LEGEND_LABELS = { boxWidth: 8, boxHeight: 8, padding: 8, font: { family: 'Inter', size: 11 } };

/**
 * Classes for the card around a chart or a long list. On a phone the card's frame and padding go, so the content gets
 * the screen's full width; from sm up it's a normal card.
 */
export const CHART_CARD = {
	root: 'border-0 bg-transparent shadow-none sm:border sm:bg-card sm:shadow-sm',
	header: 'p-0 sm:p-6 sm:pb-0',
	content: 'px-0 pb-0 pt-4 sm:p-6',
};