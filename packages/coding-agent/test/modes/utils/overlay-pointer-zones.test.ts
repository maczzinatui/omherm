import { describe, expect, it } from "bun:test"
import {
	overlayActionIndexAt,
	overlayTableIndexAt,
	overlayZoneAt,
	routeOverlayWheel,
} from "../../../src/modes/utils/overlay-pointer-zones"

describe("overlay-pointer-zones (CADILLAC wheel contract)", () => {
	const geom = {
		tableStart: 4,
		tableHit: 10,
		actionStart: 20,
		actionCount: 3,
	}

	it("zones by pointer row", () => {
		expect(overlayZoneAt(4, geom)).toBe("table")
		expect(overlayZoneAt(13, geom)).toBe("table")
		expect(overlayZoneAt(14, geom)).toBe("other")
		expect(overlayZoneAt(20, geom)).toBe("actions")
		expect(overlayZoneAt(22, geom)).toBe("actions")
		expect(overlayZoneAt(23, geom)).toBe("other")
	})

	it("wheel routes by zone not sticky focus", () => {
		const log: string[] = []
		routeOverlayWheel("actions", 1, {
			table: () => log.push("table"),
			actions: () => log.push("actions"),
		})
		routeOverlayWheel("table", -1, {
			table: () => log.push("table"),
			actions: () => log.push("actions"),
		})
		routeOverlayWheel("other", 1, {
			table: () => log.push("table"),
			actions: () => log.push("actions"),
		})
		expect(log).toEqual(["actions", "table", "table"])
	})

	it("table/action index helpers", () => {
		expect(overlayTableIndexAt(6, geom, 2, 50)).toBe(4) // scroll 2 + (6-4)
		expect(overlayTableIndexAt(3, geom, 0, 50)).toBe(null)
		expect(overlayActionIndexAt(21, geom)).toBe(1)
		expect(overlayActionIndexAt(19, geom)).toBe(null)
	})

	it("tableColEnd can exclude right pane", () => {
		const split = { ...geom, tableColEnd: 40 }
		expect(overlayZoneAt(5, split, 10)).toBe("table")
		expect(overlayZoneAt(5, split, 50)).toBe("other")
	})
})
