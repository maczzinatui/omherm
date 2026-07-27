/**
 * Operator-only expand for Hermes Layer-2 persisted tool results.
 *
 * Reads the sandbox file for **display** when the user expands a tool card
 * (ctrl+o / click). Never writes back into the model conversation — so expand
 * does not undo the token/context win of pass-by-reference.
 *
 * Performance:
 * - Load only when expanded
 * - Cap bytes/lines so a 50 MB log cannot freeze the TUI
 * - Callers should drop the expanded body when the card collapses
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Hard cap for UI expand (not model context). */
export const UI_EXPAND_MAX_BYTES = 128 * 1024;
export const UI_EXPAND_MAX_LINES = 800;

export type UiExpandLoad = {
	text: string;
	/** True if we hit a cap and truncated for display */
	capped: boolean;
	bytesRead: number;
	path: string;
	error?: string;
};

/**
 * Load a persisted tool-result path for operator expand.
 * Rejects path traversal outside hermes-results / tmp parents.
 */
export function loadPersistedToolOutputForUi(
	filePath: string,
	opts: { maxBytes?: number; maxLines?: number } = {},
): UiExpandLoad {
	const maxBytes = opts.maxBytes ?? UI_EXPAND_MAX_BYTES;
	const maxLines = opts.maxLines ?? UI_EXPAND_MAX_LINES;
	const resolved = path.resolve(filePath);

	if (!isSafePersistedResultPath(resolved)) {
		return {
			text: "",
			capped: false,
			bytesRead: 0,
			path: resolved,
			error: `Refusing to load path outside hermes-results: ${resolved}`,
		};
	}

	try {
		const st = fs.statSync(resolved);
		if (!st.isFile()) {
			return {
				text: "",
				capped: false,
				bytesRead: 0,
				path: resolved,
				error: "Not a file",
			};
		}
		const fd = fs.openSync(resolved, "r");
		try {
			const toRead = Math.min(st.size, maxBytes + 1);
			const buf = Buffer.alloc(toRead);
			const n = fs.readSync(fd, buf, 0, toRead, 0);
			let text = buf.slice(0, n).toString("utf8");
			let capped = st.size > maxBytes || n > maxBytes;
			if (n > maxBytes) {
				text = text.slice(0, maxBytes);
				capped = true;
			}
			const lines = text.split("\n");
			if (lines.length > maxLines) {
				text = lines.slice(0, maxLines).join("\n");
				capped = true;
			}
			if (capped) {
				text += `\n\n… [UI expand capped at ${maxBytes} bytes / ${maxLines} lines — full file: ${resolved}]`;
			}
			return { text, capped, bytesRead: Math.min(n, maxBytes), path: resolved };
		} finally {
			fs.closeSync(fd);
		}
	} catch (e) {
		return {
			text: "",
			capped: false,
			bytesRead: 0,
			path: resolved,
			error: e instanceof Error ? e.message : String(e),
		};
	}
}

/** Allow only files under a hermes-results directory (local sandbox spill). */
export function isSafePersistedResultPath(resolved: string): boolean {
	const norm = resolved.replace(/\\/g, "/");
	// Must contain hermes-results segment and not climb out via weirdness
	if (!norm.includes("/hermes-results/")) return false;
	if (norm.includes("/../") || norm.endsWith("/..")) return false;
	// Prefer absolute under /tmp or $TMPDIR-ish; also allow custom env temp
	return true;
}
