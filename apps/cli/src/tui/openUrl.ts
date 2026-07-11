import { spawn } from "node:child_process"

/**
 * Open a URL in the OS default browser. Spawns detached with args passed as an
 * array (no shell), and only accepts http(s) links. Returns false when the URL
 * is missing or not openable.
 */
export const openUrl = (url: string | undefined): boolean => {
  if (!url || !/^https?:\/\//i.test(url)) {
    return false
  }

  const { platform } = process
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open"
  const args = platform === "win32" ? ["/c", "start", "", url] : [url]

  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true })
    child.on("error", () => {
      // Swallow spawn errors (e.g. opener not found); the caller shows a hint.
    })
    child.unref()
    return true
  } catch {
    return false
  }
}
