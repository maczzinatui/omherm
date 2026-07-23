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
  // Product settings filter (SETTINGS_REMAP) — set unless operator forces raw OMP schema
  if (process.env.MESHINA_TUI_RAW_OMP_SETTINGS !== "1") {
    process.env.MESHINA_TUI_PRODUCT_SETTINGS = process.env.MESHINA_TUI_PRODUCT_SETTINGS || "1"
  }
  process.title = PRODUCT_CLI
}
