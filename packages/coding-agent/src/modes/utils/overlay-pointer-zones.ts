/**
 * Overlay pointer zones — CADILLAC mouse/finger scroll contract.
 *
 * **Rule:** wheel and hover follow the *pointer hit-test*, never sticky
 * keyboard/focus from a previous region. Floating over action chips then
 * back over the table must scroll the table without requiring a click.
 *
 * Same contract as click/tap: SGR `row` (and optional col) decides the zone.
 * pi-tui `SgrMouseEvent`: use `wheel` / `motion` / `leftClick` — not kind/button strings.
 *
 * Used by Hermes inventory, port lists, and any multi-pane fullscreen coat UI.
 */

export type OverlayPointerZone = "table" | "actions" | "other"

export type OverlayZoneGeom = {
	/** First screen row of the scrollable list (inclusive). */
	tableStart: number
	/** Visible list hit rows. */
	tableHit: number
	/** First screen row of action strip, or -1 if none. */
	actionStart?: number
	/** Number of action rows. */
	actionCount?: number
	/** Optional column end for table (exclusive); omit = full width. */
	tableColEnd?: number
	/** Optional column start for actions. */
	actionColStart?: number
}

/** Map pointer (row[, col]) → zone. */
export function overlayZoneAt(
	row: number,
	geom: OverlayZoneGeom,
	col?: number,
): OverlayPointerZone {
	const inTableRow =
		geom.tableHit > 0 && row >= geom.tableStart && row < geom.tableStart + geom.tableHit
	const colOkTable =
		col === undefined || geom.tableColEnd === undefined || col < geom.tableColEnd
	if (inTableRow && colOkTable) return "table"

	const aStart = geom.actionStart ?? -1
	const aCount = geom.actionCount ?? 0
	const inActionRow = aStart >= 0 && aCount > 0 && row >= aStart && row < aStart + aCount
	const colOkAction =
		col === undefined || geom.actionColStart === undefined || col >= geom.actionColStart
	if (inActionRow && colOkAction) return "actions"

	return "other"
}

export type OverlayWheelHandlers = {
	/** Default scroll target (main list). */
	table: (delta: -1 | 1) => void
	/** Action / footer strip under pointer. */
	actions?: (delta: -1 | 1) => void
	/**
	 * Detail pane / chrome under pointer. Defaults to `table` so scrolling
	 * anywhere that is not the action strip still moves the list.
	 */
	other?: (delta: -1 | 1) => void
}

/**
 * Route a wheel notch by zone under the pointer.
 * `other` falls back to `table` when not provided.
 */
export function routeOverlayWheel(
	zone: OverlayPointerZone,
	delta: -1 | 1,
	handlers: OverlayWheelHandlers,
): void {
	if (zone === "actions" && handlers.actions) {
		handlers.actions(delta)
		return
	}
	if (zone === "other" && handlers.other) {
		handlers.other(delta)
		return
	}
	handlers.table(delta)
}

/** List index from pointer row + scroll offset. */
export function overlayTableIndexAt(
	row: number,
	geom: Pick<OverlayZoneGeom, "tableStart" | "tableHit">,
	scroll: number,
	count: number,
): number | null {
	if (count <= 0 || geom.tableHit <= 0) return null
	if (row < geom.tableStart || row >= geom.tableStart + geom.tableHit) return null
	const idx = scroll + (row - geom.tableStart)
	if (idx < 0 || idx >= count) return null
	return idx
}

/** Action index from pointer row. */
export function overlayActionIndexAt(
	row: number,
	geom: Pick<OverlayZoneGeom, "actionStart" | "actionCount">,
): number | null {
	const aStart = geom.actionStart ?? -1
	const aCount = geom.actionCount ?? 0
	if (aStart < 0 || aCount <= 0) return null
	if (row < aStart || row >= aStart + aCount) return null
	return row - aStart
}
