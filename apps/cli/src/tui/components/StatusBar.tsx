import { Box, Text } from "ink"

import type { PaneName } from "../App"
import { useTheme } from "../theme"

interface StatusBarProps {
  pane: PaneName
  message?: string
}

const HINTS: Record<PaneName, string> = {
  feeds: "↑↓ move · Enter/→ open feed · R refresh · c theme · ? help · q quit",
  entries: "↑↓ move · Enter/→ read · t translate · o open · r read · R refresh · c theme · ← feeds",
  reader: "↑↓ scroll · Space/- page · t translate · o open · r read · c theme · ← back · q quit",
}

export const StatusBar = ({ pane, message }: StatusBarProps) => {
  const theme = useTheme()
  return (
    <Box paddingX={1} backgroundColor={theme.background}>
      {/* Never wrap: a long error must not push the panes around. */}
      <Text wrap="truncate-end">
        <Text color={theme.primary} bold>
          {pane}
        </Text>
        <Text dimColor color={theme.text}>
          {"  "}
        </Text>
        <Text dimColor color={theme.text}>
          {message ?? HINTS[pane]}
        </Text>
      </Text>
    </Box>
  )
}
