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

/** Assemble the braille frame at terminal size. Rows are `w` columns wide. */
export function frame(w: number, h: number): { lines: string[]; inner: Inner } {
	const { cw, ch, tw, tv } = FRAME;
	const mw = w - 2 * cw;
	const mh = h - 2 * ch;
	const inner: Inner = { x: cw, y: ch, w: Math.max(0, mw), h: Math.max(0, mh) };
	if (mw < 4 || mh < 2) return { lines: [], inner };

	const repH = (p: string[], span: number) =>
		p.map((l) => l.repeat(Math.ceil(span / tw)).slice(0, span));
	const repV = (p: string[], span: number) => Array.from({ length: span }, (_, i) => p[i % tv]!);

	const t = repH(T, mw);
	const b = repH(B, mw);
	const l = repV(L, mh);
	const r = repV(R, mh);
	const mid = " ".repeat(mw);

	const out: string[] = [];
	for (let i = 0; i < ch; i++) out.push(TL[i]! + t[i]! + TR[i]!);
	for (let i = 0; i < mh; i++) out.push(l[i]! + mid + r[i]!);
	for (let i = 0; i < ch; i++) out.push(BL[i]! + b[i]! + BR[i]!);
	return { lines: out, inner };
}

/** Compact static HERM block wordmark (fits ~26–40 cols). */
export const HERM_WORDMARK_BLOCK = [
	"█ █ █▀▀ █▀▄ █▄█",
	"█▀█ █▀  █▀▄ █ █",
	"█ █ █▄▄ █ █ █ █",
];

export const HERM_WORDMARK_SLICK = ["▛▘▛▀▖▛▀▚▜▘▛▜", "▌ ▣ ▣ ▣ ▣ ▣", "▙▄▌▄▌▙▄▞▐ ▌"];

export function pickWordmark(innerW: number): readonly string[] {
	if (innerW >= 18) return HERM_WORDMARK_BLOCK;
	if (innerW >= 12) return ["HERMES"];
	return ["☿"];
}
