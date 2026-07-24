/**
 * Top quick-access strip — footer-aesthetic, extensible registry, single
 * Settings chip v1. Hit-test + render + registry mutation.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { QuickAccessBar } from "../../../src/modes/components/quick-access-bar";
import { initTheme } from "../../../src/modes/theme/theme";

describe("QuickAccessBar", () => {
	beforeAll(async () => {
		await initTheme(false);
	});

	it("renders empty when no buttons are registered", () => {
		const bar = new QuickAccessBar();
		expect(bar.render(80)).toEqual([]);
	});

	it("renders one dim chip with chevron brackets and a trailing spacer row", () => {
		const bar = new QuickAccessBar();
		let activated = 0;
		bar.setButtons([{ id: "settings", label: "Settings", onActivate: () => activated++ }]);
		const lines = bar.render(80);
		// One styled line + one empty spacer line.
		expect(lines.length).toBe(2);
		// Strip ANSI for visibility-check.
		const visible = lines[0]!.replace(/\x1b\[[0-9;]*m/g, "");
		expect(visible).toContain("Settings");
		expect(visible).toContain("〔"); // opening chevron
		expect(visible).toContain("〕"); // closing chevron
		expect(lines[1]).toBe(""); // trailing spacer
		expect(activated).toBe(0);
	});

	it("activates the chip on left-click inside its column range", () => {
		const bar = new QuickAccessBar();
		let activated: string | undefined;
		bar.setButtons([
			{
				id: "settings",
				label: "Settings",
				onActivate: () => {
					activated = "settings";
				},
			},
		]);
		const before = bar.render(80)[0]!;
		// Find the first non-bracket position to land a clean click on
		// the chip label. Visible width of "〔 Settings 〕" = 12 cols.
		const clicked = bar.handleClick(3);
		expect(clicked).toBe("settings");
		expect(activated).toBe("settings");
		// Render again to confirm hover is still null (click does not
		// leave a sticky accent on the chip — the overlay opens instead).
		const after = bar.render(80)[0]!;
		expect(after).toBe(before);
	});

	it("returns undefined for clicks outside any chip", () => {
		const bar = new QuickAccessBar();
		let activated = 0;
		bar.setButtons([{ id: "settings", label: "Settings", onActivate: () => activated++ }]);
		// Far right of the terminal — past the chip.
		expect(bar.handleClick(70)).toBeUndefined();
		expect(activated).toBe(0);
	});

	it("handles motion hover via the SgrMouse dispatch helper", () => {
		const bar = new QuickAccessBar();
		bar.setButtons([{ id: "settings", label: "Settings", onActivate: () => {} }]);
		// Motion event over col 3 → hit the chip → consumed.
		const motion = { button: 35, col: 3, row: 0, release: false, wheel: null, motion: true, leftClick: false };
		expect(bar.handleMouse(motion)).toBe(true);
		// Render now paints the hovered chip in accent.
		const visible = bar.render(80)[0]!.replace(/\x1b\[[0-9;]*m/g, "");
		expect(visible).toContain("Settings");
		// clearHover resets accent.
		bar.clearHover();
		const cleared = bar.render(80)[0]!.replace(/\x1b\[[0-9;]*m/g, "");
		expect(cleared).toContain("Settings");
	});

	it("swallows wheel events so they do not reach the chat", () => {
		const bar = new QuickAccessBar();
		bar.setButtons([{ id: "settings", label: "Settings", onActivate: () => {} }]);
		const wheel = { button: 64, col: 0, row: 0, release: false, wheel: -1 as const, motion: false, leftClick: false };
		expect(bar.handleMouse(wheel)).toBe(true);
	});

	it("truncates when the registry overflows the available width", () => {
		const bar = new QuickAccessBar();
		bar.setButtons([
			{ id: "a", label: "Tasks", onActivate: () => {} },
			{ id: "b", label: "Tools", onActivate: () => {} },
			{ id: "c", label: "Profiles", onActivate: () => {} },
		]);
		// Narrow width — only the first chip should fit. Render is
		// defensive: visible width <= requested width.
		const lines = bar.render(20);
		expect(lines.length).toBe(2);
		const visible = lines[0]!.replace(/\x1b\[[0-9;]*m/g, "");
		expect(visible).toContain("Tasks");
		expect(visible).not.toContain("Profiles");
	});

	it("upsertButton replaces by id; removeButton drops by id", () => {
		const bar = new QuickAccessBar();
		let calls = 0;
		bar.upsertButton({ id: "settings", label: "Settings", onActivate: () => calls++ });
		bar.upsertButton({ id: "settings", label: "Settings ⚙", onActivate: () => calls++ });
		expect(bar.getButtons().length).toBe(1);
		expect(bar.getButtons()[0]!.label).toBe("Settings ⚙");
		bar.upsertButton({ id: "tasks", label: "Tasks", onActivate: () => {} });
		expect(bar.getButtons().length).toBe(2);
		bar.removeButton("settings");
		expect(bar.getButtons().length).toBe(1);
		expect(bar.getButtons()[0]!.id).toBe("tasks");
	});

	it("activates the correct chip among several by column", () => {
		const bar = new QuickAccessBar();
		const hits: string[] = [];
		bar.setButtons([
			{ id: "settings", label: "Settings", onActivate: () => hits.push("settings") },
			{ id: "kanban", label: "Kanban", onActivate: () => hits.push("kanban") },
			{ id: "sessions", label: "Sessions", onActivate: () => hits.push("sessions") },
			{ id: "model", label: "Model", onActivate: () => hits.push("model") },
		]);
		const visible = bar.render(120)[0]!.replace(/\x1b\[[0-9;]*m/g, "");
		const settingsAt = visible.indexOf("Settings");
		const kanbanAt = visible.indexOf("Kanban");
		const sessionsAt = visible.indexOf("Sessions");
		const modelAt = visible.indexOf("Model");
		expect(settingsAt).toBeGreaterThanOrEqual(0);
		expect(kanbanAt).toBeGreaterThan(settingsAt);
		expect(sessionsAt).toBeGreaterThan(kanbanAt);
		expect(modelAt).toBeGreaterThan(sessionsAt);
		expect(bar.handleClick(settingsAt + 1)).toBe("settings");
		expect(bar.handleClick(kanbanAt + 1)).toBe("kanban");
		expect(bar.handleClick(sessionsAt + 1)).toBe("sessions");
		expect(bar.handleClick(modelAt + 1)).toBe("model");
		expect(hits).toEqual(["settings", "kanban", "sessions", "model"]);
	});
});
