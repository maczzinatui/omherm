/**
 * omherm product settings policy — OMP schema is not Hermes.
 * See docs/SETTINGS_REMAP.md (Cadillac).
 *
 * Product path (default omherm): only COAT + allowlisted BRIDGE rows appear.
 * PURGE never appears. HERMES rows appear only when allowlisted (backed soon
 * via HermesConfigPort); unmapped Hermes-relevant OMP keys stay hidden until mapped.
 */
import {
	getUi,
	SETTING_TABS,
	SETTINGS_SCHEMA,
	type SettingPath,
	type SettingTab,
} from "./settings-schema.ts";

export type SettingClass = "coat" | "hermes" | "port" | "purge" | "bridge" | "unmapped";

export type SettingVerdict = {
	path: string;
	class: SettingClass;
	reason: string;
	tab?: SettingTab;
	group?: string;
};

/** omherm product settings ON unless raw OMP schema forced. Dual-reads OMHERM_* and legacy MESHINA_TUI_*. */
export function isHermesProductSettings(): boolean {
	const raw =
		process.env.OMHERM_RAW_OMP_SETTINGS === "1" || process.env.MESHINA_TUI_RAW_OMP_SETTINGS === "1";
	if (raw) return false;
	if (process.env.OMHERM_PRODUCT_SETTINGS === "0" || process.env.MESHINA_TUI_PRODUCT_SETTINGS === "0") {
		return false;
	}
	const brand = (process.env.OMHERM_BRAND || process.env.MESHINA_TUI_BRAND || "").toLowerCase();
	const productOn =
		process.env.OMHERM_PRODUCT_SETTINGS === "1" || process.env.MESHINA_TUI_PRODUCT_SETTINGS === "1";
	return brand === "omherm" || brand === "hermes" || brand === "1" || productOn;
}

type Rule = { re: RegExp; cls: SettingClass; reason: string };

