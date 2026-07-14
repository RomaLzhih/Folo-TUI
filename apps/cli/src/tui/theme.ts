import { createContext, useContext } from "react"

export type ThemeName = "dark" | "light"

// Semantic color roles used across every pane. The accent four each replace a
// hardcoded ANSI name so the two schemes can diverge:
//   primary   ← was "cyan"   focused borders/headers, entry title, active cursor
//   muted     ← was "gray"   idle borders and headers
//   secondary ← was "yellow" feed-group rows and help-screen key labels
//   summary   ← was "green"  the pinned AI summary block
// A terminal app can't change the emulator's own window background, so a real
// light theme must *paint* the cells it draws instead:
//   background  filled on every pane Box (undefined = terminal default)
//   text        body foreground — REQUIRED on a light bg, else plain <Text>
//               inherits the terminal's light default fg and turns invisible
//               (undefined = terminal default, i.e. leave dark-theme text alone)
export interface Theme {
  name: ThemeName
  primary: string
  muted: string
  secondary: string
  summary: string
  text?: string
  background?: string
}

// Hex values, not the 16 ANSI names: those names inherit each terminal's own
// palette (so "green" varies wildly and can glare), whereas hex renders the
// same everywhere and lets chalk downsample gracefully on 256/16-color terms.

// Dark scheme: desaturated accents so long reading sessions on a dark
// background stay easy on the eyes instead of the stock bright cyan/green.
// text/background left undefined so it uses the terminal's own dark colors.
export const darkTheme: Theme = {
  name: "dark",
  primary: "#7dcfff",
  muted: "#6b7280",
  secondary: "#e0af68",
  summary: "#9ece6a",
}

// Light scheme: a soft off-white page with dark text and darker, saturated
// accents that keep contrast — the bright ANSI colors would wash out here.
export const lightTheme: Theme = {
  name: "light",
  primary: "#0550ae",
  muted: "#57606a",
  secondary: "#9a6700",
  summary: "#1a7f37",
  text: "#000000",
  background: "#f6f8fa",
}

export const themes: Record<ThemeName, Theme> = {
  dark: darkTheme,
  light: lightTheme,
}

export const nextThemeName = (name: ThemeName): ThemeName => (name === "dark" ? "light" : "dark")

// Default is dark so components rendered without a provider (e.g. unit tests)
// still get valid colors.
const ThemeContext = createContext<Theme>(darkTheme)

export const ThemeProvider = ThemeContext.Provider

export const useTheme = (): Theme => useContext(ThemeContext)
