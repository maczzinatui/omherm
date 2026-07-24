/**
 * Hermes-native setting defs injected into OMP settings tabs on product path.
 * Values read/write via @omherm/hermes-bridge HermesConfigPort — not OMP settings store.
 * Placement: hermes-omp-settings-map.ts (Herm groups → OMP tab/group names).
 */
import {
	HERMES_CONFIG_FIELDS,
	hermesConfigPort,
	type HermesConfigField,
} from "@omherm/hermes-bridge";
import type { SettingPath, SettingTab } from "../../config/settings-schema";
import type { SettingDef } from "./settings-defs";

/** Synthetic action row — opens OMP ModelHub from Settings → Model */
export const HERMES_OPEN_MODEL_HUB_PATH = "hermes:action.open_model_hub" as SettingPath;
export const HERMES_OPEN_KANBAN_PATH = "hermes:action.open_kanban" as SettingPath;
export const HERMES_OPEN_CRON_PATH = "hermes:action.open_cron" as SettingPath;
export const HERMES_OPEN_PROFILES_PATH = "hermes:action.open_profiles" as SettingPath;
export const HERMES_OPEN_SKILLS_PATH = "hermes:action.open_skills" as SettingPath;
export const HERMES_OPEN_TOOLS_PATH = "hermes:action.open_tools" as SettingPath;
export const HERMES_OPEN_MEMORY_PATH = "hermes:action.open_memory" as SettingPath;
export const HERMES_OPEN_SUBAGENTS_PATH = "hermes:action.open_subagents" as SettingPath;
export const HERMES_OPEN_SESSIONS_PATH = "hermes:action.open_sessions" as SettingPath;

export type HermesPortAction =
	| "kanban"
	| "cron"
	| "profiles"
	| "skills"
	| "tools"
	| "memory"
	| "subagents"
	| "sessions"
	| "model_hub";

export function hermesPortActionFromPath(path: string): HermesPortAction | null {
	if (path === HERMES_OPEN_MODEL_HUB_PATH) return "model_hub";
	if (path === HERMES_OPEN_KANBAN_PATH) return "kanban";
	if (path === HERMES_OPEN_CRON_PATH) return "cron";
	if (path === HERMES_OPEN_PROFILES_PATH) return "profiles";
	if (path === HERMES_OPEN_SKILLS_PATH) return "skills";
	if (path === HERMES_OPEN_TOOLS_PATH) return "tools";
	if (path === HERMES_OPEN_MEMORY_PATH) return "memory";
	if (path === HERMES_OPEN_SUBAGENTS_PATH) return "subagents";
	if (path === HERMES_OPEN_SESSIONS_PATH) return "sessions";
	return null;
}

export function isHermesSettingsPath(path: string): boolean {
	if (hermesPortActionFromPath(path)) return true;
	return path.startsWith("hermes:") || hermesConfigPort().isHermesKey(path.replace(/^hermes:/, ""));
}

export function isHermesActionPath(path: string): boolean {
	return path.startsWith("hermes:action.");
}

/** Stable UI id: hermes:<config.key> */
export function hermesUiPath(key: string): string {
	return key.startsWith("hermes:") ? key : `hermes:${key}`;
}

export function hermesConfigKeyFromUiPath(path: string): string {
	return path.startsWith("hermes:") ? path.slice("hermes:".length) : path;
}

function fieldToDef(f: HermesConfigField): SettingDef {
	const path = hermesUiPath(f.key) as SettingPath;
	const base = {
		path,
		label: f.label,
		description: `${f.description} · effect:${f.effect}`,
		tab: f.tab as SettingTab,
		group: f.group,
	};
	if (f.type === "boolean") {
		return { ...base, type: "boolean" };
	}
	if (f.type === "enum" && f.values) {
		return { ...base, type: "enum", values: f.values };
	}
	return { ...base, type: "text", secret: false };
}

function modelHubLauncherDef(): SettingDef {
	return {
		path: HERMES_OPEN_MODEL_HUB_PATH,
		label: "Open model selector…",
		description:
			"OMP model hub (providers · models · default role). Assigning default also updates Hermes config.",
		tab: "model",
		group: "Model picker",
		type: "enum",
		values: ["open"],
	};
}

