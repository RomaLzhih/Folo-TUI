import type { Command } from "commander"

import { createCommandContext } from "../client"
import { readConfig, updateConfig } from "../config"
import { CLIError, normalizeError } from "../output"
import { runTui } from "../tui"

/**
 * Launch the interactive reader from a Commander command (reads global options
 * such as --token/--api-url/--verbose off it). Shared by the `tui` subcommand
 * and the standalone `folo-tui` binary.
 */
export const launchTui = async (command: Command): Promise<void> => {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error("[NOT_A_TTY] The reader needs an interactive terminal. Run it in your shell.")
    process.exitCode = 1
    return
  }

  try {
    const context = await createCommandContext(command, true)
    const config = await readConfig()
    await runTui(context.client, {
      initialTheme: config.theme ?? "dark",
      // Persist the choice, but a failed write must never crash the reader.
      onThemeChange: (theme) => {
        void updateConfig({ theme }).catch(() => {})
      },
    })
  } catch (error) {
    const details = error instanceof CLIError ? error : normalizeError(error)
    console.error(`[${details.code}] ${details.message}`)
    process.exitCode = 1
  }
}

export const registerTuiCommand = (program: Command) => {
  program
    .command("tui")
    .description("Launch the interactive terminal reader (feeds, entries, article view)")
    .action(async function (this: Command) {
      await launchTui(this)
    })
}
