/**
 * Framed fallback for tools without a dedicated OMP renderer.
 *
 * Hermes-only tools (skill_view, delegate_task, memory_*, computer_use, mcp__*, …)
 * used to hit ToolExecutionComponent's flat WidthAwareText path — dim title +
 * "(no output)" with no black-box slab. This matches stock OMP framed chrome
 * (CachedOutputBlock) so the coat stays one look.
 *
 * Cadillac: coat owns paint; map Hermes names, don't invent a second chrome system.
 */
import type { Component } from "@oh-my-pi/pi-tui";
import { Text } from "@oh-my-pi/pi-tui";
import type { RenderResultOptions } from "../extensibility/custom-tools/types";
import type { Theme } from "../modes/theme/theme";
import {
	formatExpandHint,
	PREVIEW_LIMITS,
	replaceTabs,
	truncateToWidth,
} from "./render-utils";
import {
	formatArgsInline,
	JSON_TREE_MAX_DEPTH_COLLAPSED,
	JSON_TREE_MAX_DEPTH_EXPANDED,
	JSON_TREE_MAX_LINES_COLLAPSED,
	JSON_TREE_MAX_LINES_EXPANDED,
	JSON_TREE_SCALAR_LEN_COLLAPSED,
	JSON_TREE_SCALAR_LEN_EXPANDED,
	renderJsonTreeLines,
} from "./json-tree";
import { CachedOutputBlock, markFramedBlockComponent } from "../tui/output-block";
import { renderStatusLine } from "../tui";

/** Human title from snake_case / mcp__server__tool Hermes names. */
export function humanizeToolName(name: string): string {
	const raw = (name || "tool").trim();
	if (!raw) return "Tool";
	let s = raw;
	if (s.startsWith("mcp__")) {
		s = s.slice("mcp__".length).replace(/__/g, " · ");
	}
	s = s.replace(/_/g, " ");
	// Title-case short tokens; keep long ALLCAPS (IDs) alone
	return s
		.split(/\s+/)
		.map(tok => {
			if (tok.length <= 1) return tok.toUpperCase();
			if (tok === tok.toUpperCase() && tok.length > 3) return tok;
			return tok.charAt(0).toUpperCase() + tok.slice(1);
		})
		.join(" ");
}

function pickDescription(args: unknown): string | undefined {
	if (!args || typeof args !== "object") return undefined;
	const a = args as Record<string, unknown>;
	for (const k of ["name", "query", "title", "goal", "path", "url", "command", "action", "skill", "id"]) {
		const v = a[k];
		if (typeof v === "string" && v.trim()) return truncateToWidth(v.trim(), 80);
	}
	const inline = formatArgsInline(a, 80);
	return inline || undefined;
}

function outputLines(text: string, expanded: boolean, theme: Theme, width: number): string[] {
	const trimmed = text.trimEnd();
	if (!trimmed) return [theme.fg("muted", "(no output)")];

	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			const parsed = JSON.parse(trimmed);
			const maxDepth = expanded ? JSON_TREE_MAX_DEPTH_EXPANDED : JSON_TREE_MAX_DEPTH_COLLAPSED;
			const maxLines = expanded ? JSON_TREE_MAX_LINES_EXPANDED : JSON_TREE_MAX_LINES_COLLAPSED;
			const maxScalar = expanded ? JSON_TREE_SCALAR_LEN_EXPANDED : JSON_TREE_SCALAR_LEN_COLLAPSED;
			const tree = renderJsonTreeLines(parsed, theme, maxDepth, maxLines, maxScalar);
			const lines = [...tree.lines];
			if (tree.truncated) lines.push(theme.fg("dim", "…"));
			if (!expanded) lines.push(formatExpandHint(theme, expanded, true));
			return lines.length > 0 ? lines : [theme.fg("muted", "(no output)")];
		} catch {
			// fall through
		}
	}

	const raw = replaceTabs(trimmed).split("\n");
	const limit = expanded ? PREVIEW_LIMITS.EXPANDED_LINES : Math.min(6, PREVIEW_LIMITS.COLLAPSED_LINES);
	const budget = Math.max(24, width - 6);
	const shown = raw.slice(0, limit).map(line => theme.fg("toolOutput", truncateToWidth(line, budget)));
	const remaining = raw.length - shown.length;
	if (remaining > 0) {
		shown.push(theme.fg("muted", `… ${remaining} more lines ${formatExpandHint(theme, expanded, true)}`));
	} else if (!expanded && raw.length > 1) {
		shown.push(formatExpandHint(theme, expanded, true));
	}
	return shown;
}

