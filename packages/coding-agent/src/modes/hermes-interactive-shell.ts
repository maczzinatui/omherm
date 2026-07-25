// Hermes interactive shell: OMP chrome pieces + Hermes gateway brain.
// Experimental path: omh --bridge
// Product default remains full InteractiveMode (omh) with Hermes brain under it.
//
// Single brain only (Hermes). Reuses OMP ToolExecution + Markdown paint so the
// coat look is not a LineBox regression while we deepen the InteractiveMode plug.

import {
	Container,
	Editor,
	Markdown,
	ProcessTerminal,
	Spacer,
	Text,
	TUI,
	type Component,
} from "@oh-my-pi/pi-tui";
import { HermesGateway, type SessionInfo, type UiEvent, type Usage } from "@omherm/hermes-bridge";
import { applyPipelineStageToFooter } from "./pipeline-footer.ts";
import { ToolExecutionComponent, type ToolExecutionUi } from "./components/tool-execution.ts";
import { getEditorTheme, getMarkdownTheme, initTheme, theme } from "./theme/theme.ts";

function shortPath(p: string): string {
	const home = process.env.HOME || "";
	if (home && (p === home || p.startsWith(home + "/"))) return "~" + p.slice(home.length);
	return p;
}

function fmtNum(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 10_000) return `${Math.round(n / 1000)}k`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(Math.round(n));
}

