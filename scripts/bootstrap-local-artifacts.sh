#!/usr/bin/env bash
# Pull prebuilt OMP artifacts from a global @oh-my-pi install (or npm pack).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="${OMP_GLOBAL_ROOT:-$HOME/.bun/install/global/node_modules/@oh-my-pi}"
mkdir -p "$ROOT/packages/natives/native"
cp -a "$G/pi-natives-linux-x64/"*.node "$ROOT/packages/natives/native/" 2>/dev/null || {
  echo "missing pi-natives-linux-x64 under $G — run: bun add -g @oh-my-pi/pi-coding-agent" >&2
  exit 1
}
TV="$G/pi-coding-agent/src/export/html/tool-views.generated.js"
if [[ -f "$TV" ]]; then
  cp -a "$TV" "$ROOT/packages/coding-agent/src/export/html/"
fi
echo "bootstrap ok"
