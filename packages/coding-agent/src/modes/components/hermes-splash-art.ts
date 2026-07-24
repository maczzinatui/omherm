// Herm fork braille splash frame (from ~/herm/src/ui/splash-art.ts).
// Baked 9-patch pieces — used as the Hermes product welcome panel.
// Color is applied by the host via OMP theme (not hardcoded here).

export const FRAME = { cw: 16, ch: 8, tw: 20, tv: 8 } as const;

const TL = [
	"⠀⢀⣤⠤⢄⣀⠄⢀⣠⣤⣄⡤⡄⡀⠀⠀",
	"⠀⣜⡁⢩⣈⡂⢀⣋⣭⠉⠈⢈⣮⣻⡑⣶",
	"⠀⢸⡖⢿⠏⣤⣶⣽⣫⢶⣢⡌⠹⣧⡏⠻",
	"⠀⠈⡤⢒⣦⢻⣿⣿⣿⢿⣅⡇⣆⡉⠂⢀",
	"⠁⢸⡏⠘⠋⢞⢳⣿⣿⣟⡍⡍⣤⠅⠀⢨",
	"⠀⠤⢯⣆⣀⠙⢦⣿⡋⢀⣜⠇⣁⣒⣊⣉",
	"⠀⢀⣷⣝⣻⣶⣶⢄⠍⠘⡁⡇⣧⣠⣤⡢",
	"⠀⠀⠘⢎⢿⣯⠃⠁⡤⣚⡼⠀⡏⣹⣿⡩",
];

const TR = [
	"⠀⠀⢀⢠⢠⣠⣤⣀⡀⠠⣀⡠⠤⣤⣀⠀",
	"⣶⢊⣟⣵⡁⠁⠉⣭⣙⠀⢐⣂⡍⢈⣣⠀",
	"⠟⢹⣼⠏⢡⣔⢶⣝⣯⣶⣤⠹⡿⢲⡇⠀",
	"⡀⠁⢉⣰⢸⣨⡿⣿⣿⣿⡟⣴⡒⢤⠁⠀",
	"⡅⠄⠨⣤⢩⢩⣻⣿⣿⡞⡳⠙⠃⢹⡇⠀",
	"⣉⣑⣒⣈⠸⣣⡀⢙⣿⡴⠋⣀⣰⡽⠤⢀",
	"⢄⣤⣄⣸⢸⢈⠃⠩⡠⣶⣶⣟⣫⣾⠂⠀",
	"⢍⣿⢟⢹⠀⢧⣒⢤⠁⠈⣽⡿⡱⠇⠀⠀",
];

const BL = [
	"⠀⠀⣀⣿⣿⡟⠁⠀⠻⢬⣳⠀⣇⣲⣟⢿",
	"⠀⢐⡺⣛⡯⣭⠷⠌⢂⢀⡂⡇⡏⠙⠛⠧",
	"⠀⠖⡼⠉⠉⢠⣰⠥⢭⠘⣛⣄⢋⣉⣉⡙",
	"⠀⢸⡌⢀⣠⣵⣿⣿⣿⣿⣨⠃⠷⠂⠐⢍",
	"⠀⠀⠻⠝⠿⣴⣿⣿⡿⣿⣟⣋⡏⡁⠄⠘",
	"⠀⢸⣰⣶⣄⠻⠿⣿⣹⠰⠟⢂⢠⡟⣆⣴",
	"⠀⢪⡉⠸⣻⠇⠀⡝⣛⢀⡀⣘⡟⡷⣫⡯",
	"⠀⠙⠻⠪⠜⠓⠂⠈⠛⠓⠛⠙⠚⠈⠁⠀",
];

const BR = [
	"⡿⣻⣖⣸⠀⣞⡡⠟⢀⠄⢻⣿⣿⣀⠀⠀",
	"⠶⠛⠋⢹⢸⢐⡀⡐⠡⠾⣭⢽⣛⢗⡂⠀",
	"⢋⣉⣉⡙⣠⣛⠃⡭⠬⣆⡄⠉⠩⢧⠲⠀",
	"⡩⠂⠐⠾⠘⣅⣿⣿⣿⣿⣮⣄⡀⢱⡇⠀",
	"⠃⢀⢈⢳⣙⣻⣿⣟⣿⣿⣦⠿⠫⠟⠀⠀",
	"⣦⣰⢻⡄⡐⠻⠃⣏⣿⠿⠟⣠⣶⣆⡇⠀",
	"⢽⣝⢯⢻⣃⢀⡀⣛⣩⠀⠸⣟⠇⢉⡕⠀",
	"⠁⠀⠁⠓⠋⠛⠚⠛⠁⠐⠚⠣⠇⠟⠋⠀",
];