function stripAnsi(s: string): string {
	return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Two-line footer shaped like OMP FooterComponent (cwd/branch · tokens · model•effort). */
class HermesFooter implements Component {
	state: {
		cwd: string;
		branch?: string;
		model?: string;
		effort?: string;
		profile?: string;
		usage?: Usage;
		streaming: boolean;
		status?: string;
	} = { cwd: process.cwd(), streaming: false };

	render(width: number): readonly string[] {
		const s = this.state;
		let l1 = s.branch ? `${shortPath(s.cwd)} (${s.branch})` : shortPath(s.cwd);
		if (s.status) {
			const st = s.status.length > 40 ? `${s.status.slice(0, 39)}…` : s.status;
			l1 = `${l1}  ${st}`;
		}
		if (l1.length > width) {
			const h = Math.max(4, Math.floor(width / 2) - 1);
			l1 = `${l1.slice(0, h)}…${l1.slice(-(h - 1))}`;
		}

		const leftParts: string[] = [];
		if (s.streaming) leftParts.push(theme.fg("accent", "●"));
		const u = s.usage;
		if (u?.input_tokens) leftParts.push(theme.fg("dim", `↑${fmtNum(u.input_tokens)}`));
		if (u?.output_tokens) leftParts.push(theme.fg("dim", `↓${fmtNum(u.output_tokens)}`));
		if (u?.cost_usd != null && u.cost_usd > 0) leftParts.push(theme.fg("dim", `$${u.cost_usd.toFixed(3)}`));
		let ctx = "—";
		if (u?.context_percent != null) ctx = `${Math.round(u.context_percent)}%`;
		else if (u?.context_used != null && u?.context_max != null) {
			ctx = `${fmtNum(u.context_used)}/${fmtNum(u.context_max)}`;
		}
		leftParts.push(theme.fg("dim", ctx));
		if (s.profile) leftParts.push(theme.fg("dim", s.profile));
		const leftStr = leftParts.join(" ");

		// Always surface model • effort when known.
		const model = s.model || "hermes";
		const effort = s.effort && s.effort !== "none" ? s.effort : undefined;
		const right = effort
			? `${theme.fg("accent", model)} ${theme.fg("dim", "•")} ${theme.fg("dim", effort)}`
			: theme.fg("accent", model);

		const plainLeft = stripAnsi(leftStr);
		const plainRight = stripAnsi(right);
		const gap = Math.max(2, width - plainLeft.length - plainRight.length);
		const l2 =
			plainLeft.length + 2 + plainRight.length > width
				? `${leftStr}  ${right}`
				: leftStr + " ".repeat(gap) + right;
		return [theme.fg("dim", l1), l2];
	}
}

class UserLine implements Component {
	constructor(private readonly text: string) {}
	render(width: number): readonly string[] {
		const prefix = theme.fg("accent", "❯ ");
		const body = this.text;
		const max = Math.max(8, width - 2);
		if (body.length <= max) return [prefix + body];
		const lines = [prefix + body.slice(0, max)];
		for (let i = max; i < body.length; i += max) lines.push(`  ${body.slice(i, i + max)}`);
		return lines;
	}
}

export async function runHermesShell(): Promise<void> {
	await initTheme();

	const gw = new HermesGateway();
	const terminal = new ProcessTerminal();
	const tui = new TUI(terminal);

	const header = new Text(
		theme.fg("accent", "hermes") + theme.fg("dim", "  ·  agent cockpit") + theme.fg("dim", "  (bridge)"),
		0,
		0,
	);
	const chat = new Container();
	const footer = new HermesFooter();
	const editor = new Editor(getEditorTheme());

	const liveTools = new Map<string, ToolExecutionComponent>();
	let streamingAssistant: Markdown | null = null;
	let streamingThinking: Text | null = null;
	let textBuf = "";
	let thinkingBuf = "";
	let sawConnected = false;
	// Coalesce paint under bursty message.delta / tool.progress (perf).
	let paintScheduled = false;
	const paint = () => {
		if (paintScheduled) return;
		paintScheduled = true;
		queueMicrotask(() => {
			paintScheduled = false;
			tui.requestRender();
		});
	};

	const ui: ToolExecutionUi = {
		requestRender: () => paint(),
		requestComponentRender: () => paint(),
		resetDisplay: () => paint(),
		imageBudget: tui.imageBudget,
	};

	const applyInfo = (info: SessionInfo) => {
		footer.state = {
			...footer.state,
			cwd: info.cwd || footer.state.cwd,
			branch: info.branch ?? footer.state.branch,
			model: info.model ?? footer.state.model,
			effort: info.reasoning_effort !== undefined ? info.reasoning_effort : footer.state.effort,
			profile: info.profile_name ?? footer.state.profile,
			usage: info.usage ? { ...footer.state.usage, ...info.usage } : footer.state.usage,
			streaming: info.running != null ? !!info.running : footer.state.streaming,
		};
		paint();
	};

	const clearThinking = () => {
		if (streamingThinking) {
			chat.removeChild(streamingThinking);
			streamingThinking = null;
		}
		thinkingBuf = "";
	};

	const ensureAssistant = (): Markdown => {
		if (!streamingAssistant) {
			streamingAssistant = new Markdown("", 0, 0, getMarkdownTheme());
			chat.addChild(streamingAssistant);
		}
		return streamingAssistant;
	};

	const setThinking = (text: string, done?: boolean) => {
		thinkingBuf = done ? text : thinkingBuf + text;
		const preview = thinkingBuf.slice(-320).replace(/\s+/g, " ").trim();
		const line = theme.fg("dim", preview ? `⋯ ${preview}` : "⋯ thinking");
		if (!streamingThinking) {
			streamingThinking = new Text(line, 0, 0);
			// Insert thinking above in-progress assistant when both live
			if (streamingAssistant) {
				const aidx = chat.children.indexOf(streamingAssistant);
				if (aidx >= 0) chat.children.splice(aidx, 0, streamingThinking);
				else chat.addChild(streamingThinking);
			} else {
				chat.addChild(streamingThinking);
			}
		} else {
			streamingThinking.setText(line);
		}
		footer.state.streaming = true;
		paint();
	};

	gw.onUi((ev: UiEvent) => {
		switch (ev.kind) {
			case "ready":
				chat.addChild(new Text(theme.fg("dim", "gateway ready"), 0, 0));
				paint();
				break;
			case "info": {
				applyInfo(ev.info);
				const model = ev.info.model || footer.state.model;
				const effort = ev.info.reasoning_effort ?? footer.state.effort;
				if (model && !sawConnected) {
					sawConnected = true;
					const effortBit = effort && effort !== "none" ? ` • ${effort}` : "";
					chat.addChild(new Text(theme.fg("dim", `Connected — ${model}${effortBit}`), 0, 0));
					paint();
				}
				break;
			}
			case "stderr":
				if (/error|fail|traceback/i.test(ev.line)) {
					chat.addChild(new Text(theme.fg("error", ev.line.slice(0, 200)), 0, 0));
					paint();
				}
				break;
			case "user":
				clearThinking();
				if (streamingAssistant) {
					// keep completed assistant text already set via setText
					streamingAssistant = null;
					textBuf = "";
				}
				for (const [, t] of liveTools) {
					try {
						t.seal();
					} catch {
						/* ignore */
					}
				}
				liveTools.clear();
				chat.addChild(new Spacer(1));
				chat.addChild(new UserLine(ev.text));
				footer.state.streaming = true;
				footer.state.status = undefined;
				paint();
				break;
			case "thinking":
				setThinking(ev.text, ev.done);
				break;
			case "text": {
				if (ev.done) {
					if (ev.text) textBuf = ev.text;
					if (textBuf.trim()) {
						const md = ensureAssistant();
						md.setText(textBuf);
					} else if (streamingAssistant && !textBuf.trim()) {
						chat.removeChild(streamingAssistant);
					}
					clearThinking();
					streamingAssistant = null;
					textBuf = "";
					footer.state.streaming = false;
				} else {
					textBuf += ev.text;
					ensureAssistant().setText(textBuf);
					footer.state.streaming = true;
				}
				paint();
				break;
			}
			case "tool_start": {
				const id = ev.id || ev.name;
				let args: unknown = {};
				if (ev.args) {
					try {
						args = JSON.parse(ev.args);
					} catch {
						args = { input: ev.args };
					}
				}
				const tool = new ToolExecutionComponent(ev.name, args, { showImages: false }, undefined, ui);
				liveTools.set(id, tool);
				chat.addChild(tool);
				footer.state.streaming = true;
				paint();
				break;
			}
			case "tool_update": {
				const tool = (ev.id && liveTools.get(ev.id)) || [...liveTools.values()].at(-1);
				if (tool && ev.preview) {
					tool.updateResult({ content: [{ type: "text", text: ev.preview }], isError: false }, true);
					paint();
				}
				break;
			}
			case "tool_end": {
				const id = ev.id || ev.name;
				let tool = liveTools.get(id);
				if (!tool) {
					tool = new ToolExecutionComponent(ev.name, {}, { showImages: false }, undefined, ui);
					chat.addChild(tool);
				}
				const summary = ev.error || ev.summary || "";
				tool.updateResult(
					{ content: [{ type: "text", text: summary.slice(0, 4000) }], isError: !!ev.error },
					false,
				);
				tool.setArgsComplete();
				try {
					tool.seal();
				} catch {
					/* ignore */
				}
				liveTools.delete(id);
				paint();
				break;
			}
			case "turn_end":
				footer.state.streaming = false;
				// Keep last lean pipeline stage visible (E11) until next user turn
				if (ev.usage) footer.state.usage = { ...footer.state.usage, ...ev.usage };
				void gw.refreshInfo().catch(() => {});
				paint();
				break;
			case "error":
				chat.addChild(new Text(theme.fg("error", `! ${ev.text}`), 0, 0));
				footer.state.streaming = false;
				paint();
				break;
			case "clarify":
				chat.addChild(new Text(theme.fg("warning", `? ${ev.question}`), 0, 0));
				if (ev.choices?.length) {
					chat.addChild(new Text(theme.fg("dim", `  [${ev.choices.join(" | ")}]`), 0, 0));
				}
				footer.state.streaming = false;
				paint();
				break;
			case "approval":
				chat.addChild(new Text(theme.fg("warning", `approval: ${ev.description || ev.command}`), 0, 0));
				footer.state.streaming = false;
				paint();
				break;
			case "status":
				footer.state.streaming = true;
				footer.state.status = ev.text;
				paint();
				break;
			case "pipeline_stage": {
				// E11: persistent footer stage strip (keep last stage after turn)
				applyPipelineStageToFooter(footer.state, ev);
				paint();
				break;
			}
			default:
				break;
		}
	});

	tui.addChild(header);
	tui.addChild(new Text(theme.fg("dim", "─".repeat(48)), 0, 0));
	tui.addChild(chat);
	tui.addChild(new Text(theme.fg("dim", "─".repeat(48)), 0, 0));
	tui.addChild(footer);
	tui.addChild(new Text("", 0, 0));
	tui.addChild(editor);

	tui.setFocus(editor);
	tui.start();

	try {
		const info = await gw.bootstrap();
		applyInfo(info);
		// Pull full session.info if create payload was sparse (model/effort)
		if (!info.model || info.reasoning_effort == null) {
			const full = await gw.refreshInfo().catch(() => null);
			if (full) applyInfo(full);
		}
	} catch (e) {
		chat.addChild(
			new Text(theme.fg("error", `bootstrap: ${e instanceof Error ? e.message : String(e)}`), 0, 0),
		);
		paint();
	}
	tui.setFocus(editor);

	editor.onSubmit = (raw) => {
		const text = raw.trim();
		if (!text) return;
		if (text === "/quit" || text === "/exit") {
			gw.kill();
			tui.stop();
			process.exit(0);
		}
		if (text === "/interrupt") {
			void gw.interrupt().catch(() => {});
			return;
		}
		void gw.submit(text).catch((e) => {
			chat.addChild(new Text(theme.fg("error", e instanceof Error ? e.message : String(e)), 0, 0));
			paint();
		});
	};

	const shutdown = () => {
		gw.kill();
		tui.stop();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
