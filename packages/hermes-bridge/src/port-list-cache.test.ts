import { describe, expect, it } from "bun:test"
import { createTtlCache } from "./port-list-cache.ts"

describe("createTtlCache", () => {
	it("hits within TTL and misses after", async () => {
		const c = createTtlCache<string>(30)
		c.set("a", "v")
		expect(c.get("a")).toBe("v")
		await Bun.sleep(40)
		expect(c.get("a")).toBeUndefined()
	})

	it("invalidate clears prefix", () => {
		const c = createTtlCache<number>(60_000)
		c.set("list:all", 1)
		c.set("list:hub", 2)
		c.set("other", 3)
		c.invalidate("list:")
		expect(c.get("list:all")).toBeUndefined()
		expect(c.get("other")).toBe(3)
		c.invalidate()
		expect(c.get("other")).toBeUndefined()
	})
})
