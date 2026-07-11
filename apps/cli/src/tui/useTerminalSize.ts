import { useEffect, useState } from "react"

export interface TerminalSize {
  columns: number
  rows: number
}

// `process.stdout.rows`/`columns` can be `0` or `undefined` when the stream is
// a pipe or a PTY with an unset window size; fall back to sane defaults so the
// layout never collapses to zero height.
const readSize = (): TerminalSize => ({
  columns: process.stdout.columns || 120,
  rows: process.stdout.rows || 30,
})

/** Track the terminal dimensions, updating on resize. */
export const useTerminalSize = (): TerminalSize => {
  const [size, setSize] = useState<TerminalSize>(readSize)

  useEffect(() => {
    const onResize = () => setSize(readSize())
    process.stdout.on("resize", onResize)
    return () => {
      process.stdout.off("resize", onResize)
    }
  }, [])

  return size
}
