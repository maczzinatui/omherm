export { HermesGateway, hermesAgentRoot, gatewayUrl } from "./client.ts"
export type {
  GatewayEvent,
  SessionInfo,
  UiEvent,
  Usage,
  SessionCreateResponse,
  LeanProductHandshake,
} from "./types.ts"
export { parseLeanPipelineText } from "./types.ts"
export { formatPipelineStage } from "./session-event-map.ts"
export { mapGatewayToUi, asGatewayEvent } from "./types.ts"
export {
  GatewayTurnMapper,
  parsePersistedToolResult,
  type MappedAgentSessionEvent,
  type MappedAssistantMessage,
  type MappedAssistantMessageEvent,
  type PersistedToolResult,
} from "./session-event-map.ts"
export {
  createProfilePort,
  profilePort,
  type ProfilePort,
  type ProfilePortOptions,
} from "./profile-port.ts"
export type { ProfileInfo, DistributionSummary } from "./profile-dto.ts"
export {
  profileNameFromHome,
  hermesRootFromHome,
  validateProfileName,
} from "./profile-dto.ts"
export { listProfiles, defaultHermesHome } from "./profile-fs.ts"
export {
  createHermesConfigPort,
  hermesConfigPort,
  resetHermesConfigPortForTests,
  HERMES_CONFIG_FIELDS,
  HERMES_CONFIG_KEYS,
  type HermesConfigPort,
  type HermesConfigField,
  type OmpSettingsTab,
} from "./hermes-config-port.ts"
export {
  HERMES_OMP_FIELD_SPECS,
  hermesTabsPresent,
} from "./hermes-omp-settings-map.ts"
export {
  loadHermesModelCatalog,
  applyHermesModelGlobal,
  applyHermesModelLive,
  formatHermesModelSlash,
  bareModelId,
  isHermesModelSwitchFailureText,
  flattenCatalog,
  pickNextHermesModelRow,
  type HermesModelCatalog,
  type HermesModelRow,
  type ApplyHermesModelLiveResult,
} from "./hermes-model-catalog.ts"
export {
  RPC_ALIAS,
  routeConfigKey,
  writeConfigLane,
  toCliString,
  type ConfigGw,
  type ConfigDiff,
  type ConfigWriteResult,
  type ConfigLane,
} from "./config-lane.ts"
export {
  buildHermesSlashCatalog,
  listHermesSkills,
  HERMES_BUILTIN_SLASH,
  type HermesSlashEntry,
} from "./hermes-slash-catalog.ts"
export {
  HermesBrain,
  isHermesBrainEnabled,
  APPROVAL_LABELS,
  type HermesBrainEvent,
  type HermesBrainListener,
  type HermesBrainOptions,
  type HermesDialogHost,
} from "./hermes-brain.ts"
export {
  createCockpitSession,
  isCockpitSession,
  type CockpitSession,
} from "./cockpit-session.ts"
export {
	parseHermesSlashLine,
	routeHermesSlash,
	type HermesSlashDeepLink,
	type HermesPortDeepLink,
} from "./hermes-slash-router.ts"
export {
  createKanbanPort,
  kanbanPort,
  parseKanbanListOutput,
  parseKanbanListJson,
  parseKanbanBoardsList,
  mapKanbanJsonRow,
  formatKanbanLabel,
  formatKanbanDescription,
  type KanbanPort,
  type KanbanTask,
  type KanbanDetail,
  type KanbanCreateInput,
  type KanbanBoard,
} from "./kanban-port.ts"
export {
  createCronPort,
  cronPort,
  parseCronListOutput,
  parseCronStatusOutput,
  parseCronRunsOutput,
  normalizeCronJob,
  formatCronJobLabel,
  formatCronJobDescription,
  formatCronRunLine,
  type CronPort,
  type CronJob,
  type CronSchedulerStatus,
  type CronRunRow,
  type CronCreateInput,
  type CronEditInput,
} from "./cron-port.ts"
export {
  createSkillsPort,
  skillsPort,
  rebindSkillsPort,
  parseSkillsListOutput,
  parseSkillsListRow,
  formatSkillLabel,
  formatSkillDescription,
  type Skill,
  type SkillPort,
  type SkillSource,
  type SkillTrust,
  type SkillsGateway,
} from "./skills-port.ts"
export {
  createLeanProfilePort,
  createLibraryPort,
  bindLeanProfileGateway,
  type LeanProfilePort,
  type LeanProfileState,
  type LeanProfileMeta,
  type LibraryPort,
  type GatewayRequester,
} from "./lean-profile-port.ts"
export {
  createToolsPort,
  toolsPort,
  rebindToolsPort,
  parseToolsListOutput,
  parseToolRow,
  formatToolLabel,
  formatToolDescription,
  type Tool,
  type ToolPort,
  type ToolPlatform,
  type ToolStatus,
  type ToolKind,
  type ToolsGateway,
} from "./tools-port.ts"

import type { GatewayRequester } from "./lean-profile-port.ts"
import { bindLeanProfileGateway } from "./lean-profile-port.ts"
import { rebindSkillsPort } from "./skills-port.ts"
import { rebindToolsPort } from "./tools-port.ts"

/** S2: point skills/tools/lean/library ports at live tui_gateway RPC. */
export function bindSkillsToolsGateway(gw?: GatewayRequester | null): void {
  rebindSkillsPort(gw ?? null)
  rebindToolsPort(gw ?? null)
  bindLeanProfileGateway(gw ?? null)
}
export {
  createMemoryPort,
  memoryPort,
  parseMemoryStatusOutput,
  formatMemoryLabel,
  formatMemoryDescription,
  type MemoryFile,
  type MemoryPort,
  type MemoryStatus,
  type MemoryKind,
} from "./memory-port.ts"
export {
  createSessionsPort,
  sessionsPort,
  parseSessionsListOutput,
  type SessionsPort,
  type HermesSessionRow,
} from "./sessions-port.ts"
