import { Box, Text } from "ink"

import type { EntryItem } from "../data"
import { truncate } from "../format"
import { useTheme } from "../theme"

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
  const theme = useTheme()
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
      borderColor={focused ? theme.primary : theme.muted}
      backgroundColor={theme.background}
      paddingX={1}
    >
      <Text bold color={focused ? theme.primary : theme.muted}>
        Entries{entries.length > 0 ? ` (${entries.length})` : ""}
      </Text>

      {loading ? (
        <Text dimColor color={theme.text}>
          Loading…
        </Text>
      ) : entries.length === 0 ? (
        <Text dimColor color={theme.text}>
          No entries.
        </Text>
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
              color={isSelected && !focused ? theme.primary : theme.text}
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
