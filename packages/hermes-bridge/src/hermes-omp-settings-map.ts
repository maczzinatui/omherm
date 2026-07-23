/**
 * Herm Config taxonomy → OMP /settings tabs.
 *
 * Source: ~/herm/src/config/{schema.ts,index.ts} MERGE + GROUPS.
 * Placement: land Hermes keys under the OMP tab/group that already means
 * the same thing — no parallel Herm sidebar.
 *
 * Model picker = OMP ModelHub (/model + Settings → Model launcher).
 */
export type ConfigEffect = "live" | "restart" | "session"

export type OmpSettingsTab =
  | "appearance"
  | "model"
  | "interaction"
  | "context"
  | "memory"
  | "files"
  | "shell"
  | "tools"
  | "tasks"
  | "providers"

export type HermesOmpFieldSpec = {
  key: string
  label: string
  description: string
  tab: OmpSettingsTab
  group: string
  type: "boolean" | "enum" | "text" | "number"
  values?: readonly string[]
  effect: ConfigEffect
  fallback?: string | boolean | number
}

const f = (
  key: string,
  label: string,
  tab: OmpSettingsTab,
  group: string,
  type: HermesOmpFieldSpec["type"],
  opts?: {
    values?: readonly string[]
    effect?: ConfigEffect
    fallback?: string | boolean | number
    description?: string
  },
): HermesOmpFieldSpec => ({
  key,
  label,
  description: opts?.description ?? `Hermes ${key}`,
  tab,
  group,
  type,
  values: opts?.values,
  effect: opts?.effect ?? "live",
  fallback: opts?.fallback,
})

/**
 * Curated operator surface from Herm schema groups, placed into OMP tabs.
 * Lists/dicts (deny packs, aux extra_body) stay CLI for now.
 */
