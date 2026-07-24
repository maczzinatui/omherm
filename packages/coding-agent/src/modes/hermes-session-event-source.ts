/**
 * Thin adapter: HermesGateway UiEvent stream → AgentSessionEvent for OMP EventController.
 * Cast is intentional — MappedAgentSessionEvent is structurally compatible with the
 * EventController turn subset. Full AgentSession facade is a later slice.
 */
import {
	GatewayTurnMapper,
	HermesGateway,
	type MappedAgentSessionEvent,
	type UiEvent,
} from "@omherm/hermes-bridge";
import type { AgentSessionEvent } from "../../session/agent-session.ts";

export type HermesSessionEventListener = (event: AgentSessionEvent) => void;

export class HermesSessionEventSource {
	readonly mapper = new GatewayTurnMapper();
	#unsub: (() => void) | null = null;
	#listeners = new Set<HermesSessionEventListener>();

	constructor(private readonly gw: HermesGateway) {}

	start(): () => void {
		if (this.#unsub) return () => this.stop();
		this.#unsub = this.gw.onUi((ev: UiEvent) => {
			if (ev.kind === "info") {
				this.mapper.setIdentity(ev.info.model, ev.info.provider);
			}
			const mapped = this.mapper.feedUi(ev);
			for (const e of mapped) this.#emit(e);
		});
		return () => this.stop();
	}

	stop() {
		this.#unsub?.();
		this.#unsub = null;
	}

	subscribe(listener: HermesSessionEventListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Interrupt path: force-close open turn as aborted. */
	notifyInterrupted() {
		for (const e of this.mapper.forceEnd("aborted")) this.#emit(e);
	}

	#emit(e: MappedAgentSessionEvent) {
		const asSession = e as unknown as AgentSessionEvent;
		for (const l of this.#listeners) l(asSession);
	}
}