const T = [
	"⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
	"⡄⣢⣴⣶⠶⠖⠲⣌⠘⠉⠢⡛⢡⠴⠲⠶⣰⢖⢴⣤",
	"⣾⣥⠿⠀⣠⢰⠿⢾⡐⠾⠿⢇⡳⣿⣗⠄⠀⠣⣑⣵",
	"⢾⡟⠄⠐⢭⣍⢖⡄⠨⢻⣫⠽⡼⡿⢽⢥⡂⠄⠻⡽",
	"⠓⡻⢶⣄⡈⠘⠭⠚⠍⢻⡉⠋⠋⠭⠃⠃⡡⣶⣟⢾",
	"⠁⠄⠉⠉⠚⠤⠤⠬⠟⠰⠧⠊⠯⠴⠤⠓⠛⠉⠐⠢",
	"⣛⣛⡟⣛⡛⣛⣛⢛⣛⣛⡛⣛⣛⢛⣻⣻⣟⠛⣻⢻",
	"⣊⣉⣉⣛⣋⣙⣋⣼⣷⣥⣯⣺⣋⣵⣷⣭⣙⣑⣻⣽",
];

const B = [
	"⣿⢿⣿⣿⢿⣿⡿⡿⣿⣿⠿⣿⢿⡿⣿⣿⡿⣿⡿⢿",
	"⣃⣛⣈⣓⣚⣚⣃⣙⣛⣉⣛⣛⣁⣛⣙⣙⣋⣘⣉⣙",
	"⠠⢄⢄⣀⡤⣤⠐⣠⢄⢠⡄⡤⣄⠀⡤⢄⣀⡀⢀⢀",
	"⣱⠬⠫⠑⢁⣠⢠⡫⣡⣠⣤⣉⢅⢄⣄⠉⠻⡐⢥⣌",
	"⢔⣈⠀⢰⡁⢶⣿⣿⣟⣿⣃⡛⠕⠍⣦⣃⡄⠂⣹⡢",
	"⡿⢏⢄⠀⠃⣫⣿⢜⢩⣶⣦⠉⡶⣾⡖⠛⠀⣠⡛⡿",
	"⠼⢾⠿⣵⣖⣘⠴⠃⠈⢆⢀⠀⡳⠤⣂⣲⣾⠯⠚⠏",
	"⠀⠀⠁⠀⠀⠀⠀⠈⠉⠙⠋⠉⠁⠀⠀⠀⠀⠀⠀⠀",
];

const L = [
	"⠀⠀⢐⢟⣾⠿⠮⠶⡷⣪⠾⠂⡗⢭⢿⢹",
	"⠀⠀⣨⡕⠉⡡⠤⣁⡌⠪⢧⠁⡇⣰⣿⢼",
	"⠀⠀⠹⡃⢾⣕⣷⡦⣓⡀⡉⡆⡏⣶⡣⣻",
	"⠀⢰⡶⢬⣭⡜⣿⣿⣯⢈⢓⠁⡏⣚⡾⣿",
	"⠀⠘⡛⢊⣙⠣⢇⢯⣿⠨⡭⡁⡧⢼⣲⣿",
	"⠀⠀⢱⡉⢿⡇⠤⣝⡄⠀⡁⠁⡏⣶⢖⢿",
	"⠀⠀⢰⣧⡀⠓⠓⠉⢁⣴⡍⠀⡇⠺⠽⢺",
	"⠀⠀⠨⠺⣽⣷⣦⡴⡚⠃⢀⠀⡇⡾⣿⢹",
];

const R = [
	"⡏⡿⡭⢺⢀⠷⢝⢾⠶⠵⠿⣷⡻⡂⠀⠀",
	"⡧⣿⣆⢸⠀⡼⠕⢡⣀⠤⢌⠉⢪⣅⠁⠀",
	"⣟⢜⣶⢹⢰⢉⢀⣚⢴⣾⣪⡷⢘⠏⠀⠀",
	"⣿⢷⡛⢹⠈⡚⡁⣽⣿⣿⢣⣭⡥⢶⡆⠀",
	"⣿⣖⡧⢼⢈⢭⠅⣿⡽⡸⡘⣋⡑⢛⠃⠀",
	"⡿⡲⣶⢹⠈⢈⠀⢠⣫⠤⢸⡿⢉⡆⠀⠀",
	"⡗⠯⠗⢸⠀⢩⣦⡈⠉⠚⠚⢀⣼⡆⠀⠀",
	"⡏⣿⢯⢸⠀⢀⠘⢓⢦⢶⣾⣯⠗⠅⠀⠀",
];

export type Inner = { x: number; y: number; w: number; h: number };

