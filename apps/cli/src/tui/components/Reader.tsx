import { Box, Text } from "ink"

import type { EntryItem } from "../data"
import { relativeTime, truncate } from "../format"
import { useTheme } from "../theme"

interface ReaderProps {
  entry: EntryItem | null
  lines: string[]
  scroll: number
  loading: boolean
  fallback: boolean
  translated: boolean
  translating: boolean
  summaryLines: string[]
  summaryLoading: boolean
  focused: boolean
  width: number
  height: number
}

export interface ReaderLayout {
  /** Max summary lines to show before the block is capped. */
  maxSummary: number
  /** Rows the pinned AI-summary block occupies (0 when absent). */
  summaryBlockHeight: number
  /** Rows left for the article body once header + summary are subtracted. */
  bodyHeight: number
}

// Vertical layout of the reader pane. The AI summary is pinned above the body,
// so the body shrinks by the summary block's height. App and Reader MUST derive
// their body height from this same function — otherwise the pane's paging math
// (in App) and the visible body (here) disagree and Space/PgDn skip the lines
// hidden behind the summary.
export const computeReaderLayout = (
  height: number,
  hasEntry: boolean,
  summaryLines: string[],
  summaryLoading: boolean,
): ReaderLayout => {
  // Cap the summary so it never crowds out the body.
  const maxSummary = Math.max(2, Math.floor((height - 6) / 2))
  const shownSummary = summaryLoading ? 0 : Math.min(summaryLines.length, maxSummary)
  const hasSummary = summaryLoading || shownSummary > 0
  // Block = 1 heading row + content rows (loading placeholder = 1) + 1 margin.
  const summaryBlockHeight = hasSummary ? 1 + (summaryLoading ? 1 : shownSummary) + 1 : 0
  const bodyHeight = Math.max(1, height - (hasEntry ? 5 : 1) - summaryBlockHeight)
  return { maxSummary, summaryBlockHeight, bodyHeight }
}

export const Reader = ({
  entry,
  lines,
  scroll,
  loading,
  fallback,
  translated,
  translating,
  summaryLines,
  summaryLoading,
  focused,
  width,
  height,
}: ReaderProps) => {
  const theme = useTheme()
  const innerWidth = Math.max(8, width - 4)
  const { maxSummary, bodyHeight } = computeReaderLayout(
    height,
    Boolean(entry),
    summaryLines,
    summaryLoading,
  )

  const header = entry ? (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={theme.primary} wrap="truncate-end">
        {truncate(entry.title, innerWidth)}
      </Text>
      <Text dimColor color={theme.text} wrap="truncate-end">
        {[entry.feedTitle, entry.author, relativeTime(entry.publishedAt)]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {entry.url ? (
        <Text dimColor color={theme.text} wrap="truncate-end">
          {truncate(entry.url, innerWidth)}
        </Text>
      ) : null}
    </Box>
  ) : null

  // AI summary block, pinned at the top of the article (layout via
  // computeReaderLayout above so App's paging math stays in sync).
  const shownSummary = summaryLoading ? [] : summaryLines.slice(0, maxSummary)
  const hasSummary = summaryLoading || shownSummary.length > 0

  const summary = hasSummary ? (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={theme.summary} wrap="truncate-end">
        AI 摘要 (中文)
      </Text>
      {summaryLoading ? (
        <Text dimColor color={theme.text}>
          生成摘要中…
        </Text>
      ) : (
        shownSummary.map((line, index) => (
          <Text key={index} color={theme.summary} wrap="truncate-end">
            {line || " "}
          </Text>
        ))
      )}
    </Box>
  ) : null

  const body = lines.slice(scroll, scroll + bodyHeight)
  const hasMore = scroll + bodyHeight < lines.length

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height + 2}
      borderStyle="round"
      borderColor={focused ? theme.primary : theme.muted}
      backgroundColor={theme.background}
      paddingX={1}
    >
      <Text bold color={focused ? theme.primary : theme.muted} wrap="truncate-end">
        Reader
        {translated ? "  · 中文对照 (bilingual)" : fallback && entry ? "  (original content)" : ""}
      </Text>

      {!entry ? (
        <Text dimColor color={theme.text}>
          Select an entry and press Enter to read.
        </Text>
      ) : loading ? (
        <Text dimColor color={theme.text}>
          Loading article…
        </Text>
      ) : (
        <>
          {header}
          {summary}
          {translated && translating ? (
            <Text dimColor color={theme.text}>
              Translating to Chinese…
            </Text>
          ) : translated && body.length === 0 ? (
            <Text dimColor color={theme.text}>
              (translation unavailable — may require a paid plan)
            </Text>
          ) : body.length === 0 ? (
            <Text dimColor color={theme.text}>
              (no readable content)
            </Text>
          ) : (
            body.map((line, index) => (
              <Text key={scroll + index} color={theme.text} wrap="truncate-end">
                {line || " "}
              </Text>
            ))
          )}
          {hasMore ? (
            <Text dimColor color={theme.text}>
              ↓ more
            </Text>
          ) : null}
        </>
      )}
    </Box>
  )
}
