import { describe, expect, test } from "bun:test";
import {
	auditAllSettings,
	classifySettingPath,
	getProductPathsForTab,
	getProductSettingTabs,
	isHermesProductSettings,
	isProductVisiblePath,
} from "../src/config/settings-product-manifest.ts";
import { SETTINGS_SCHEMA } from "../src/config/settings-schema.ts";

describe("settings-product-manifest", () => {
	test("purge known OMP lies", () => {
		expect(classifySettingPath("mnemopi.dbPath").class).toBe("purge");
		expect(classifySettingPath("hindsight.apiUrl").class).toBe("purge");
		expect(classifySettingPath("collab.relayUrl").class).toBe("purge");
		expect(classifySettingPath("task.maxConcurrency").class).toBe("purge");
		expect(classifySettingPath("ttsr.enabled").class).toBe("purge");
		expect(classifySettingPath("snapcompact.systemPrompt").class).toBe("purge");
		expect(classifySettingPath("edit.mode").class).toBe("purge");
		expect(classifySettingPath("lsp.enabled").class).toBe("purge");
		expect(classifySettingPath("grep.enabled").class).toBe("purge");
		expect(classifySettingPath("compaction.enabled").class).toBe("purge");
		expect(classifySettingPath("temperature").class).toBe("purge");
		expect(isProductVisiblePath("mnemopi.dbPath")).toBe(false);
	});

	test("coat chrome stays visible", () => {
		expect(classifySettingPath("theme.dark").class).toBe("coat");
		expect(classifySettingPath("statusLine.preset").class).toBe("coat");
		expect(classifySettingPath("display.smoothStreaming").class).toBe("coat");
		expect(classifySettingPath("startup.showSplash").class).toBe("coat");
		expect(isProductVisiblePath("theme.dark")).toBe(true);
	});

	test("product mode hides purge from tabs", () => {
		const prev = process.env.MESHINA_TUI_BRAND;
		const prevO = process.env.OMHERM_BRAND;
		const prevPs = process.env.MESHINA_TUI_PRODUCT_SETTINGS;
		const prevRaw = process.env.MESHINA_TUI_RAW_OMP_SETTINGS;
		process.env.OMHERM_BRAND = "omherm";
		process.env.MESHINA_TUI_BRAND = "omherm";
		process.env.MESHINA_TUI_PRODUCT_SETTINGS = "1";
		delete process.env.MESHINA_TUI_RAW_OMP_SETTINGS;
		delete process.env.OMHERM_RAW_OMP_SETTINGS;
		try {
			expect(isHermesProductSettings()).toBe(true);
			const mem = getProductPathsForTab("memory");
			expect(mem.every((p) => !String(p).startsWith("mnemopi."))).toBe(true);
			expect(mem.every((p) => !String(p).startsWith("hindsight."))).toBe(true);
			const files = getProductPathsForTab("files");
			expect(files.length).toBe(0);
			const tabs = getProductSettingTabs();
			expect(tabs).toContain("appearance");
			expect(tabs).not.toContain("files");
		} finally {
			if (prev === undefined) delete process.env.MESHINA_TUI_BRAND;
			else process.env.MESHINA_TUI_BRAND = prev;
			if (prevO === undefined) delete process.env.OMHERM_BRAND;
			else process.env.OMHERM_BRAND = prevO;
			if (prevPs === undefined) delete process.env.MESHINA_TUI_PRODUCT_SETTINGS;
			else process.env.MESHINA_TUI_PRODUCT_SETTINGS = prevPs;
			if (prevRaw === undefined) delete process.env.MESHINA_TUI_RAW_OMP_SETTINGS;
			else process.env.MESHINA_TUI_RAW_OMP_SETTINGS = prevRaw;
		}
	});

	test("audit covers full schema", () => {
		const a = auditAllSettings();
		expect(a.total).toBe(Object.keys(SETTINGS_SCHEMA).length);
		expect(a.byClass.purge).toBeGreaterThan(100);
		expect(a.byClass.coat).toBeGreaterThan(10);
		// Nothing required: hermes allowlist grows in P1
	});

	test("raw omp escape hatch", () => {
		process.env.MESHINA_TUI_RAW_OMP_SETTINGS = "1";
		process.env.OMHERM_BRAND = "omherm";
		process.env.MESHINA_TUI_BRAND = "omherm";
		try {
			expect(isHermesProductSettings()).toBe(false);
		} finally {
			delete process.env.MESHINA_TUI_RAW_OMP_SETTINGS;
		}
	});
});
