import type { FollowClient } from "@follow-app/client-sdk"
import { Box, Text, useApp, useInput } from "ink"
import { useEffect, useMemo, useState } from "react"

import { EntryList } from "./components/EntryList"
import { FeedList } from "./components/FeedList"
import { Reader } from "./components/Reader"
import { StatusBar } from "./components/StatusBar"
import type { EntryItem, TranslationTarget } from "./data"
import {
  fetchEntries,
  fetchReadable,
  fetchSubscriptions,
  fetchSummary,
  fetchTranslation,
  markEntryRead,
  markEntryUnread,
} from "./data"
import { htmlToText, wrapText } from "./format"
import { openUrl } from "./openUrl"
import type { SidebarRow } from "./sidebar"
import { buildSidebar, rowToQuery } from "./sidebar"
import { useTerminalSize } from "./useTerminalSize"

export type PaneName = "feeds" | "entries" | "reader"

interface AppProps {
  client: FollowClient
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const errorMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : "Something went wrong"
  // API errors can be verbose and multi-line; keep the status bar to one line.
  const firstLine = raw.split("\n")[0]?.trim() || "Something went wrong"
  return firstLine.length > 160 ? `${firstLine.slice(0, 159)}…` : firstLine
}

export const App = ({ client }: AppProps) => {
  const { exit } = useApp()
  const { columns, rows: termRows } = useTerminalSize()

  const [rows, setRows] = useState<SidebarRow[]>([])
  const [sidebarSel, setSidebarSel] = useState(0)
  const [sidebarActive, setSidebarActive] = useState(0)

  const [entries, setEntries] = useState<EntryItem[]>([])
  const [entrySel, setEntrySel] = useState(0)
  const [entriesLoading, setEntriesLoading] = useState(true)

  const [activeEntry, setActiveEntry] = useState<EntryItem | null>(null)
  const [readerText, setReaderText] = useState<string | null>(null)
  const [readerFallback, setReaderFallback] = useState(false)
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerScroll, setReaderScroll] = useState(0)

  // Bilingual translation of the open entry (original paragraph + translation).
  const [translated, setTranslated] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [translationLoading, setTranslationLoading] = useState(false)

  // AI summary (Chinese) shown at the top of the reader.
  const [summaryText, setSummaryText] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [pane, setPane] = useState<PaneName>("feeds")
  const [message, setMessage] = useState<string | undefined>()
  const [showHelp, setShowHelp] = useState(false)

  const sidebarWidth = clamp(Math.floor(columns * 0.22), 20, 30)
  const entryWidth = clamp(Math.floor(columns * 0.34), 30, 52)
  const readerWidth = Math.max(24, columns - sidebarWidth - entryWidth)
  // Keep total output one row shorter than the terminal. If it exactly fills
  // (or exceeds) the height, Ink falls back to clearing the whole screen every
  // frame, which flickers badly while scrolling. Pane box = paneHeight + 2,
  // plus the status bar row, must stay < termRows.
  const paneHeight = Math.max(6, termRows - 4)
  const readerInnerWidth = Math.max(8, readerWidth - 4)
  const readerBodyHeight = Math.max(1, paneHeight - 5)

  // Show the translated (bilingual) text when translation is toggled on.
  const activeReaderText = translated ? translatedText : readerText
  const readerLines = useMemo(
    () => (activeReaderText ? wrapText(activeReaderText, readerInnerWidth) : []),
    [activeReaderText, readerInnerWidth],
  )
  const summaryLines = useMemo(
    () => (summaryText ? wrapText(summaryText, readerInnerWidth) : []),
    [summaryText, readerInnerWidth],
  )

  const loadEntriesFor = async (index: number, sidebar: SidebarRow[] = rows) => {
    const row = sidebar[index]
    if (!row) {
      return
    }
    setSidebarActive(index)
    setPane("entries")
    setEntriesLoading(true)
    setMessage(undefined)
    try {
      const next = await fetchEntries(client, rowToQuery(row))
      setEntries(next)
      setEntrySel(0)
    } catch (error) {
      setEntries([])
      setMessage(errorMessage(error))
    } finally {
      setEntriesLoading(false)
    }
  }

  const loadTranslation = (entry: EntryItem, target: TranslationTarget) => {
    setTranslationLoading(true)
    fetchTranslation(client, entry.id, target)
      .then((html) => setTranslatedText(htmlToText(html)))
      .catch((error) => {
        setTranslatedText("")
        setMessage(errorMessage(error))
      })
      .finally(() => setTranslationLoading(false))
  }

  const loadSummary = (entry: EntryItem, target: TranslationTarget) => {
    setSummaryLoading(true)
    fetchSummary(client, entry.id, target)
      .then((text) => setSummaryText(text))
      .catch(() => setSummaryText(""))
      .finally(() => setSummaryLoading(false))
  }

  const openEntry = async (index: number, autoTranslate = false) => {
    const entry = entries[index]
    if (!entry) {
      return
    }
    setActiveEntry(entry)
    setPane("reader")
    setReaderScroll(0)
    setReaderText(null)
    setReaderLoading(true)
    // Reset translation and summary for the newly opened entry.
    setTranslatedText(null)
    setTranslated(autoTranslate)
    setTranslationLoading(autoTranslate)
    setSummaryText(null)
    setSummaryLoading(true)

    if (!entry.read) {
      setEntries((current) =>
        current.map((item) => (item.id === entry.id ? { ...item, read: true } : item)),
      )
      markEntryRead(client, entry.id).catch(() => {})
    }

    // Translate the field that is actually shown: readability when available,
    // otherwise the raw content. Sequenced after the readable fetch so the
    // server has generated readabilityContent by the time we request it.
    let target: TranslationTarget = "readabilityContent"
    try {
      const readable = await fetchReadable(client, entry.id)
      setReaderText(htmlToText(readable.html))
      setReaderFallback(readable.fallback)
      target = readable.fallback ? "content" : "readabilityContent"
    } catch (error) {
      setReaderText("")
      setReaderFallback(true)
      target = "content"
      setMessage(errorMessage(error))
    } finally {
      setReaderLoading(false)
    }

    if (autoTranslate) {
      loadTranslation(entry, target)
    }
    // Always show the Chinese AI summary at the top of the reader.
    loadSummary(entry, target)
  }

  const toggleTranslate = () => {
    if (!activeEntry) {
      return
    }
    setReaderScroll(0)
    if (translated) {
      setTranslated(false)
      return
    }
    setTranslated(true)
    // Fetch once and cache for the current entry, matching the shown field.
    if (translatedText === null && !translationLoading) {
      loadTranslation(activeEntry, readerFallback ? "content" : "readabilityContent")
    }
  }

  const toggleRead = (entry: EntryItem | null) => {
    if (!entry) {
      return
    }
    const nextRead = !entry.read
    setEntries((current) =>
      current.map((item) => (item.id === entry.id ? { ...item, read: nextRead } : item)),
    )
    setActiveEntry((current) =>
      current && current.id === entry.id ? { ...current, read: nextRead } : current,
    )
    const request = nextRead ? markEntryRead : markEntryUnread
    request(client, entry.id).catch(() => {})
  }

  // Initial load: subscriptions -> sidebar -> first timeline.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const subscriptions = await fetchSubscriptions(client)
        if (cancelled) {
          return
        }
        const sidebar = buildSidebar(subscriptions)
        setRows(sidebar)
        if (sidebar.length > 0) {
          await loadEntriesFor(0, sidebar)
          setPane("feeds")
        } else {
          setEntriesLoading(false)
          setMessage("No subscriptions found.")
        }
      } catch (error) {
        if (!cancelled) {
          setEntriesLoading(false)
          setMessage(errorMessage(error))
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit()
      return
    }
    if (input === "q") {
      exit()
      return
    }
    if (input === "?") {
      setShowHelp((value) => !value)
      return
    }
    if (showHelp) {
      setShowHelp(false)
      return
    }

    const up = key.upArrow || input === "k"
    const down = key.downArrow || input === "j"
    const forward = key.return || key.rightArrow || input === "l"
    const back = key.leftArrow || key.escape || input === "h"

    if (input === "r") {
      const target = pane === "reader" ? activeEntry : (entries[entrySel] ?? null)
      toggleRead(target)
      return
    }

    if (input === "t") {
      if (pane === "reader" && activeEntry) {
        toggleTranslate()
      } else if (pane === "entries") {
        // Open the selected entry and translate it immediately.
        void openEntry(entrySel, true)
      }
      return
    }

    if (input === "o") {
      const target = pane === "reader" ? activeEntry : (entries[entrySel] ?? null)
      if (openUrl(target?.url)) {
        setMessage("Opened link in browser.")
      } else {
        setMessage("No link to open for this entry.")
      }
      return
    }

    if (pane === "feeds") {
      if (up) {
        setSidebarSel((value) => clamp(value - 1, 0, rows.length - 1))
      } else if (down) {
        setSidebarSel((value) => clamp(value + 1, 0, rows.length - 1))
      } else if (forward) {
        void loadEntriesFor(sidebarSel)
      }
      return
    }

    if (pane === "entries") {
      if (up) {
        setEntrySel((value) => clamp(value - 1, 0, Math.max(0, entries.length - 1)))
      } else if (down) {
        setEntrySel((value) => clamp(value + 1, 0, Math.max(0, entries.length - 1)))
      } else if (forward) {
        void openEntry(entrySel)
      } else if (back) {
        setPane("feeds")
      }
      return
    }

    // pane === "reader"
    if (up) {
      setReaderScroll((value) => clamp(value - 1, 0, Math.max(0, readerLines.length - 1)))
    } else if (down) {
      const maxScroll = Math.max(0, readerLines.length - readerBodyHeight)
      setReaderScroll((value) => clamp(value + 1, 0, maxScroll))
    } else if (key.pageDown || input === " ") {
      const maxScroll = Math.max(0, readerLines.length - readerBodyHeight)
      setReaderScroll((value) => clamp(value + readerBodyHeight, 0, maxScroll))
    } else if (key.pageUp) {
      setReaderScroll((value) => clamp(value - readerBodyHeight, 0, readerLines.length))
    } else if (back) {
      setPane("entries")
    }
  })

  if (showHelp) {
    return <HelpScreen height={paneHeight} />
  }

  return (
    // No fixed height: let the content size the box so total output stays
    // below termRows and Ink can update in place instead of clearing.
    <Box flexDirection="column">
      <Box>
        <FeedList
          rows={rows}
          selectedIndex={sidebarSel}
          activeIndex={sidebarActive}
          focused={pane === "feeds"}
          width={sidebarWidth}
          height={paneHeight}
        />
        <EntryList
          entries={entries}
          selectedIndex={entrySel}
          focused={pane === "entries"}
          loading={entriesLoading}
          width={entryWidth}
          height={paneHeight}
        />
        <Reader
          entry={activeEntry}
          lines={readerLines}
          scroll={readerScroll}
          loading={readerLoading}
          fallback={readerFallback}
          translated={translated}
          translating={translationLoading}
          summaryLines={summaryLines}
          summaryLoading={summaryLoading}
          focused={pane === "reader"}
          width={readerWidth}
          height={paneHeight}
        />
      </Box>
      <StatusBar pane={pane} message={message} />
    </Box>
  )
}

