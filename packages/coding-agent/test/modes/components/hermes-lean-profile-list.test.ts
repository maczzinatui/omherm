import { beforeAll, describe, expect, it, mock } from "bun:test"
import { initTheme } from "../../../src/modes/theme/theme"

function fakeTui() {
	return {
		requestRender: () => {},
		requestComponentRender: () => {},
		enableScopedInputRender: () => {},
	}
}

function stripAnsi(s: string): string {
	return s.replace(/\x1b\[[0-9;]*m/g, "")
}

describe("HermesLeanProfileListComponent library chrome", () => {
	beforeAll(async () => {
		await initTheme(false)
	})

	it("library render does not throw Unknown theme background color: selected", async () => {
		mock.module("@omherm/hermes-bridge", () => ({
			createLeanProfilePort: () => ({
				get: async () => ({
					active: "l1-head",
					profiles: {
						"l0-arm": {
							description: "arm",
							toolsets: ["file"],
							skills: false,
							memory: false,
						},
						"l1-head": {
							description: "head",
							toolsets: ["file", "terminal"],
							skills: true,
							memory: true,
						},
						"l1-worker": {
							description: "worker",
							toolsets: ["file"],
							skills: true,
							memory: false,
						},
					},
					on_demand: true,
					on_demand_scope: "library",
				}),
				set: async () => ({ active: "l1-head", profiles: {} }),
				listNames: async () => ["l0-arm", "l1-head", "l1-worker"],
			}),
			createLibraryPort: () => ({
				tools: async () => ({
					count: 41,
					path: "/home/nixos/.hermes/library/tools-catalog.json",
					tools: [{ name: "x" }],
				}),
				skills: async () => ({
					count: 80,
					path: "/home/nixos/.hermes/library/skills-catalog.json",
					skills: [{ name: "y" }],
				}),
				refresh: async () => ({
					tools_path: "/t",
					skills_path: "/s",
					ok: true,
				}),
			}),
		}))

		const { HermesLeanProfileListComponent } = await import(
			"../../../src/modes/components/hermes-lean-profile-list"
		)
		const panel = new HermesLeanProfileListComponent(fakeTui() as never, "library", () => {})
		await new Promise((r) => setTimeout(r, 50))

		let lines: string[] = []
		expect(() => {
			lines = panel.render(80)
		}).not.toThrow()
		expect(lines.length).toBeGreaterThan(3)
		const joined = stripAnsi(lines.join("\n"))
		expect(joined).toContain("tools-catalog")
		expect(joined).toContain("skills-catalog")
		expect(joined).not.toContain("Unknown theme background color")
		expect(joined).not.toContain("Lean chrome error")
	})

	it("lean-profile wheel scroll moves selection (SgrMouseEvent.wheel)", async () => {
		const { HermesLeanProfileListComponent } = await import(
			"../../../src/modes/components/hermes-lean-profile-list"
		)
		const panel = new HermesLeanProfileListComponent(fakeTui() as never, "lean-profile", () => {})
		await new Promise((r) => setTimeout(r, 60))

		// First paint — active profile may already be selected (l1-head)
		const before = stripAnsi(panel.render(100).join("\n"))
		expect(before).toMatch(/l0-arm|l1-head|l1-worker/)

		// wheel down several times so selection leaves first row
		for (let i = 0; i < 3; i++) {
			expect(() => panel.handleInput("\x1b[<65;5;10M")).not.toThrow()
		}
		const after = stripAnsi(panel.render(100).join("\n"))
		// selected/active marker should appear on some profile line
		expect(after.includes("›") || after.includes("●")).toBe(true)
		// mouse must not throw / leave error chrome
		expect(after).not.toContain("Lean chrome error")
	})

	it("lean-profile leftClick does not throw (finger-tap path)", async () => {
		const { HermesLeanProfileListComponent } = await import(
			"../../../src/modes/components/hermes-lean-profile-list"
		)
		const panel = new HermesLeanProfileListComponent(fakeTui() as never, "lean-profile", () => {})
		await new Promise((r) => setTimeout(r, 50))
		panel.render(100) // establish tableStart rows
		// left press near table region
		expect(() => panel.handleInput("\x1b[<0;5;8M")).not.toThrow()
		expect(() => panel.handleInput("\x1b[<0;5;8m")).not.toThrow() // release
	})
})
