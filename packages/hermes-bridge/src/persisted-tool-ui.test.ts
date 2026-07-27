import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	isSafePersistedResultPath,
	loadPersistedToolOutputForUi,
	UI_EXPAND_MAX_BYTES,
} from "./persisted-tool-ui.ts";

describe("persisted-tool-ui", () => {
	test("rejects paths outside hermes-results", () => {
		expect(isSafePersistedResultPath("/etc/passwd")).toBe(false);
		expect(isSafePersistedResultPath("/tmp/evil.txt")).toBe(false);
		expect(isSafePersistedResultPath("/tmp/hermes-results/call_x.txt")).toBe(true);
	});

	test("loads and caps large files for UI expand", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-results-"));
		// isSafe requires /hermes-results/ segment — nest under tmp
		const hr = path.join(dir, "hermes-results");
		fs.mkdirSync(hr);
		const file = path.join(hr, "big.txt");
		const body = "line\n".repeat(5000);
		fs.writeFileSync(file, body);
		const loaded = loadPersistedToolOutputForUi(file, { maxBytes: 2000, maxLines: 50 });
		expect(loaded.error).toBeUndefined();
		expect(loaded.capped).toBe(true);
		expect(loaded.bytesRead).toBeLessThanOrEqual(2000);
		expect(loaded.text).toContain("UI expand capped");
		expect(loaded.text.length).toBeLessThan(body.length);
	});

	test("max bytes constant is finite and modest", () => {
		expect(UI_EXPAND_MAX_BYTES).toBeLessThanOrEqual(256 * 1024);
	});
});
