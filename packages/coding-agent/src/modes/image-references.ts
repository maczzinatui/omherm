import type { ImageContent } from "@oh-my-pi/pi-ai";
import { logger } from "@oh-my-pi/pi-utils";
import { type BlobPutResult, blobExtensionForImageMimeType } from "../session/blob-store";
import { fileHyperlink } from "../tui/hyperlink";

/** Matches `[Image #N]`/`[Image #N, WxH]` and `[Paste #N, +X lines]`/`[Paste #N, Y chars]` tokens.
 *  Group 1 is the kind (`Image`/`Paste`), group 2 the 1-based index. The optional metadata
 *  tail (`, …`) is captured loosely (no `]`/newline) so future label tweaks keep matching. */
export const PLACEHOLDER_REGEX = /\[(Image|Paste) #([1-9]\d*)(?:,[^\]\n]*)?\]/g

/** Matches the Hermes-brain text-only image marker `[Attached image: <path>]`. Group 1 is the
 *  path. The path is bounded by `]` so embedded newlines are rejected (the gateway/editor
 *  contract never produces them, but the regex errs strict). The bracketed form is the
 *  model-facing path hint; the renderers turn it into a clickable OSC 8 hyperlink in the
 *  user-message bubble via fileHyperlink. */
export const ATTACHED_IMAGE_REGEX = /\[Attached image: ([^\]\n]+)\]/g;

/** Matches a single `[Image #N]` / `[Image #N, WxH]` marker. Group 1 is the
 *  1-based index, group 2 the optional metadata tail (leading comma, no `]` or
 *  newline) so future label tweaks keep matching. Paste markers are excluded
 *  on purpose: their numbering is owned by the editor's paste store, not by
 *  the pending-image buffer. */
