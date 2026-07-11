import type { FollowClient } from "@follow-app/client-sdk"

// The Folo SDK response shapes are broad and evolve over time. To keep the TUI
// resilient and free of `any`, we normalize every API payload into the small,
// explicit interfaces below using the safe `unknown` readers in this file.

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined

const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

const isTrue = (value: unknown): boolean => value === true

/** Article view. The reader focuses on text entries. */
export const ARTICLE_VIEW = 0

export interface SubscriptionInfo {
  type: string
  feedId?: string
  listId?: string
  view: number
  category?: string
  title: string
  unread?: number
}

export interface EntryItem {
  id: string
  title: string
  author?: string
  publishedAt?: string
  feedId?: string
  feedTitle?: string
  url?: string
  read: boolean
}

export interface ReadableEntry {
  html: string
  fallback: boolean
}

const normalizeSubscription = (raw: unknown): SubscriptionInfo | null => {
  const record = asRecord(raw)
  const feed = asRecord(record.feeds)
  const list = asRecord(record.lists)

  const type = str(record.type) ?? (record.listId ? "list" : "feed")
  const feedId = str(record.feedId)
  const listId = str(record.listId)

  // The reader only surfaces feed and list subscriptions.
  if (!feedId && !listId) {
    return null
  }

  const title =
    str(record.title) ?? str(feed.title) ?? str(list.title) ?? feedId ?? listId ?? "Untitled"

  return {
    type,
    feedId,
    listId,
    view: num(record.view) ?? ARTICLE_VIEW,
    category: str(record.category),
    title,
    unread: num(record.unread),
  }
}

const normalizeEntry = (raw: unknown): EntryItem | null => {
  const record = asRecord(raw)
  const entry = asRecord(record.entries)
  const feed = asRecord(record.feeds)

  const id = str(entry.id) ?? str(record.id)
  if (!id) {
    return null
  }

  return {
    id,
    title: str(entry.title) ?? str(entry.description) ?? "(untitled)",
    author: str(entry.author),
    publishedAt: str(entry.publishedAt),
    feedId: str(entry.feedId) ?? str(feed.id),
    feedTitle: str(feed.title),
    url: str(entry.url),
    read: isTrue(record.read) || isTrue(entry.read),
  }
}

export const fetchSubscriptions = async (
  client: FollowClient,
  view: number = ARTICLE_VIEW,
): Promise<SubscriptionInfo[]> => {
  const response = await client.api.subscriptions.get({ view })
  return asArray(asRecord(response).data)
    .map(normalizeSubscription)
    .filter((item): item is SubscriptionInfo => item !== null)
}

export interface EntryQuery {
  feedId?: string
  feedIdList?: string[]
  listId?: string
  view?: number
  limit?: number
}

export const fetchEntries = async (
  client: FollowClient,
  query: EntryQuery,
): Promise<EntryItem[]> => {
  const request: Record<string, unknown> = {
    view: query.view ?? ARTICLE_VIEW,
    limit: query.limit ?? 30,
  }
  if (query.feedId) request.feedId = query.feedId
  if (query.feedIdList && query.feedIdList.length > 0) request.feedIdList = query.feedIdList
  if (query.listId) request.listId = query.listId

  const response = await client.api.entries.list(
    request as Parameters<typeof client.api.entries.list>[0],
  )
  return asArray(asRecord(response).data)
    .map(normalizeEntry)
    .filter((item): item is EntryItem => item !== null)
}

/** Best-effort readable HTML for an entry, preferring the reader-mode content. */
export const fetchReadable = async (client: FollowClient, id: string): Promise<ReadableEntry> => {
  const readability = await client.api.entries
    .readability({ id })
    .then((response) => asRecord(asRecord(response).data))
    .catch(() => ({}) as Record<string, unknown>)

  const readableHtml = str(readability.content) ?? str(readability.readabilityContent)
  if (readableHtml) {
    return { html: readableHtml, fallback: false }
  }

  const detail = await client.api.entries
    .get({ id })
    .then((response) => asRecord(response).data)
    .catch(() => null)

  const detailRecord = asRecord(detail)
  const entry = asRecord(detailRecord.entries)
  const html = str(entry.content) ?? str(detailRecord.content) ?? str(entry.description) ?? ""

  return { html, fallback: true }
}

export const markEntryRead = async (client: FollowClient, id: string): Promise<void> => {
  await client.api.reads.markAsRead({ entryIds: [id] })
}

export const markEntryUnread = async (client: FollowClient, id: string): Promise<void> => {
  await client.api.reads.markAsUnread({ entryId: id })
}

// Folo translates through a streaming (NDJSON) AI endpoint. Each line carries
// the translated fields for one entry id. In "bilingual" mode the returned HTML
// interleaves every source paragraph with its translation.
interface TranslationBatchRequest {
  ids: string[]
  language: string
  fields: string
  mode: "bilingual" | "translation-only"
}

interface SummaryRequest {
  id: string
  language: string
  target: "content" | "readabilityContent"
}

interface AiApi {
  ai: {
    translationBatch: (request: TranslationBatchRequest) => Promise<Response>
    summary: (request: SummaryRequest) => Promise<{ data?: string | null }>
  }
}

const readNdjson = async (response: Response, onLine: (value: unknown) => void): Promise<void> => {
  const emit = (line: string): void => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      onLine(JSON.parse(trimmed))
    } catch {
      // Ignore malformed lines in the stream.
    }
  }

  const { body } = response
  if (!body) {
    for (const line of (await response.text()).split("\n")) emit(line)
    return
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) emit(line)
  }
  emit(buffer)
}

// Translate whichever field the reader is actually showing: the extracted
// `readabilityContent` for reader-mode articles, or the raw `content` otherwise.
// Translating the wrong one yields a stub (e.g. link posts whose `content` is
// just the title) — see RSSNext/Folo#5023.
export type TranslationTarget = "content" | "readabilityContent"

/**
 * Translate an entry into the target language (Chinese by default). Uses
 * bilingual mode so the returned HTML shows each original paragraph followed by
 * its translation. Returns the translated HTML, or an empty string when nothing
 * came back (e.g. the plan lacks translation, or the post is already Chinese).
 */
export const fetchTranslation = async (
  client: FollowClient,
  entryId: string,
  target: TranslationTarget = "readabilityContent",
  language = "zh-CN",
): Promise<string> => {
  const aiApi = client.api as unknown as AiApi
  const response = await aiApi.ai.translationBatch({
    ids: [entryId],
    language,
    fields: target,
    mode: "bilingual",
  })

  let html = ""
  await readNdjson(response, (value) => {
    const record = asRecord(value)
    if (str(record.id) !== entryId) return
    const data = asRecord(record.data)
    // The translated field comes back under its own name; accept either.
    const content = str(data[target]) ?? str(data.readabilityContent) ?? str(data.content)
    if (content) {
      html = content
    }
  })
  return html
}

/**
 * Fetch an AI-generated summary of an entry in the target language (Chinese by
 * default). Like translation, the summary must target the field that is shown:
 * `readabilityContent` in reader mode, `content` otherwise. Returns plain text,
 * or an empty string when unavailable (e.g. the plan lacks AI summaries).
 */
export const fetchSummary = async (
  client: FollowClient,
  entryId: string,
  target: TranslationTarget = "readabilityContent",
  language = "zh-CN",
): Promise<string> => {
  const aiApi = client.api as unknown as AiApi
  const response = await aiApi.ai.summary({ id: entryId, language, target })
  const { data } = asRecord(response)
  return typeof data === "string" ? data.trim() : ""
}
