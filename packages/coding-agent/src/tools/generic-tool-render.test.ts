import { beforeAll, describe, expect, test } from "bun:test";
import { genericToolRenderer, humanizeToolName } from "./generic-tool-render";
import { resolveToolRenderer } from "./renderers";
import { getThemeByName, setThemeInstance, theme } from "../modes/theme/theme";

describe("humanizeToolName", () => {
	test("snake and mcp names", () => {
		expect(humanizeToolName("skill_view")).toBe("Skill View");
		expect(humanizeToolName("delegate_task")).toBe("Delegate Task");
		expect(humanizeToolName("mcp__sovereign_mesh_hub__job_get")).toContain("Job Get");
	});
});

describe("genericToolRenderer", () => {
	beforeAll(async () => {
		const loaded = await getThemeByName("dark");
		if (!loaded) throw new Error("theme unavailable");
		setThemeInstance(loaded);
	});

	test("resolveToolRenderer falls back to generic", () => {
		expect(resolveToolRenderer("skill_view")).toBe(genericToolRenderer as never);
		expect(resolveToolRenderer("terminal")).not.toBe(genericToolRenderer as never);
	});

	test("renderResult produces framed lines", () => {
		const comp = genericToolRenderer.renderResult(
			{
				content: [{ type: "text", text: "loaded skill hermes-agent" }],
				isError: false,
			},
			{ expanded: false, isPartial: false },
			theme,
			{ name: "hermes-agent", __toolName: "skill_view" },
		);
		expect(comp).toBeTruthy();
		const lines = comp.render(80);
		expect(lines.length).toBeGreaterThan(2);
		const joined = lines.join("\n");
		expect(joined.toLowerCase()).toMatch(/skill|output|loaded/i);
	});
});