function portLauncherDefs(): SettingDef[] {
	return [
		{
			path: HERMES_OPEN_KANBAN_PATH,
			label: "Open Kanban board…",
			description: "Hermes kanban via KanbanPort (CLI). Settings hub — not a top tab bar.",
			tab: "tasks",
			group: "Kanban",
			type: "enum",
			values: ["open"],
		},
		{
			path: HERMES_OPEN_CRON_PATH,
			label: "Open Cron jobs…",
			description: "Hermes cron via CronPort (CLI / cron.manage later).",
			tab: "tasks",
			group: "Cron",
			type: "enum",
			values: ["open"],
		},
		{
			path: HERMES_OPEN_PROFILES_PATH,
			label: "Open Profiles…",
			description: "Hermes profiles via ProfilePort (FS + hermes profile CLI).",
			tab: "tasks",
			group: "Profiles",
			type: "enum",
			values: ["open"],
		},
		{
			path: HERMES_OPEN_SKILLS_PATH,
			label: "Open Skills…",
			description: "Installed skills via SkillsPort (enable/disable/inspect).",
			tab: "tasks",
			group: "Commands & Skills",
			type: "enum",
			values: ["open"],
		},
		{
			path: HERMES_OPEN_TOOLS_PATH,
			label: "Open Tools…",
			description: "Built-in toolsets + MCP servers via ToolsPort.",
			tab: "tasks",
			group: "Commands & Skills",
			type: "enum",
			values: ["open"],
		},
		{
			path: HERMES_OPEN_MEMORY_PATH,
			label: "Open Memory…",
			description: "USER.md / MEMORY.md viewer + memory status.",
			tab: "tasks",
			group: "Profiles",
			type: "enum",
			values: ["open"],
		},
		{
			path: HERMES_OPEN_SUBAGENTS_PATH,
			label: "Open Subagent trail…",
			description: "Live subagent.* / browser.progress trail for this session.",
			tab: "tasks",
			group: "Subagents",
			type: "enum",
			values: ["open"],
		},
		{
			path: HERMES_OPEN_SESSIONS_PATH,
			label: "Open Sessions…",
			description:
				"Hermes session store (gateway session.list / resume). Same surface as Herm’s Sessions tab — not OMP coat files.",
			tab: "tasks",
			group: "Sessions",
			type: "enum",
			values: ["open"],
		},
	];
}

export function getHermesSettingDefsForTab(tab: SettingTab): SettingDef[] {
	const defs = HERMES_CONFIG_FIELDS.filter((f) => f.tab === tab).map(fieldToDef);
	if (tab === "model") {
		return [modelHubLauncherDef(), ...defs];
	}
	if (tab === "tasks") {
		return [...portLauncherDefs(), ...defs];
	}
	return defs;
}

export function getHermesCurrentValue(uiPath: string): unknown {
	if (hermesPortActionFromPath(uiPath)) return "open";
	const key = hermesConfigKeyFromUiPath(uiPath);
	const port = hermesConfigPort();
	const field = HERMES_CONFIG_FIELDS.find((f) => f.key === key);
	const v = port.getCached(key);
	if (v !== undefined) return v;
	return field?.fallback;
}

export function getHermesDefaultValue(uiPath: string): unknown {
	if (hermesPortActionFromPath(uiPath)) return "open";
	const key = hermesConfigKeyFromUiPath(uiPath);
	return HERMES_CONFIG_FIELDS.find((f) => f.key === key)?.fallback;
}

export async function refreshHermesSettingsCache(): Promise<void> {
	await hermesConfigPort().refresh();
}

export async function setHermesSetting(uiPath: string, value: unknown): Promise<void> {
	if (isHermesActionPath(uiPath)) {
		// Actions handled by settings UI callback — no config write
		return;
	}
	const key = hermesConfigKeyFromUiPath(uiPath);
	const field = HERMES_CONFIG_FIELDS.find((f) => f.key === key);
	if (!field) throw new Error(`unknown hermes setting ${key}`);
	let v = value;
	if (field.type === "boolean") {
		v = value === true || value === "true";
	} else if (field.type === "number") {
		const n = typeof value === "number" ? value : Number(value);
		if (!Number.isFinite(n)) throw new Error(`expected number for ${key}`);
		v = n;
	} else if (field.type === "enum") {
		v = String(value);
	} else {
		v = value == null ? "" : String(value);
	}
	await hermesConfigPort().set(key, v);
}

export { HERMES_CONFIG_FIELDS };
