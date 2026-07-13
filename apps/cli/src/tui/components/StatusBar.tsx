import { Box, Text } from "ink"

import type { PaneName } from "../App"

interface StatusBarProps {
  pane: PaneName
  message?: string
}

const HINTS: Record<PaneName, string> = {
  feeds: "↑↓ move · Enter/→ open feed · R refresh · ? help · q quit",
  entries: "↑↓ move · Enter/→ read · t translate · o open · r read · R refresh · ← feeds · q quit",
  reader: "↑↓ scroll · t translate · o open in browser · r read · ← back · q quit",
}

export const StatusBar = ({ pane, message }: StatusBarProps) => (
  <Box paddingX={1}>
    {/* Never wrap: a long error must not push the panes around. */}
    <Text wrap="truncate-end">
      <Text color="cyan" bold>
        {pane}
      </Text>
      <Text dimColor>{"  "}</Text>
      <Text dimColor>{message ?? HINTS[pane]}</Text>
    </Text>
  </Box>
)
