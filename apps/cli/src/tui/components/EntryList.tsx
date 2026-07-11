import { Box, Text } from "ink"

import type { EntryItem } from "../data"
import { truncate } from "../format"

interface EntryListProps {
  entries: EntryItem[]
  selectedIndex: number
  focused: boolean
  loading: boolean
  width: number
  height: number
}

export const EntryList = ({
  entries,
  selectedIndex,
  focused,
  loading,
  width,
  height,
}: EntryListProps) => {
  // One line per entry (title only), leaving a row for the pane header.
  const visible = Math.max(1, height - 1)
  const start = Math.min(
    Math.max(0, selectedIndex - Math.floor(visible / 2)),
    Math.max(0, entries.length - visible),
  )
  const shown = entries.slice(start, start + visible)
  const innerWidth = width - 4

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height + 2}
      borderStyle="round"
      borderColor={focused ? "cyan" : "gray"}
      paddingX={1}
    >
      <Text bold color={focused ? "cyan" : "gray"}>
        Entries{entries.length > 0 ? ` (${entries.length})` : ""}
      </Text>

      {loading ? (
        <Text dimColor>Loading…</Text>
      ) : entries.length === 0 ? (
        <Text dimColor>No entries.</Text>
      ) : (
        shown.map((entry, offset) => {
          const index = start + offset
          const isSelected = index === selectedIndex

          return (
            <Text
              key={entry.id}
              wrap="truncate-end"
              inverse={isSelected && focused}
              bold={!entry.read}
              dimColor={entry.read}
              color={isSelected && !focused ? "cyan" : undefined}
            >
              {entry.read ? "  " : "● "}
              {truncate(entry.title, innerWidth - 2)}
            </Text>
          )
        })
      )}
    </Box>
  )
}
