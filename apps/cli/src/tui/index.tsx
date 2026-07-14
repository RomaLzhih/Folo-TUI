import type { FollowClient } from "@follow-app/client-sdk"
import { render } from "ink"

import { App } from "./App"
import type { ThemeName } from "./theme"

export interface RunTuiOptions {
  /** Colorscheme to start in (persisted preference); defaults to dark. */
  initialTheme?: ThemeName
  /** Called when the user toggles the colorscheme, so the caller can persist it. */
  onThemeChange?: (name: ThemeName) => void
}

/** Render the interactive reader and resolve when the user exits. */
export const runTui = async (client: FollowClient, options: RunTuiOptions = {}): Promise<void> => {
  const instance = render(
    <App
      client={client}
      initialTheme={options.initialTheme}
      onThemeChange={options.onThemeChange}
    />,
    {
      exitOnCtrlC: false,
    },
  )
  await instance.waitUntilExit()
}