/** First match wins. Order: purge → coat → hermes allow → bridge allow → default unmapped(hidden). */
const PATH_RULES: Rule[] = [
	// --- hard purge: OMP agent / foreign products ---
	{ re: /^mnemopi\./, cls: "purge", reason: "OMP mnemopi memory — not Hermes memory" },
	{ re: /^hindsight\./, cls: "purge", reason: "OMP hindsight — not Hermes memory" },
	{ re: /^memory\.backend$/, cls: "purge", reason: "OMP memory backend switch" },
	{ re: /^autolearn\./, cls: "purge", reason: "OMP autolearn" },
	{ re: /^providers\.memoryModel$/, cls: "purge", reason: "OMP memory model" },
	{ re: /^collab\./, cls: "purge", reason: "OMP collab relay" },
	{ re: /^share\./, cls: "purge", reason: "OMP share server" },
	{ re: /^ttsr\./, cls: "purge", reason: "OMP TTSR rules engine" },
	{ re: /^snapcompact\./, cls: "purge", reason: "OMP snapcompact — not Hermes compression" },
	{ re: /^prewalk\./, cls: "purge", reason: "OMP prewalk" },
	{ re: /^advisor\./, cls: "purge", reason: "OMP advisor — use Hermes/mesh advisor" },
	{ re: /^task\./, cls: "purge", reason: "OMP task/subagent engine — use Hermes delegation" },
	{ re: /^worktree\./, cls: "purge", reason: "OMP worktree isolation — Orca/exterior" },
	{ re: /^plan\./, cls: "purge", reason: "OMP plan mode — Hermes /goal separately" },
	{ re: /^goal\./, cls: "purge", reason: "OMP goal chrome — Hermes goal-plan" },
	{ re: /^title\.refreshOnReplan$/, cls: "purge", reason: "OMP replan title" },
	{ re: /^commands\.enable/, cls: "purge", reason: "Claude/opencode command packs — not Hermes skills" },
	{ re: /^skills\.enableSkillCommands$/, cls: "purge", reason: "OMP skill commands bridge" },
	{ re: /^magicKeywords\./, cls: "purge", reason: "OMP magic keywords" },
	{ re: /^marketplace\./, cls: "purge", reason: "OMP marketplace updates" },
	{ re: /^codexResets\./, cls: "purge", reason: "Codex credits — not Hermes" },
	{ re: /^providers\.fireworks/, cls: "purge", reason: "Fireworks OMP tier" },
	{ re: /^providers\.tinyModel/, cls: "purge", reason: "OMP tiny model" },
	{ re: /^providers\.unexpectedStopModel$/, cls: "purge", reason: "OMP unexpected stop model" },
	{ re: /^providers\.antigravity/, cls: "purge", reason: "OMP antigravity" },
	{ re: /^providers\.kimiApiFormat$/, cls: "purge", reason: "OMP provider quirk" },
	{ re: /^providers\.openaiWebsockets$/, cls: "purge", reason: "OMP provider quirk" },
	{ re: /^providers\.openrouterVariant$/, cls: "purge", reason: "OMP openrouter variant" },
	{ re: /^provider\.appendOnlyContext$/, cls: "purge", reason: "OMP append-only context mode" },
	{ re: /^exa\./, cls: "purge", reason: "OMP exa integration — Hermes search stack differs" },
	{ re: /^edit\./, cls: "purge", reason: "OMP edit tool — Hermes tools own editing" },
	{ re: /^read/, cls: "purge", reason: "OMP read tool settings" },
	{ re: /^lsp\./, cls: "purge", reason: "OMP LSP agent integration" },
	{ re: /^bashInterceptor\./, cls: "purge", reason: "OMP bash interceptor" },
	{ re: /^shellMinimizer\./, cls: "purge", reason: "OMP shell minimizer" },
	{ re: /^bash\./, cls: "purge", reason: "OMP bash tool — Hermes terminal.*" },
	{ re: /^eval\./, cls: "purge", reason: "OMP eval runtimes" },
	{ re: /^(python|ruby|julia)\./, cls: "purge", reason: "OMP language kernels" },
	{ re: /^(todo|glob|grep|astGrep|astEdit|debug|launch|speechgen|generate_image|inspect_image|checkpoint|fetch|vault|github|web_search|ask|browser)\./, cls: "purge", reason: "OMP per-tool toggles — Hermes toolsets" },
	{ re: /^todo\.enabled$/, cls: "purge", reason: "OMP todo tool" },
	{ re: /^tools\.(artifact|output|intent|abort|maxTimeout|format|xdev)/, cls: "purge", reason: "OMP tool harness limits" },
	{ re: /^async\./, cls: "purge", reason: "OMP async tools" },
	{ re: /^irc\./, cls: "purge", reason: "OMP irc tool" },
	{ re: /^mcp\./, cls: "purge", reason: "OMP MCP client — Hermes MCP config TBD in remap" },
	{ re: /^dev\./, cls: "purge", reason: "OMP dev autoqa" },
	{ re: /^compaction\./, cls: "purge", reason: "OMP compaction — Hermes compression (map in P1)" },
	{ re: /^contextPromotion\./, cls: "purge", reason: "OMP context promotion" },
	{ re: /^branchSummary\./, cls: "purge", reason: "OMP branch summary" },
	{ re: /^workspace\.additionalDirectories$/, cls: "purge", reason: "OMP workspace dirs — Hermes project/cwd" },
	{ re: /^temperature$|^topP$|^topK$|^minP$|^presencePenalty$|^repetitionPenalty$|^textVerbosity$/, cls: "purge", reason: "OMP sampling — not Hermes config SoT" },
	{ re: /^tier\./, cls: "purge", reason: "OMP provider service tiers" },
	{ re: /^retry\./, cls: "purge", reason: "OMP retry/fallback chains" },
	{ re: /^model\.loopGuard|^model\.toolCallLoopGuard/, cls: "purge", reason: "OMP loop guards" },
	{ re: /^modelRoleStorage$|^inlineToolDescriptors$|^includeModelInPrompt$|^includeWorkspaceTree$|^personality$/, cls: "purge", reason: "OMP prompt assembly" },
	{ re: /^defaultThinkingLevel$|^hideThinkingBlock$|^proseOnlyThinking$|^omitThinking$/, cls: "purge", reason: "OMP thinking UI — Hermes show_reasoning/effort P1" },
	{ re: /^providers\.autoThinkingModel$/, cls: "purge", reason: "OMP auto thinking model" },
	{ re: /^providers\.anthropic/, cls: "purge", reason: "OMP anthropic server fallback" },
	{ re: /^images\.describeForTextModels$/, cls: "purge", reason: "OMP vision describe path" },
	{ re: /^tools\.approval/, cls: "purge", reason: "OMP approval — Hermes approvals.* P1" },
	{ re: /^features\./, cls: "purge", reason: "OMP agent features" },
	{ re: /^git\.enabled$/, cls: "purge", reason: "OMP git feature flag" },
	{ re: /^power\./, cls: "purge", reason: "macOS power — optional coat later" },
	{ re: /^stt\./, cls: "purge", reason: "OMP STT keys — Hermes stt.* P2" },
	{ re: /^speech\./, cls: "purge", reason: "OMP speech — Hermes tts/stt P2" },
	{ re: /^tts\./, cls: "purge", reason: "OMP tts — Hermes tts P2" },
	{ re: /^providers\.(tts|fetch|webSearch|imageOrder|maxInFlight|ollama|stream)/, cls: "purge", reason: "OMP provider services — remap P2" },
	{ re: /^searxng\./, cls: "purge", reason: "OMP searxng — Hermes search P2" },
	{ re: /^secrets\.enabled$/, cls: "purge", reason: "OMP secrets flag — Hermes .env" },
	{ re: /^recap\./, cls: "purge", reason: "OMP recap" },
	{ re: /^steeringMode$|^followUpMode$|^interruptMode$|^loop\.mode$|^doubleEscapeAction$|^treeFilterMode$/, cls: "bridge", reason: "Coat input behavior; Hermes steer/interrupt when brain cutover" },
	{ re: /^autocompleteMaxVisible$|^emojiAutocomplete$|^paste\./, cls: "coat", reason: "Composer chrome" },
	{ re: /^completion\.notify$|^error\.notify$|^ask\.(timeout|notify)$/, cls: "coat", reason: "Local notify chrome" },
	{ re: /^autoResume$|^startup\.|^collapseChangelog$/, cls: "coat", reason: "Startup chrome (update check forced off on mtui)" },
	{ re: /^theme\.|^symbolPreset$|^colorBlindMode$/, cls: "coat", reason: "Theme coat" },
	{ re: /^statusLine\./, cls: "coat", reason: "Status line layout coat (bind usage to Hermes later)" },
	{ re: /^terminal\.show|^tui\.|^display\.|^showHardwareCursor$|^task\.showResolvedModelBadge$/, cls: "coat", reason: "Display/streaming coat" },
	{ re: /^images\.(autoResize|blockImages)$|^terminal\.showImages$/, cls: "coat", reason: "Image paint coat" },
];

