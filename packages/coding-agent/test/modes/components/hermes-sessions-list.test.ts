import { beforeAll, describe, expect, it } from "bun:test"
import { HermesSessionsListComponent } from "../../../src/modes/components/hermes-sessions-list"
import { initTheme } from "../../../src/modes/theme/theme"

/** Minimal TUI stub for overlay paint paths. */
function fakeTui() {
	const paints: string[] = []
	return {
		paints,
		requestRender: () => {
			paints.push("full")
		},
		requestComponentRender: () => {
			paints.push("local")
		},
		enableScopedInputRender: () => {},
	}
}

describe("HermesSessionsListComponent mouse routing", () => {
	beforeAll(async () => {
		await initTheme(false)
	})

	it("SGR mouse does not throw handler is not a function", async () => {
		const tui = fakeTui()
		const rows = [
			{
				id: "abc123",
				title: "test session",
				preview: "hi",
				started_at: Date.now() / 1000,
				message_count: 3,
				source: "tui",
			},
		]
		const panel = new HermesSessionsListComponent(tui as never, () => {}, {
			brain: {
				listSessions: async () => rows,
				resumeSession: async (id) => ({ session_id: id, messages: [] }),
				sessionId: null,
			},
		})
		// wait reload
		await new Promise((r) => setTimeout(r, 30))

		// Wheel-up SGR (button 64 = wheel up) — previously crashed:
		// routeSgrMouseInput(data) without handler → TypeError: handler is not a function
		const wheelUp = "\x1b[<64;10;5M"
		expect(() => panel.handleInput(wheelUp)).not.toThrow()

		const motion = "\x1b[<32;10;5M"
		expect(() => panel.handleInput(motion)).not.toThrow()

		const leftDown = "\x1b[<0;10;5M"
		expect(() => panel.handleInput(leftDown)).not.toThrow()
	})

	it("keyboard nav still works after mouse fix", async () => {
		const tui = fakeTui()
		const panel = new HermesSessionsListComponent(tui as never, () => {}, {
			brain: {
				listSessions: async () => [
					{
						id: "a",
						title: "one",
						preview: "",
						started_at: 1,
						message_count: 1,
						source: "tui",
					},
					{
						id: "b",
						title: "two",
						preview: "",
						started_at: 2,
						message_count: 2,
						source: "tui",
					},
				],
				resumeSession: async (id) => ({ session_id: id }),
				sessionId: null,
			},
		})
		await new Promise((r) => setTimeout(r, 30))
		expect(() => panel.handleInput("j")).not.toThrow()
		const out = panel.render(80)
		const plain = out.join("\n").replace(/\x1b\[[0-9;]*m/g, "")
		// title may clip on narrow paint; source note is stable
		expect(plain).toMatch(/Hermes gateway|resume|one|two/)
	})

	it("row layout keeps id visible and does not hollow-pad short titles", async () => {
		const tui = fakeTui()
		const longId = "20260724_120233_0bd183"
		const panel = new HermesSessionsListComponent(tui as never, () => {}, {
			brain: {
				listSessions: async () => [
					{
						id: longId,
						title: "Hi",
						preview: "preview text that should appear when wide enough",
						started_at: Date.now() / 1000,
						message_count: 42,
						source: "tui",
					},
				],
				resumeSession: async (id) => ({ session_id: id }),
				sessionId: null,
			},
		})
		await new Promise((r) => setTimeout(r, 30))
		const wide = panel.render(120)
		const plain = wide.join("\n").replace(/\x1b\[[0-9;]*m/g, "")
		// id prefix survives on the right (may be truncated with …)
		expect(plain).toMatch(/20260724/)
		expect(plain).toMatch(/Hi/)
		// Short title must not be followed by a giant run of spaces before id
		// (old fit(title, w-42) pathology). Allow modest padding only.
		const dataLine = plain
			.split("\n")
			.find((l) => l.includes("Hi") && l.includes("20260724"))
		expect(dataLine).toBeTruthy()
		expect(dataLine!).not.toMatch(/Hi\s{30,}/)
		// top border title present
		expect(plain).toMatch(/Sessions/)
	})
})