export type FrameOptions = {
	/** Top/bottom chrome rows (1–8). Default full 8. Use 3–4 when terminal is short. */
	chrome?: number;
};

/** Small LRU for plain braille geometry (theme not applied here). */
const FRAME_CACHE_MAX = 24;
const frameCache = new Map<string, { lines: string[]; inner: Inner }>();

/** Assemble the braille frame at terminal size. Rows are `w` columns wide. */
export function frame(w: number, h: number, opts: FrameOptions = {}): { lines: string[]; inner: Inner } {
	const chrome = opts.chrome ?? FRAME.ch;
	const cacheKey = `${w}|${h}|${chrome}`;
	const cached = frameCache.get(cacheKey);
	if (cached) {
		// Move to end (LRU touch)
		frameCache.delete(cacheKey);
		frameCache.set(cacheKey, cached);
		return { lines: cached.lines, inner: { ...cached.inner } };
	}

	const { cw, tw, tv } = FRAME;
	const chFull = FRAME.ch;
	const ch = Math.max(1, Math.min(chFull, chrome));
	const mw = w - 2 * cw;
	const mh = h - 2 * ch;
	const inner: Inner = { x: cw, y: ch, w: Math.max(0, mw), h: Math.max(0, mh) };
	if (mw < 4 || mh < 1) return { lines: [], inner };

	const repH = (p: string[], span: number) =>
		p.map((l) => l.repeat(Math.ceil(span / tw)).slice(0, span));
	const repV = (p: string[], span: number) => Array.from({ length: span }, (_, i) => p[i % tv]!);

	// Compact chrome: keep outer edge rows of the 9-patch (top of TL + bottom of TL, etc.)
	const takeChrome = (p: string[], n: number, fromEnd = false): string[] => {
		if (n >= p.length) return p;
		if (!fromEnd) return p.slice(0, n);
		return p.slice(p.length - n);
	};

	const tl = takeChrome(TL, ch, false);
	const tr = takeChrome(TR, ch, false);
	const bl = takeChrome(BL, ch, true);
	const br = takeChrome(BR, ch, true);
	// Horizontal strips: sample evenly across full 8-row patterns
	const sampleH = (p: string[], n: number) => {
		if (n >= p.length) return p;
		const out: string[] = [];
		for (let i = 0; i < n; i++) {
			const idx = n === 1 ? 0 : Math.round((i * (p.length - 1)) / (n - 1));
			out.push(p[idx]!);
		}
		return out;
	};
	const tPat = sampleH(T, ch);
	const bPat = sampleH(B, ch);

	const t = repH(tPat, mw);
	const b = repH(bPat, mw);
	const l = repV(L, mh);
	const r = repV(R, mh);
	const mid = " ".repeat(mw);

	const out: string[] = [];
	for (let i = 0; i < ch; i++) out.push(tl[i]! + t[i]! + tr[i]!);
	for (let i = 0; i < mh; i++) out.push(l[i]! + mid + r[i]!);
	for (let i = 0; i < ch; i++) out.push(bl[i]! + b[i]! + br[i]!);
	const result = { lines: out, inner };
	if (frameCache.size >= FRAME_CACHE_MAX) {
		const oldest = frameCache.keys().next().value;
		if (oldest !== undefined) frameCache.delete(oldest);
	}
	frameCache.set(cacheKey, result);
	return { lines: out, inner: { ...inner } };
}

/** Compact static HERM block wordmark (fits ~26–40 cols). */
export const HERM_WORDMARK_BLOCK = [
	"█ █ █▀▀ █▀▄ █▄█",
	"█▀█ █▀  █▀▄ █ █",
	"█ █ █▄▄ █ █ █ █",
];

export const HERM_WORDMARK_SLICK = ["▛▘▛▀▖▛▀▚▜▘▛▜", "▌ ▣ ▣ ▣ ▣ ▣", "▙▄▌▄▌▙▄▞▐ ▌"];

export function pickWordmark(innerW: number, maxLines = 3): readonly string[] {
	if (maxLines <= 1) return innerW >= 6 ? ["HERMES"] : ["☿"];
	if (maxLines === 2) return innerW >= 18 ? HERM_WORDMARK_BLOCK.slice(0, 2) : ["HERMES"];
	if (innerW >= 18) return HERM_WORDMARK_BLOCK;
	if (innerW >= 12) return ["HERMES"];
	return ["☿"];
}

/** How many chrome rows to use given total splash height and desired min inner. */
export function pickChrome(totalH: number, minInner = 8): number {
	// Prefer full 8 when we can keep minInner; else shrink chrome down to 3.
	for (const ch of [8, 6, 5, 4, 3]) {
		if (totalH - 2 * ch >= minInner) return ch;
	}
	return 3;
}
