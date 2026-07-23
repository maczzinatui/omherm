// Hermes product branding for mtui path. Call before any OMP UI import.
// Identity: Hermes. Coat: OMP/pi-tui chrome (internal only).

export const PRODUCT_NAME = "hermes"
export const PRODUCT_CLI = "mtui"
export const PRODUCT_VERSION = process.env.MESHINA_TUI_VERSION || "0.1.0-hermes"
export const PRODUCT_TAGLINE = "Hermes Agent cockpit"

/** Env flags consumed by patched dirs / help. */
export function applyHermesBrandEnv(): void {
  process.env.MESHINA_TUI_BRAND = "hermes"
  process.env.MESHINA_TUI_VERSION = PRODUCT_VERSION
  process.env.OMP_QUIET_BRAND = "1"
  // Do not inherit OMP profile naming in process title
  process.title = PRODUCT_CLI
}
