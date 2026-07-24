/**
 * Hermes slash router for mtui product path.
 * Deep-link coat surfaces first; otherwise gateway slash.exec.
 */
export type HermesSlashDeepLink =
	| { type: "settings" }
	| { type: "model" }
	| { type: "port"; port: "kanban" | "cron" | "profiles" }
	| { type: "exec"; command: string }
	| { type: "none" }

/** Parse "/foo bar" → { name, rest, raw }. */
export function parseHermesSlashLine(text: string): { name: string; rest: string; raw: string } | null {
	const t = text.trim()
	if (!t.startsWith("/")) return null
	const body = t.slice(1)
	if (!body) return null
	const m = body.match(/^([^\s:]+)(?:[\s:]+(.*))?$/s)
	if (!m) return null
	return { name: m[1]!.toLowerCase(), rest: (m[2] || "").trim(), raw: t }
}

/**
 * Coat deep-links (no gateway). Unknown Hermes-ish names → exec.
 * OMP builtins are handled before this router runs.
 */
export function routeHermesSlash(text: string): HermesSlashDeepLink {
	const p = parseHermesSlashLine(text)
	if (!p) return { type: "none" }

	switch (p.name) {
		case "settings":
		case "config":
			return { type: "settings" }
		case "model":
			// Bare /model opens hub; /model foo still needs slash.exec for switch
			if (!p.rest) return { type: "model" }
			return { type: "exec", command: p.raw }
		case "kanban":
			if (!p.rest) return { type: "port", port: "kanban" }
			return { type: "exec", command: p.raw }
		case "cron":
			if (!p.rest) return { type: "port", port: "cron" }
			return { type: "exec", command: p.raw }
		case "profile":
		case "profiles":
		case "agents":
			if (!p.rest) return { type: "port", port: "profiles" }
			return { type: "exec", command: p.raw }
		// Always gateway / CLI worker
		case "skills":
		case "reload-skills":
		case "reload-mcp":
		case "status":
		case "usage":
		case "help":
		case "goal":
		case "browser":
		case "compress":
		case "compact":
		case "yolo":
		case "new":
		case "clear":
		case "personality":
		case "reasoning":
		case "undo":
		case "title":
		case "branch":
		case "resume":
			return { type: "exec", command: p.raw }
		default:
			// skill names and anything else — try gateway
			return { type: "exec", command: p.raw }
	}
}
