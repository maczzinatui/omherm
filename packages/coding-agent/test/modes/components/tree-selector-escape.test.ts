/**
 * Regression: Esc must leave the session tree. Dogfood: double-Esc into tree,
 * Esc×2 could not exit (search clear vs cancel + focus slip).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "bun:test";
import { KeybindingsManager } from "@oh-my-pi/pi-coding-agent/config/keybindings";
import { TreeSelectorComponent } from "@oh-my-pi/pi-coding-agent/modes/components/tree-selector";
import { initTheme } from "@oh-my-pi/pi-coding-agent/modes/theme/theme";
import type { SessionTreeNode } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { setKeybindings } from "@oh-my-pi/pi-tui";

beforeAll(async () => {
	await initTheme();
});

afterEach(() => {
	setKeybindings(KeybindingsManager.inMemory());
	vi.restoreAllMocks();
});

function leaf(id: string, text: string): SessionTreeNode {
	return {
		entry: {
			id,
			type: "message",
			parentId: null,
			timestamp: Date.now(),
			message: {
				role: "user",
				content: text,
				timestamp: Date.now(),
			},
		},
		children: [],
	} as unknown as SessionTreeNode;
}

describe("TreeSelectorComponent escape", () => {
	it("cancels on Escape when search is empty (app.interrupt)", () => {
		const onCancel = vi.fn();
		const tree = new TreeSelectorComponent([leaf("a", "hello")], "a", 40, () => {}, onCancel);
		tree.handleInput("\x1b");
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("clears search on first Escape, cancels on second", () => {
		const onCancel = vi.fn();
		const tree = new TreeSelectorComponent([leaf("a", "hello")], "a", 40, () => {}, onCancel);
		tree.handleInput("x");
		tree.handleInput("\x1b");
		expect(onCancel).not.toHaveBeenCalled();
		tree.handleInput("\x1b");
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("cancels on tui.select.cancel remap", () => {
		setKeybindings(
			KeybindingsManager.inMemory({
				"tui.select.cancel": "ctrl+g",
				"app.interrupt": "alt+x",
			}),
		);
		const onCancel = vi.fn();
		const tree = new TreeSelectorComponent([leaf("a", "hello")], "a", 40, () => {}, onCancel);
		// bare Escape is neither interrupt nor select.cancel under this remap
		tree.handleInput("\x1b");
		expect(onCancel).not.toHaveBeenCalled();
		// ctrl+g is select.cancel
		tree.handleInput("\x07");
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("cancels on q", () => {
		const onCancel = vi.fn();
		const tree = new TreeSelectorComponent([leaf("a", "hello")], "a", 40, () => {}, onCancel);
		tree.handleInput("q");
		expect(onCancel).toHaveBeenCalledTimes(1);
	});
});
