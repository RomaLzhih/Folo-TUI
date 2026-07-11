import { Box, Text } from "ink"

import { truncate } from "../format"
import type { SidebarRow } from "../sidebar"

interface FeedListProps {
  rows: SidebarRow[]
  selectedIndex: number
  activeIndex: number
  focused: boolean
  width: number
  height: number
}

const rowLabel = (row: SidebarRow): string => {
  if (row.kind === "feed") {
    return `${row.indented ? "  " : ""}${row.label}`
  }
  if (row.kind === "group") {
    return row.label
  }
  return row.label
}

const unreadOf = (row: SidebarRow): number =>
  row.kind === "all" ? 0 : row.kind === "group" ? row.unread : row.unread

export const FeedList = ({
  rows,
  selectedIndex,
  activeIndex,
  focused,
  width,
  height,
}: FeedListProps) => {
  // Keep the cursor in view within the available height.
  const visible = Math.max(1, height)
  const start = Math.min(
    Math.max(0, selectedIndex - Math.floor(visible / 2)),
    Math.max(0, rows.length - visible),
  )
  const shown = rows.slice(start, start + visible)

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
        Feeds
      </Text>
      {shown.map((row, offset) => {
        const index = start + offset
        const isSelected = index === selectedIndex
        const isActive = index === activeIndex
        const unread = unreadOf(row)
        const label = truncate(rowLabel(row), width - 6)

        return (
          <Text
            key={index}
            wrap="truncate-end"
            color={row.kind === "group" ? "yellow" : undefined}
            bold={row.kind !== "feed"}
            inverse={isSelected && focused}
            dimColor={!focused && !isActive}
          >
            {isActive ? "› " : "  "}
            {label}
            {unread > 0 ? ` (${unread})` : ""}
          </Text>
        )
      })}
    </Box>
  )
}
