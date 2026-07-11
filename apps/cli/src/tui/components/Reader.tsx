import { Box, Text } from "ink"

import type { EntryItem } from "../data"
import { relativeTime, truncate } from "../format"

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
  const innerWidth = Math.max(8, width - 4)

  const header = entry ? (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan" wrap="truncate-end">
        {truncate(entry.title, innerWidth)}
      </Text>
      <Text dimColor wrap="truncate-end">
        {[entry.feedTitle, entry.author, relativeTime(entry.publishedAt)]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {entry.url ? (
        <Text dimColor wrap="truncate-end">
          {truncate(entry.url, innerWidth)}
        </Text>
      ) : null}
    </Box>
  ) : null

  // AI summary block, pinned at the top of the article. Cap its lines so it
  // never crowds out the body; the body height shrinks by the block's height so
  // total output stays within the pane (avoids overflow → flicker).
  const maxSummary = Math.max(2, Math.floor((height - 6) / 2))
  const shownSummary = summaryLoading ? [] : summaryLines.slice(0, maxSummary)
  const hasSummary = summaryLoading || shownSummary.length > 0
  const summaryBlockHeight = hasSummary ? 1 + (summaryLoading ? 1 : shownSummary.length) + 1 : 0

  const summary = hasSummary ? (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="green" wrap="truncate-end">
        AI 摘要 (中文)
      </Text>
      {summaryLoading ? (
        <Text dimColor>生成摘要中…</Text>
      ) : (
        shownSummary.map((line, index) => (
          <Text key={index} color="green" wrap="truncate-end">
            {line || " "}
          </Text>
        ))
      )}
    </Box>
  ) : null

  const bodyHeight = Math.max(1, height - (entry ? 5 : 1) - summaryBlockHeight)
  const body = lines.slice(scroll, scroll + bodyHeight)
  const hasMore = scroll + bodyHeight < lines.length

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height + 2}
      borderStyle="round"
      borderColor={focused ? "cyan" : "gray"}
      paddingX={1}
    >
      <Text bold color={focused ? "cyan" : "gray"} wrap="truncate-end">
        Reader
        {translated ? "  · 中文对照 (bilingual)" : fallback && entry ? "  (original content)" : ""}
      </Text>

      {!entry ? (
        <Text dimColor>Select an entry and press Enter to read.</Text>
      ) : loading ? (
        <Text dimColor>Loading article…</Text>
      ) : (
        <>
          {header}
          {summary}
          {translated && translating ? (
            <Text dimColor>Translating to Chinese…</Text>
          ) : translated && body.length === 0 ? (
            <Text dimColor>(translation unavailable — may require a paid plan)</Text>
          ) : body.length === 0 ? (
            <Text dimColor>(no readable content)</Text>
          ) : (
            body.map((line, index) => (
              <Text key={scroll + index} wrap="truncate-end">
                {line || " "}
              </Text>
            ))
          )}
          {hasMore ? <Text dimColor>↓ more</Text> : null}
        </>
      )}
    </Box>
  )
}