export const HERMES_OMP_FIELD_SPECS: readonly HermesOmpFieldSpec[] = [
  // ── appearance ← Herm display ──
  f("display.skin", "Hermes skin", "appearance", "Theme", "text", { fallback: "slate" }),
  f("display.compact", "Compact layout", "appearance", "Display", "boolean", { fallback: false }),
  f("display.show_cost", "Show cost", "appearance", "Display", "boolean", { fallback: false }),
  f("display.streaming", "Streaming", "appearance", "Display", "boolean", { fallback: true }),
  f("display.timestamps", "Timestamps", "appearance", "Display", "boolean", { fallback: false }),
  f("display.inline_diffs", "Inline diffs", "appearance", "Display", "boolean", { fallback: true }),
  f("display.tool_progress", "Tool progress", "appearance", "Display", "enum", {
    values: ["off", "new", "all", "verbose"],
    fallback: "all",
  }),
  f("display.friendly_tool_labels", "Friendly tool labels", "appearance", "Display", "boolean", {
    fallback: true,
  }),
  f("display.tool_preview_length", "Tool preview length", "appearance", "Display", "number", {
    fallback: 120,
  }),
  f("display.bell_on_complete", "Bell on complete", "appearance", "Display", "boolean", {
    fallback: false,
  }),
  f("display.personality", "Personality", "appearance", "Theme", "text", { fallback: "" }),
  f("display.tui_status_indicator", "Status indicator", "appearance", "Status Line", "enum", {
    values: ["kaomoji", "spinner", "none"],
    fallback: "kaomoji",
  }),

  // ── model ← Herm agent + aux compression + delegation models ──
  f("agent.reasoning_effort", "Reasoning effort", "model", "Thinking", "enum", {
    values: ["", "none", "minimal", "low", "medium", "high", "xhigh"],
    effect: "live",
    fallback: "low",
  }),
  f("display.show_reasoning", "Show reasoning", "model", "Thinking", "boolean", { fallback: true }),
  f("display.reasoning_full", "Full reasoning", "model", "Thinking", "boolean", { fallback: false }),
  f("display.reasoning_style", "Reasoning style", "model", "Thinking", "text", { fallback: "code" }),
  f("agent.max_turns", "Max turns", "model", "Prompt", "number", { effect: "session", fallback: 90 }),
  f("agent.api_max_retries", "API max retries", "model", "Retry & Fallback", "number", {
    effect: "session",
    fallback: 3,
  }),
  f("agent.service_tier", "Service tier", "model", "Sampling", "text", { fallback: "" }),
  f("agent.tool_use_enforcement", "Tool-use enforcement", "model", "Prompt", "enum", {
    values: ["auto", "true", "false"],
    effect: "session",
    fallback: "auto",
  }),
  f("agent.task_completion_guidance", "Finish-the-job guidance", "model", "Prompt", "boolean", {
    effect: "session",
    fallback: true,
  }),
  f("agent.parallel_tool_call_guidance", "Parallel tool guidance", "model", "Prompt", "boolean", {
    effect: "session",
    fallback: true,
  }),
  f("agent.verify_on_stop", "Verify on stop", "model", "Prompt", "enum", {
    values: ["auto", "true", "false"],
    effect: "session",
    fallback: "auto",
  }),
  f("agent.verify_guidance", "Verify guidance", "model", "Prompt", "boolean", {
    effect: "session",
    fallback: true,
  }),
  f("agent.environment_probe", "Environment probe", "model", "Prompt", "boolean", {
    effect: "session",
    fallback: true,
  }),
  f("agent.coding_context", "Coding context", "model", "Prompt", "enum", {
    values: ["auto", "on", "off"],
    effect: "session",
    fallback: "auto",
  }),
  f("agent.image_input_mode", "Image input mode", "model", "Vision", "enum", {
    values: ["auto", "native", "text"],
    effect: "session",
    fallback: "auto",
  }),
  f("auxiliary.compression.model", "Compression model", "model", "Prompt", "text", {
    effect: "session",
    fallback: "",
  }),
  f("auxiliary.compression.provider", "Compression provider", "model", "Prompt", "text", {
    effect: "session",
    fallback: "",
  }),
  f("delegation.model", "Delegation model", "model", "Advisor", "text", {
    effect: "session",
    fallback: "",
  }),
  f("delegation.provider", "Delegation provider", "model", "Advisor", "text", {
    effect: "session",
    fallback: "",
  }),
  f("delegation.reasoning_effort", "Delegation reasoning", "model", "Advisor", "text", {
    effect: "session",
    fallback: "",
  }),

  // ── interaction ← approvals + busy input + STT ──
  f("approvals.mode", "Approval mode", "interaction", "Approvals", "enum", {
    values: ["smart", "manual", "ask", "yolo", "off", "deny"],
    fallback: "smart",
  }),
  f("approvals.timeout", "Approval timeout (s)", "interaction", "Approvals", "number", { fallback: 60 }),
  f("approvals.cron_mode", "Cron approval mode", "interaction", "Approvals", "enum", {
    values: ["deny", "smart", "manual", "off", "yolo"],
    fallback: "deny",
  }),
  f("approvals.mcp_reload_confirm", "Confirm MCP reload", "interaction", "Approvals", "boolean", {
    fallback: true,
  }),
  f("approvals.destructive_slash_confirm", "Confirm destructive slash", "interaction", "Approvals", "boolean", {
    fallback: true,
  }),
  f("display.busy_input_mode", "Busy input mode", "interaction", "Input", "enum", {
    values: ["queue", "steer", "interrupt"],
    fallback: "interrupt",
  }),
  f("display.busy_steer_ack_enabled", "Steer ack", "interaction", "Input", "boolean", { fallback: true }),
  f("agent.clarify_timeout", "Clarify timeout (s)", "interaction", "Input", "number", {
    effect: "session",
    fallback: 600,
  }),
  f("agent.gateway_timeout", "Gateway timeout (s)", "interaction", "Agent", "number", {
    effect: "session",
    fallback: 1800,
  }),
  f("agent.gateway_timeout_warning", "Gateway timeout warning (s)", "interaction", "Agent", "number", {
    effect: "session",
    fallback: 900,
  }),
  f("agent.gateway_notify_interval", "Still-working notify (s)", "interaction", "Notifications", "number", {
    effect: "session",
    fallback: 180,
  }),
  f("stt.enabled", "STT enabled", "interaction", "Speech", "boolean", { fallback: false }),
  f("stt.provider", "STT provider", "interaction", "Speech", "text", { fallback: "" }),
  f("stt.echo_transcripts", "Echo STT transcripts", "interaction", "Speech", "boolean", { fallback: false }),

  // ── context ← compression ──
  f("compression.enabled", "Compression enabled", "context", "Compaction", "boolean", { fallback: true }),
  f("compression.threshold", "Threshold", "context", "Compaction", "number", { fallback: 0.5 }),
  f("compression.target_ratio", "Target ratio", "context", "Compaction", "number", { fallback: 0.2 }),
  f("compression.protect_last_n", "Protect last N", "context", "Compaction", "number", { fallback: 20 }),
  f("compression.protect_first_n", "Protect first N", "context", "Compaction", "number", { fallback: 3 }),
  f("compression.hygiene_hard_message_limit", "Hygiene hard limit", "context", "Compaction", "number", {
    fallback: 400,
  }),
  f("compression.in_place", "In-place compression", "context", "Compaction", "boolean", { fallback: true }),
  f("compression.abort_on_summary_failure", "Abort on summary failure", "context", "Compaction", "boolean", {
    fallback: false,
  }),
  f("timezone", "Timezone", "context", "General", "text", { fallback: "America/New_York" }),

  // ── memory ──
  f("memory.memory_enabled", "Memory enabled", "memory", "General", "boolean", {
    effect: "session",
    fallback: true,
  }),
  f("memory.user_profile_enabled", "User profile enabled", "memory", "General", "boolean", {
    effect: "session",
    fallback: true,
  }),
  f("memory.memory_char_limit", "MEMORY.md char limit", "memory", "General", "number", {
    effect: "session",
    fallback: 2200,
  }),
  f("memory.user_char_limit", "USER.md char limit", "memory", "General", "number", {
    effect: "session",
    fallback: 1375,
  }),
  f("memory.provider", "Memory provider", "memory", "General", "text", { effect: "session", fallback: "" }),
  f("display.memory_notifications", "Memory notifications", "memory", "General", "boolean", {
    fallback: true,
  }),

  // ── shell ← terminal ──
  f("terminal.backend", "Backend", "shell", "Bash", "enum", {
    values: ["local", "docker", "ssh", "modal", "daytona", "singularity", "vercel_sandbox"],
    effect: "restart",
    fallback: "local",
  }),
  f("terminal.timeout", "Timeout (s)", "shell", "Bash", "number", { effect: "restart", fallback: 180 }),
  f("terminal.cwd", "Working directory", "shell", "Bash", "text", { effect: "restart", fallback: "." }),
  f("terminal.persistent_shell", "Persistent shell", "shell", "Bash", "boolean", {
    effect: "restart",
    fallback: false,
  }),
  f("terminal.auto_source_bashrc", "Auto-source bashrc", "shell", "Bash", "boolean", {
    effect: "restart",
    fallback: true,
  }),
  f("terminal.container_memory", "Container memory (MB)", "shell", "Bash", "number", {
    effect: "restart",
    fallback: 5120,
  }),
  f("terminal.docker_image", "Docker image", "shell", "Bash", "text", { effect: "restart", fallback: "" }),

  // ── tools ← browser + skills ──
  f("browser.engine", "Browser engine", "tools", "Grep & Browser", "text", { fallback: "" }),
  f("browser.cdp_url", "CDP URL", "tools", "Grep & Browser", "text", { fallback: "" }),
  f("browser.command_timeout", "Browser command timeout", "tools", "Grep & Browser", "number", {
    fallback: 30,
  }),
  f("browser.allow_private_urls", "Allow private URLs", "tools", "Grep & Browser", "boolean", {
    fallback: false,
  }),
  f("browser.record_sessions", "Record browser sessions", "tools", "Grep & Browser", "boolean", {
    fallback: false,
  }),
  f("skills.guard_agent_created", "Guard agent-created skills", "tools", "Discovery & MCP", "boolean", {
    fallback: true,
  }),
  f("skills.write_approval", "Skill write approval", "tools", "Discovery & MCP", "boolean", {
    fallback: true,
  }),
  f("skills.inline_shell", "Skills inline shell", "tools", "Discovery & MCP", "boolean", { fallback: false }),
  f("skills.inline_shell_timeout", "Inline shell timeout", "tools", "Discovery & MCP", "number", {
    fallback: 30,
  }),

  // ── tasks ← delegation / kanban / cron ──
  f("delegation.max_concurrent_children", "Max concurrent children", "tasks", "Subagents", "number", {
    effect: "session",
    fallback: 3,
  }),
  f("delegation.max_spawn_depth", "Max spawn depth", "tasks", "Subagents", "number", {
    effect: "session",
    fallback: 1,
  }),
  f("delegation.orchestrator_enabled", "Orchestrator children", "tasks", "Subagents", "boolean", {
    effect: "session",
    fallback: false,
  }),
  f("delegation.inherit_mcp_toolsets", "Inherit MCP toolsets", "tasks", "Subagents", "boolean", {
    effect: "session",
    fallback: true,
  }),
  f("delegation.subagent_auto_approve", "Subagent auto-approve", "tasks", "Subagents", "boolean", {
    effect: "session",
    fallback: false,
  }),
  f("delegation.child_timeout_seconds", "Child timeout (s)", "tasks", "Subagents", "number", {
    effect: "session",
    fallback: 0,
  }),
  f("kanban.dispatch_in_gateway", "Kanban dispatch in gateway", "tasks", "Modes", "boolean", {
    fallback: true,
  }),
  f("kanban.dispatch_interval_seconds", "Dispatch interval (s)", "tasks", "Modes", "number", {
    fallback: 60,
  }),
  f("kanban.failure_limit", "Kanban failure limit", "tasks", "Modes", "number", { fallback: 2 }),
  f("kanban.default_assignee", "Default assignee", "tasks", "Modes", "text", { fallback: "" }),
  f("kanban.auto_decompose", "Auto decompose", "tasks", "Modes", "boolean", { fallback: false }),
  f("cron.output_retention", "Cron output retention", "tasks", "Modes", "number", { fallback: 50 }),
  f("cron.wrap_response", "Cron wrap response", "tasks", "Modes", "boolean", { fallback: true }),

  // ── providers ← tts/stt + security ──
  f("tts.provider", "TTS provider", "providers", "Services", "enum", {
    values: ["edge", "elevenlabs", "openai", "neutts", "xai", "mistral", "gemini", ""],
    fallback: "",
  }),
  f("tts.openai.voice", "OpenAI TTS voice", "providers", "Services", "text", { fallback: "" }),
  f("tts.edge.voice", "Edge TTS voice", "providers", "Services", "text", { fallback: "" }),
  f("stt.openai.model", "OpenAI STT model", "providers", "Services", "text", { fallback: "whisper-1" }),
  f("stt.local.model", "Local STT model", "providers", "Services", "text", { fallback: "base" }),
  f("security.redact_secrets", "Redact secrets", "providers", "Privacy", "boolean", { fallback: true }),
  f("privacy.redact_pii", "Redact PII", "providers", "Privacy", "boolean", { fallback: false }),
  f("security.allow_private_urls", "Security allow private URLs", "providers", "Privacy", "boolean", {
    fallback: false,
  }),
  f("model_catalog.enabled", "Model catalog enabled", "providers", "Protocol", "boolean", { fallback: true }),
  f("model_catalog.url", "Model catalog URL", "providers", "Protocol", "text", { fallback: "" }),
]

export function hermesTabsPresent(): OmpSettingsTab[] {
  const s = new Set<OmpSettingsTab>()
  for (const x of HERMES_OMP_FIELD_SPECS) s.add(x.tab)
  return Array.from(s)
}