const HelpScreen = ({ height }: { height: number }) => (
  <Box
    flexDirection="column"
    height={height + 3}
    borderStyle="round"
    borderColor="cyan"
    paddingX={2}
    paddingY={1}
  >
    <Text bold color="cyan">
      Folo TUI — keyboard shortcuts
    </Text>
    <Text> </Text>
    <Text>
      <Text color="yellow">↑ / ↓ , j / k</Text> Move within the focused pane
    </Text>
    <Text>
      <Text color="yellow">Enter / → / l</Text> Open feed, then open entry to read
    </Text>
    <Text>
      <Text color="yellow">← / h / Esc </Text> Go back to the previous pane
    </Text>
    <Text>
      <Text color="yellow">Space / PgDn</Text> Page down in the reader
    </Text>
    <Text>
      <Text color="yellow">t </Text> Translate to Chinese (bilingual: original + 中文)
    </Text>
    <Text>
      <Text color="yellow">o </Text> Open the post link in your default browser
    </Text>
    <Text>
      <Text color="yellow">r </Text> Toggle read / unread
    </Text>
    <Text>
      <Text color="yellow">? </Text> Toggle this help
    </Text>
    <Text>
      <Text color="yellow">q / Ctrl+C </Text> Quit
    </Text>
    <Text> </Text>
    <Text dimColor>Press any key to close.</Text>
  </Box>
)