export const genericToolRenderer = {
	mergeCallAndResult: true,
	animatedPartialResult: true,
	animatedPendingPreview: true,

	renderCall(args: unknown, options: RenderResultOptions, theme: Theme): Component {
		// Title is injected by ToolExecutionComponent via toolLabel; we only show
		// a pending line here when call is separate. With mergeCallAndResult the
		// call is usually suppressed once a result exists.
		const title = humanizeToolName(
			typeof (args as { __toolName?: string } | undefined)?.__toolName === "string"
				? (args as { __toolName: string }).__toolName
				: "tool",
		);
		const desc = pickDescription(args);
		const text = renderStatusLine(
			{
				icon: options.spinnerFrame !== undefined ? "running" : "pending",
				spinnerFrame: options.spinnerFrame,
				title,
				description: desc,
			},
			theme,
		);
		return new Text(text, 0, 0);
	},

	renderResult(
		result: { content: Array<{ type: string; text?: string }>; details?: unknown; isError?: boolean },
		options: RenderResultOptions & { renderContext?: { toolName?: string; toolLabel?: string } },
		theme: Theme,
		args?: unknown,
	): Component {
		const outputBlock = new CachedOutputBlock();
		return markFramedBlockComponent({
			render(width: number): readonly string[] {
				const toolName =
					options.renderContext?.toolName ||
					(args && typeof args === "object" && typeof (args as { __toolName?: string }).__toolName === "string"
						? (args as { __toolName: string }).__toolName
						: "tool");
				const title =
					options.renderContext?.toolLabel || humanizeToolName(String(toolName));
				const isPartial = options.isPartial === true;
				const isError = result.isError === true;
				const success = !isPartial && !isError;
				const header = renderStatusLine(
					success
						? {
								icon: "done",
								title,
								description: pickDescription(args),
							}
						: {
								icon: isPartial ? "running" : "error",
								spinnerFrame: options.spinnerFrame,
								title,
								description: pickDescription(args),
							},
					theme,
				);
				const text =
					result.content?.find(b => b.type === "text")?.text ??
					(typeof result.details === "string" ? result.details : "");
				const body = outputLines(String(text ?? ""), options.expanded, theme, width);
				const sections: Array<{ label?: string; lines: readonly string[] }> = [
					{ label: theme.fg("toolTitle", isPartial ? "Running" : "Output"), lines: body },
				];
				// Expanded: show args tree under the frame
				if (options.expanded && args && typeof args === "object") {
					const cleaned = { ...(args as Record<string, unknown>) };
					delete cleaned.__toolName;
					if (Object.keys(cleaned).length > 0) {
						const tree = renderJsonTreeLines(
							cleaned,
							theme,
							JSON_TREE_MAX_DEPTH_EXPANDED,
							JSON_TREE_MAX_LINES_EXPANDED,
							JSON_TREE_SCALAR_LEN_EXPANDED,
						);
						sections.unshift({
							label: theme.fg("toolTitle", "Args"),
							lines: tree.truncated ? [...tree.lines, theme.fg("dim", "…")] : tree.lines,
						});
					}
				}
				return outputBlock.render(
					{
						header,
						state: isPartial ? "running" : isError ? "error" : "success",
						sections,
						width,
					},
					theme,
				);
			},
			invalidate() {
				outputBlock.invalidate();
			},
		});
	},
};
