// Minimal pi-tui theme (OMP-shape symbols, no coding-agent dependency).

import type { EditorTheme, SelectListTheme, SymbolTheme, TabBarTheme } from "@oh-my-pi/pi-tui"

const id = (s: string) => s
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`
const inv = (s: string) => `\x1b[7m${s}\x1b[0m`

const box = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  teeDown: "┬",
  teeUp: "┴",
  teeLeft: "┤",
  teeRight: "├",
  cross: "┼",
}

export const symbols: SymbolTheme = {
  cursor: "█",
  inputCursor: "▌",
  boxRound: {
    topLeft: box.topLeft,
    topRight: box.topRight,
    bottomLeft: box.bottomLeft,
    bottomRight: box.bottomRight,
    horizontal: box.horizontal,
    vertical: box.vertical,
  },
  boxSharp: { ...box },
  table: { ...box },
  quoteBorder: "│",
  hrChar: "─",
  spinnerFrames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
}

export const selectListTheme: SelectListTheme = {
  selectedPrefix: cyan,
  selectedText: bold,
  description: dim,
  scrollInfo: dim,
  noMatch: dim,
  symbols,
  hovered: inv,
}

export const editorTheme: EditorTheme = {
  borderColor: dim,
  selectList: selectListTheme,
  symbols,
  editorPaddingX: 1,
  hintStyle: dim,
}

export const tabTheme: TabBarTheme = {
  label: dim,
  activeTab: (t) => bold(cyan(t)),
  inactiveTab: dim,
  hint: dim,
  mutedTab: dim,
  hoverTab: inv,
}
