import { beforeAll, describe, expect, it } from "bun:test"
import { HermesInventoryListComponent } from "../../../src/modes/components/hermes-inventory-list"
import { initTheme } from "../../../src/modes/theme/theme"

function fakeTui() {
	return {
		requestRender: () => {},
		requestComponentRender: () => {},
		enableScopedInputRender: () => {},
	}
}

describe("HermesInventoryListComponent mouse routing", () => {
	beforeAll(async () => {
		await initTheme(false)
	})

	it("SGR mouse does not throw handler is not a function (tools)", async () => {
		const panel = new HermesInventoryListComponent(fakeTui() as never, "tools", () => {})
		await new Promise((r) => setTimeout(r, 40))

		// Real SgrMouseEvent shape (motion / wheel / leftClick) — not kind/button strings
		expect(() => panel.handleInput("\x1b[<64;10;5M")).not.toThrow() // wheel up
		expect(() => panel.handleInput("\x1b[<65;10;5M")).not.toThrow() // wheel down
		expect(() => panel.handleInput("\x1b[<32;10;5M")).not.toThrow() // motion
		expect(() => panel.handleInput("\x1b[<0;10;5M")).not.toThrow() // left press
	})

	it("SGR mouse does not throw (skills)", async () => {
		const panel = new HermesInventoryListComponent(fakeTui() as never, "skills", () => {})
		await new Promise((r) => setTimeout(r, 40))
		expect(() => panel.handleInput("\x1b[<64;10;5M")).not.toThrow()
		expect(() => panel.handleInput("\x1b[<65;10;5M")).not.toThrow()
		expect(() => panel.handleInput("\x1b[<0;10;8M")).not.toThrow()
	})
})
