import type { Command } from "commander"

import { createCommandContext } from "../client"
import { CLIError, normalizeError } from "../output"
import { runTui } from "../tui"

export const registerTuiCommand = (program: Command) => {
  program
    .command("tui")
    .description("Launch the interactive terminal reader (feeds, entries, article view)")
    .action(async function (this: Command) {
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        console.error(
          "[NOT_A_TTY] `folo tui` needs an interactive terminal. Run it directly in your shell.",
        )
        process.exitCode = 1
        return
      }

      try {
        const context = await createCommandContext(this, true)
        await runTui(context.client)
      } catch (error) {
        const details = error instanceof CLIError ? error : normalizeError(error)
        console.error(`[${details.code}] ${details.message}`)
        process.exitCode = 1
      }
    })
}