const IMAGE_MARKER_REGEX = /\[Image #([1-9]\d*)((?:,[^\]\n]*)?)\]/g;

/** Renumber every `[Image #N]` marker in `text` by `offset` (added to the
 *  existing index), preserving the optional `, WxH` tail. Paste markers are
 *  left untouched. Used when restoring queued image-messages back into a draft
 *  that already holds pending images so the merged text's positional markers
 *  still line up with `pendingImages`. */
export function shiftImageMarkers(text: string, offset: number): string {
	if (offset === 0) return text;
	return text.replace(
		IMAGE_MARKER_REGEX,
		(_match, idx: string, tail: string) => `[Image #${Number(idx) + offset}${tail}]`,
	);
}

type ImageBlobWriter = (data: Buffer, options?: { extension?: string }) => Promise<BlobPutResult>;
type ImageBlobWriterSync = (data: Buffer, options?: { extension?: string }) => BlobPutResult;

export type PlaceholderKind = "image" | "paste" | "attached-image";

export interface PlaceholderRenderers {
	renderText: (text: string) => string;
	/**
	 * Render a placeholder reference. The optional `path` is set only for
	 * `attached-image` markers (it carries the on-disk path so the renderer
	 * can emit a clickable OSC 8 hyperlink); legacy `image` / `paste` markers
	 * leave it undefined.
	 */
	renderReference: (
		label: string,
		kind: PlaceholderKind,
		index: number,
		path?: string,
	) => string;
}

type Match = { readonly start: number; readonly end: number; readonly kind: PlaceholderKind; readonly label: string; readonly index?: number; readonly path?: string };

/** Scan `text` for both the legacy `[Image #N]` / `[Paste #N]` placeholders AND the
 *  Hermes-brain `[Attached image: <path>]` markers, returning them in left-to-right
 *  order. Implementation note: keeping two separate regexes avoids a single combined
 *  pattern that would balloon to handle both shapes; the scan is O(n) either way. */
function scanPlaceholders(text: string): Match[] {
	const matches: Match[] = [];
	PLACEHOLDER_REGEX.lastIndex = 0;
	for (;;) {
		const m = PLACEHOLDER_REGEX.exec(text);
		if (m === null) break;
		matches.push({
			start: m.index,
			end: m.index + m[0].length,
			kind: m[1] === "Paste" ? "paste" : "image",
			label: m[0],
			index: Number(m[2]),
		});
	}
	ATTACHED_IMAGE_REGEX.lastIndex = 0;
	for (;;) {
		const m = ATTACHED_IMAGE_REGEX.exec(text);
		if (m === null) break;
		matches.push({
			start: m.index,
			end: m.index + m[0].length,
			kind: "attached-image",
			label: m[0],
			path: m[1],
		});
	}
	matches.sort((a, b) => a.start - b.start);
	return matches;
}

export function renderPlaceholders(text: string, renderers: PlaceholderRenderers): string {
	const matches = scanPlaceholders(text);
	if (matches.length === 0) {
		return renderers.renderText(text);
	}
	let result = "";
	let last = 0;
	for (const m of matches) {
		if (m.start > last) {
			result += renderers.renderText(text.slice(last, m.start));
		}
		result += renderers.renderReference(m.label, m.kind, m.index ?? 0, m.path);
		last = m.end;
	}
	if (last < text.length) {
		result += renderers.renderText(text.slice(last));
	}
	return result;
}

export function imageReferenceHyperlink(
	label: string,
	index: number,
	imageLinks: readonly (string | undefined)[] | undefined,
	renderLabel: (text: string) => string,
): string {
	const rendered = renderLabel(label);
	const target = imageLinks?.[index - 1];
	return target ? fileHyperlink(target, rendered) : rendered;
}

/** Render a Hermes-brain `[Attached image: <path>]` marker as a clickable OSC 8
 *  file hyperlink. The path travels in the marker itself (no `pendingImages[]`
 *  lookup), so this works for messages that were built without the OMP
 *  pending-image pipeline — i.e. the Hermes-coat renders images as text-only
 *  inline path hints that the model can vision by reading the file. */
export function attachedImageHyperlink(
	label: string,
	path: string,
	renderLabel: (text: string) => string,
): string {
	const rendered = renderLabel(label);
	return path ? fileHyperlink(path, rendered) : rendered;
}

async function materializeImageReferenceLinkAsync(
	image: ImageContent,
	index: number,
	putBlob: ImageBlobWriter,
): Promise<string | undefined> {
	try {
		const result = await putBlob(Buffer.from(image.data, "base64"), {
			extension: blobExtensionForImageMimeType(image.mimeType),
		});
		return result.displayPath;
	} catch (error) {
		logger.warn("Failed to write image reference blob", {
			index,
			mimeType: image.mimeType,
			error: error instanceof Error ? error.message : String(error),
		});
		return undefined;
	}
}

function materializeImageReferenceLink(
	image: ImageContent,
	index: number,
	putBlob: ImageBlobWriterSync,
): string | undefined {
	try {
		const result = putBlob(Buffer.from(image.data, "base64"), {
			extension: blobExtensionForImageMimeType(image.mimeType),
		});
		return result.displayPath;
	} catch (error) {
		logger.warn("Failed to write image reference blob", {
			index,
			mimeType: image.mimeType,
			error: error instanceof Error ? error.message : String(error),
		});
		return undefined;
	}
}

export async function materializeImageReferenceLinks(
	images: readonly ImageContent[] | undefined,
	putBlob: ImageBlobWriter,
): Promise<(string | undefined)[] | undefined> {
	if (!images || images.length === 0) return undefined;
	const links = await Promise.all(
		images.map((image, index) => materializeImageReferenceLinkAsync(image, index + 1, putBlob)),
	);
	return links.some(link => link !== undefined) ? links : undefined;
}

export function materializeImageReferenceLinksSync(
	images: readonly ImageContent[] | undefined,
	putBlob: ImageBlobWriterSync,
): (string | undefined)[] | undefined {
	if (!images || images.length === 0) return undefined;
	const links = images.map((image, index) => materializeImageReferenceLink(image, index + 1, putBlob));
	return links.some(link => link !== undefined) ? links : undefined;
}
