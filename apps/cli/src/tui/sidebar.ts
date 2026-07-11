import type { EntryQuery, SubscriptionInfo } from "./data"
import { ARTICLE_VIEW } from "./data"

export type SidebarRow =
  | { kind: "all"; label: string; feedIds: string[] }
  | { kind: "group"; label: string; feedIds: string[]; unread: number }
  | { kind: "feed"; label: string; feedId: string; unread: number; indented: boolean }

const UNCATEGORIZED = "Uncategorized"

interface GroupBucket {
  category: string
  feeds: SubscriptionInfo[]
}

// `flatMap` narrows `feedId` to `string`, which `.filter(Boolean)` cannot.
const collectFeedIds = (items: SubscriptionInfo[]): string[] =>
  items.flatMap((feed) => (feed.feedId ? [feed.feedId] : []))

/**
 * Flatten subscriptions into a navigable sidebar: an "All" row, then each
 * category group followed by its feeds, then any uncategorized feeds.
 */
export const buildSidebar = (subscriptions: SubscriptionInfo[]): SidebarRow[] => {
  const feeds = subscriptions.filter((item) => item.type === "feed" && item.feedId)

  const buckets = new Map<string, GroupBucket>()
  const uncategorized: SubscriptionInfo[] = []

  for (const feed of feeds) {
    if (!feed.category) {
      uncategorized.push(feed)
      continue
    }
    const bucket = buckets.get(feed.category) ?? { category: feed.category, feeds: [] }
    bucket.feeds.push(feed)
    buckets.set(feed.category, bucket)
  }

  const rows: SidebarRow[] = []

  rows.push({ kind: "all", label: "All Articles", feedIds: collectFeedIds(feeds) })

  const sortedGroups = [...buckets.values()].sort((a, b) => a.category.localeCompare(b.category))

  for (const group of sortedGroups) {
    const unread = group.feeds.reduce((sum, feed) => sum + (feed.unread ?? 0), 0)

    rows.push({
      kind: "group",
      label: group.category,
      feedIds: collectFeedIds(group.feeds),
      unread,
    })

    for (const feed of sortByTitle(group.feeds)) {
      if (!feed.feedId) {
        continue
      }
      rows.push({
        kind: "feed",
        label: feed.title,
        feedId: feed.feedId,
        unread: feed.unread ?? 0,
        indented: true,
      })
    }
  }

  if (uncategorized.length > 0) {
    if (sortedGroups.length > 0) {
      const unread = uncategorized.reduce((sum, feed) => sum + (feed.unread ?? 0), 0)
      rows.push({
        kind: "group",
        label: UNCATEGORIZED,
        feedIds: collectFeedIds(uncategorized),
        unread,
      })
    }
    for (const feed of sortByTitle(uncategorized)) {
      if (!feed.feedId) {
        continue
      }
      rows.push({
        kind: "feed",
        label: feed.title,
        feedId: feed.feedId,
        unread: feed.unread ?? 0,
        indented: sortedGroups.length > 0,
      })
    }
  }

  return rows
}

const sortByTitle = (feeds: SubscriptionInfo[]): SubscriptionInfo[] =>
  [...feeds].sort((a, b) => a.title.localeCompare(b.title))

/** Translate a sidebar selection into a timeline query. */
export const rowToQuery = (row: SidebarRow): EntryQuery => {
  const base = { view: ARTICLE_VIEW, limit: 40 }
  switch (row.kind) {
    case "all": {
      return { ...base, feedIdList: row.feedIds }
    }
    case "group": {
      return { ...base, feedIdList: row.feedIds }
    }
    case "feed": {
      return { ...base, feedId: row.feedId }
    }
  }
}
