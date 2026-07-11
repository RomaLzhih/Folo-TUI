import { Command } from "commander"

import packageJSON from "../package.json"
import { defaultApiURL } from "./client"
import { launchTui } from "./commands/tui"
import { normalizeError } from "./output"

// Standalone entry for the `folo-tui` binary: launches the interactive reader
// directly, equivalent to `folo tui`.
const program = new Command()

program
  .name("folo-tui")
  .description("Folo interactive terminal reader")
  .version(packageJSON.version)
  .option("--api-url <url>", `API base URL (default: ${defaultApiURL})`)
  .option("--token <token>", "Override stored token")
  .option("--verbose", "Enable verbose request/response logging", false)
  .action(async function (this: Command) {
    await launchTui(this)
  })

try {
  await program.parseAsync(process.argv)
} catch (error) {
  const details = normalizeError(error)
  console.error(`[${details.code}] ${details.message}`)
  process.exitCode = 1
}
