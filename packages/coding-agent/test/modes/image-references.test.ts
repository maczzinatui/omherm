import { describe, expect, it } from "bun:test";
import {
	type PlaceholderKind,
	renderPlaceholders,
	shiftImageMarkers,
} from "@oh-my-pi/pi-coding-agent/modes/image-references";

function capture(text: string): {
	out: string;
	refs: Array<{ label: string; kind: PlaceholderKind; index: number; path?: string }>;
} {
	const refs: Array<{ label: string; kind: PlaceholderKind; index: number; path?: string }> = [];
	const out = renderPlaceholders(text, {
		renderText: t => t,
		renderReference: (label, kind, index, path) => {
			refs.push({ label, kind, index, path });
			return `<${kind}:${index}>`;
		},
	});
	return { out, refs };
}

describe("renderPlaceholders", () => {
	it("classifies image and paste markers with their index and full label", () => {
		const { out, refs } = capture("see [Image #1, 800x600] then [Paste #2, +30 lines] done");
		expect(refs).toEqual([
			{ label: "[Image #1, 800x600]", kind: "image", index: 1 },
			{ label: "[Paste #2, +30 lines]", kind: "paste", index: 2 },
		]);
		expect(out).toBe("see <image:1> then <paste:2> done");
	});

	it("matches the bare image form and the char-count paste form", () => {
		expect(capture("[Image #3]").refs[0]).toMatchObject({ kind: "image", index: 3 });
		expect(capture("[Paste #4, 1500 chars]").refs[0]).toMatchObject({ kind: "paste", index: 4 });
	});

	it("passes plain text straight through renderText with no references", () => {
		const { out, refs } = capture("no markers here");
		expect(refs).toHaveLength(0);
		expect(out).toBe("no markers here");
	});

	it("does not treat an unterminated marker as a reference", () => {
		// This is the half-eaten state atomic deletion prevents — it must render as plain text.
		const { refs } = capture("[Paste #1, +30 lines");
		expect(refs).toHaveLength(0);
	});
});

describe("renderPlaceholders — attached-image markers", () => {
	it("classifies [Attached image: <path>] as kind 'attached-image' with the path", () => {
		const { out, refs } = capture("[Attached image: /tmp/foo.png] hello");
		expect(refs).toEqual([
			{ label: "[Attached image: /tmp/foo.png]", kind: "attached-image", index: 0, path: "/tmp/foo.png" },
		]);
		expect(out).toBe("<attached-image:0> hello");
	});

	it("renders attached-image and Image #N markers in left-to-right order", () => {
		const { out, refs } = capture("see [Image #1] and [Attached image: /tmp/x.png] then [Image #2, 800x600]");
		expect(refs.map(r => ({ kind: r.kind, label: r.label, path: r.path }))).toEqual([
			{ kind: "image", label: "[Image #1]", path: undefined },
			{ kind: "attached-image", label: "[Attached image: /tmp/x.png]", path: "/tmp/x.png" },
			{ kind: "image", label: "[Image #2, 800x600]", path: undefined },
		]);
		expect(out).toBe("see <image:1> and <attached-image:0> then <image:2>");
	});

	it("rejects attached-image markers with an embedded newline (path is bounded by ])", () => {
		// The regex span is `[^\]\n]+` — newline terminates the path before the closing
		// `]` lands, so the whole marker is rejected. The text is paint-only. The model
		// never sees this garbage because the editor only emits single-line markers.
		const { out, refs } = capture("[Attached image: /tmp/a\n/tmp/b.png]");
		expect(refs).toEqual([]);
		expect(out).toBe("[Attached image: /tmp/a\n/tmp/b.png]");
	});

	it("shiftImageMarkers preserves attached-image markers verbatim while renumbering legacy image markers", () => {
		// The shift is owned by the legacy placeholder pipeline; attached-image markers
		// carry an absolute path the model needs to read, so they MUST stay literal.
		const text = "[Attached image: /tmp/foo.png] [Image #1]";
		expect(shiftImageMarkers(text, 5)).toBe("[Attached image: /tmp/foo.png] [Image #6]");
	});
});

describe("shiftImageMarkers", () => {
	it("returns text unchanged when the offset is zero", () => {
		const text = "[Image #1] then [Image #2, 100x100] and [Paste #3, +5 lines]";
		expect(shiftImageMarkers(text, 0)).toBe(text);
	});

	it("renumbers every Image marker by the offset and preserves the WxH tail", () => {
		expect(shiftImageMarkers("see [Image #1, 800x600] then [Image #2]", 3)).toBe(
			"see [Image #4, 800x600] then [Image #5]",
		);
	});

	it("never touches Paste markers", () => {
		expect(shiftImageMarkers("[Image #1] [Paste #1, +5 lines]", 2)).toBe("[Image #3] [Paste #1, +5 lines]");
	});
});