const TAB_DEFAULT: Partial<Record<SettingTab, SettingClass>> = {
	// Prefer path rules; tab default only if no path rule
	files: "purge",
	shell: "purge",
	tools: "purge",
	tasks: "purge",
	memory: "purge",
	providers: "purge",
	context: "purge",
	model: "purge",
	appearance: "coat",
	interaction: "unmapped",
};

export function classifySettingPath(path: string): SettingVerdict {
	const ui = (SETTINGS_SCHEMA as Record<string, { ui?: { tab?: SettingTab; group?: string } }>)[path]?.ui;
	for (const rule of PATH_RULES) {
		if (rule.re.test(path)) {
			return { path, class: rule.cls, reason: rule.reason, tab: ui?.tab, group: ui?.group };
		}
	}
	const tab = ui?.tab;
	if (tab && TAB_DEFAULT[tab]) {
		return {
			path,
			class: TAB_DEFAULT[tab]!,
			reason: `tab default ${tab}`,
			tab,
			group: ui?.group,
		};
	}
	return { path, class: "unmapped", reason: "no rule — hidden on product until classified", tab, group: ui?.group };
}

/** Visible on mtui product settings UI */
export function isProductVisiblePath(path: string): boolean {
	const c = classifySettingPath(path).class;
	return c === "coat" || c === "hermes" || c === "bridge";
}

export function getProductPathsForTab(tab: SettingTab): SettingPath[] {
	const keys = Object.keys(SETTINGS_SCHEMA) as SettingPath[];
	return keys.filter((path) => {
		const ui = getUi(path);
		if (ui?.tab !== tab) return false;
		if (!isHermesProductSettings()) return true;
		return isProductVisiblePath(path);
	});
}

export function getProductSettingTabs(): SettingTab[] {
	if (!isHermesProductSettings()) return [...SETTING_TABS];
	// Tabs that host HermesConfigPort fields (Herm→OMP map) always visible
	const hermesTabs = new Set<SettingTab>([
		"appearance",
		"model",
		"interaction",
		"context",
		"memory",
		"shell",
		"tools",
		"tasks",
		"providers",
	]);
	return SETTING_TABS.filter((tab) => {
		if (hermesTabs.has(tab)) return true;
		return getProductPathsForTab(tab).length > 0;
	});
}

export function productSettingsBanner(): string {
	return "Hermes product · coat + HermesConfigPort (model/approvals/compression)";
}

/** Audit helper for tests / doctor */
export function auditAllSettings(): {
	total: number;
	byClass: Record<SettingClass, number>;
	purgeSamples: string[];
	visibleSamples: string[];
} {
	const keys = Object.keys(SETTINGS_SCHEMA);
	const byClass: Record<SettingClass, number> = {
		coat: 0,
		hermes: 0,
		port: 0,
		purge: 0,
		bridge: 0,
		unmapped: 0,
	};
	const purgeSamples: string[] = [];
	const visibleSamples: string[] = [];
	for (const path of keys) {
		const v = classifySettingPath(path);
		byClass[v.class]++;
		if (v.class === "purge" && purgeSamples.length < 15) purgeSamples.push(path);
		if ((v.class === "coat" || v.class === "bridge" || v.class === "hermes") && visibleSamples.length < 15) {
			visibleSamples.push(path);
		}
	}
	return { total: keys.length, byClass, purgeSamples, visibleSamples };
}
