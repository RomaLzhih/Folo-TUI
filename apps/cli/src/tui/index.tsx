import type { FollowClient } from "@follow-app/client-sdk"
import { render } from "ink"

import { App } from "./App"

/** Render the interactive reader and resolve when the user exits. */
export const runTui = async (client: FollowClient): Promise<void> => {
  const instance = render(<App client={client} />, {
    exitOnCtrlC: false,
  })
  await instance.waitUntilExit()
}
