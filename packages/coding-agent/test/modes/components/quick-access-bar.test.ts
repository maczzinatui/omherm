/**
 * Top quick-access strip — footer-aesthetic, extensible registry.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { visibleWidth } from "@oh-my-pi/pi-tui";
import { QuickAccessBar } from "../../../src/modes/components/quick-access-bar";
import { initTheme } from "../../../src/modes/theme/theme";

function stripAnsi(s: string): string {
	return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("QuickAccessBar", () => {
	beforeAll(async () => {
		await initTheme(false);
	});

	it("renders empty when no buttons are registered", () => {
		const bar = new QuickAccessBar();
		expect(bar.render(80)).toEqual([]);
		expect(bar.contentWidth()).toBe(0);
	});

	it("paints a content-width statusLineBg slab (not full terminal)", () => {
		const bar = new QuickAccessBar();
		let activated = 0;
		bar.setButtons([{ id: "settings", label: "Settings", onActivate: () => activated++ }]);
		const lines = bar.render(80);
		expect(lines.length).toBe(1 + QuickAccessBar.TRAIL_ROWS);
		const raw = lines[0]!;
		const visible = stripAnsi(raw);
		expect(visible).toContain("〔Settings〕");
		// Footer black-box under chips only
		expect(raw).toMatch(/\x1b\[[0-9;]*48/);
		const slabW = bar.contentWidth();
		expect(slabW).toBeGreaterThan(0);
		expect(slabW).toBeLessThan(40); // far short of full 80
		// Line still spans width (plain tail), but slab is shorter
		expect(visibleWidth(raw)).toBe(80);
		expect(activated).toBe(0);
	});

	it("grows the bg slab when more buttons are added", () => {
		const bar = new QuickAccessBar();
		bar.setButtons([{ id: "settings", label: "Settings", onActivate: () => {} }]);
		bar.render(120);
		const one = bar.contentWidth();
		bar.setButtons([
			{ id: "settings", label: "Settings", onActivate: () => {} },
			{ id: "kanban", label: "Kanban", onActivate: () => {} },
			{ id: "sessions", label: "Sessions", onActivate: () => {} },
			{ id: "model", label: "Model", onActivate: () => {} },
		]);
		bar.render(120);
		const four = bar.contentWidth();
		expect(four).toBeGreaterThan(one);
	});

	it("uses distinct footer segment colors per chip (not uniform dim)", () => {
		const bar = new QuickAccessBar();
		bar.setButtons([
			{ id: "settings", label: "Settings", onActivate: () => {} },
			{ id: "kanban", label: "Kanban", onActivate: () => {} },
			{ id: "model", label: "Model", onActivate: () => {} },
		]);
		const raw = bar.render(120)[0]!;
		// Multiple distinct 38;2 (truecolor fg) or 38;5 sequences → not one flat color
		const fgs = raw.match(/\x1b\[[0-9;]*38[;:][0-9;:]+m/g) ?? [];
		expect(fgs.length).toBeGreaterThanOrEqual(3);
		// At least two different fg payloads among chips
		const uniq = new Set(fgs);
		expect(uniq.size).toBeGreaterThanOrEqual(2);
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
		// SLAB_PAD=1 then chip — col 3 lands in the label
		const clicked = bar.handleClick(3);
		expect(clicked).toBe("settings");
		expect(activated).toBe("settings");
		const after = bar.render(80)[0]!;
		expect(after).toBe(before);
	});

	it("returns undefined for clicks outside any chip", () => {
		const bar = new QuickAccessBar();
		let activated = 0;
		bar.setButtons([{ id: "settings", label: "Settings", onActivate: () => activated++ }]);
		bar.render(80);
		expect(bar.handleClick(70)).toBeUndefined();
		expect(activated).toBe(0);
	});

	it("handles motion hover via the SgrMouse dispatch helper", () => {
		const bar = new QuickAccessBar();
		bar.setButtons([{ id: "settings", label: "Settings", onActivate: () => {} }]);
		bar.render(80);
		const motion = { button: 35, col: 3, row: 0, release: false, wheel: null, motion: true, leftClick: false };
		expect(bar.handleMouse(motion)).toBe(true);
		const visible = stripAnsi(bar.render(80)[0]!);
		expect(visible).toContain("Settings");
		bar.clearHover();
		expect(stripAnsi(bar.render(80)[0]!)).toContain("Settings");
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
		const lines = bar.render(20);
		expect(lines.length).toBe(1 + QuickAccessBar.TRAIL_ROWS);
		const visible = stripAnsi(lines[0]!);
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
		const visible = stripAnsi(bar.render(120)[0]!);
		const found = new Set<string>();
		const firstCol: Record<string, number> = {};
		for (let col = 0; col < 80; col++) {
			const id = bar.hitTestAt(col);
			if (id && !found.has(id)) {
				found.add(id);
				firstCol[id] = col;
			}
		}
		expect([...found]).toEqual(["settings", "kanban", "sessions", "model"]);
		expect(bar.handleClick(firstCol.settings! + 4)).toBe("settings");
		expect(bar.handleClick(firstCol.kanban! + 3)).toBe("kanban");
		expect(bar.handleClick(firstCol.sessions! + 4)).toBe("sessions");
		expect(bar.handleClick(firstCol.model! + 3)).toBe("model");
		expect(hits).toEqual(["settings", "kanban", "sessions", "model"]);
		expect(visible).toMatch(/〕 〔/);
		expect(visible).not.toMatch(/〕 {2,}〔/);
	});
});
