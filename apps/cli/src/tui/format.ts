// East Asian Wide / Fullwidth code points render as two terminal cells. Any
// mismatch between measured and actual width lets text overflow its box, which
// makes Ink repaint the whole screen (visible flicker). We therefore size every
// string by display columns rather than JS string length.
const isWideCodePoint = (cp: number): boolean =>
  cp >= 0x1100 &&
  (cp <= 0x115f || // Hangul Jamo
    cp === 0x2329 ||
    cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals, Kangxi
    (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana, Katakana, CJK symbols
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0xa000 && cp <= 0xa4cf) || // Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
    (cp >= 0xfe10 && cp <= 0xfe19) || // Vertical forms
    (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK Compatibility / Small forms
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) || // Emoji / pictographs
    (cp >= 0x20000 && cp <= 0x3fffd)) // CJK Extension B and beyond

const isZeroWidthCodePoint = (cp: number): boolean =>
  cp === 0x200b || // zero-width space
  cp === 0x200d || // zero-width joiner
  cp === 0xfeff || // BOM / zero-width no-break space
  (cp >= 0x0300 && cp <= 0x036f) || // combining diacritical marks
  (cp >= 0xfe00 && cp <= 0xfe0f) // variation selectors

const charWidth = (char: string): number => {
  const cp = char.codePointAt(0)
  if (cp === undefined || isZeroWidthCodePoint(cp)) {
    return 0
  }
  return isWideCodePoint(cp) ? 2 : 1
}

/** Display width of a string in terminal cells (CJK/emoji count as 2). */
export const stringWidth = (value: string): number => {
  let width = 0
  for (const char of value) {
    width += charWidth(char)
  }
  return width
}

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
}

const decodeEntities = (input: string): string =>
  input
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replaceAll(/&([a-z]+);/gi, (match, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? match)

/**
 * Convert HTML into plain, paragraph-separated text suitable for a terminal.
 * Block elements become blank-line breaks, list items get a bullet, and inline
 * markup is stripped. This is intentionally lightweight (no DOM dependency).
 */
export const htmlToText = (html: string): string => {
  if (!html) {
    return ""
  }

  let text = html
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replaceAll(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replaceAll(/<\/(?:p|div|section|article|header|footer|figure|figcaption)>/gi, "\n\n")
    .replaceAll(/<\/h[1-6]>/gi, "\n\n")
    .replaceAll(/<li[^>]*>/gi, "\n• ")
    .replaceAll(/<\/(?:ul|ol|blockquote|pre|table|tr)>/gi, "\n\n")
    .replaceAll(/<\/(?:td|th)>/gi, "\t")
    .replaceAll(/<[^>]+>/g, "")

  text = decodeEntities(text)

  return text
    .replaceAll(/[ \t]+\n/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .replaceAll(/[ \t]{2,}/g, " ")
    .trim()
}

// Break a single word into display-width-sized chunks (e.g. long URLs or an
// unbroken run of CJK characters that exceeds the viewport).
const hardBreak = (word: string, width: number): string[] => {
  const chunks: string[] = []
  let chunk = ""
  let chunkWidth = 0
  for (const char of word) {
    const w = charWidth(char)
    if (chunkWidth + w > width && chunk) {
      chunks.push(chunk)
      chunk = ""
      chunkWidth = 0
    }
    chunk += char
    chunkWidth += w
  }
  if (chunk) {
    chunks.push(chunk)
  }
  return chunks
}

/** Word-wrap text to a column width (measured in display cells). */
export const wrapText = (text: string, width: number): string[] => {
  const safeWidth = Math.max(8, width)
  const lines: string[] = []

  for (const rawLine of text.split("\n")) {
    if (rawLine.length === 0) {
      lines.push("")
      continue
    }

    let current = ""
    let currentWidth = 0
    for (const word of rawLine.split(/\s+/)) {
      if (word.length === 0) {
        continue
      }

      const wordWidth = stringWidth(word)

      if (wordWidth > safeWidth) {
        if (current) {
          lines.push(current)
          current = ""
          currentWidth = 0
        }
        const chunks = hardBreak(word, safeWidth)
        const last = chunks.pop() ?? ""
        lines.push(...chunks)
        current = last
        currentWidth = stringWidth(last)
        continue
      }

      if (currentWidth === 0) {
        current = word
        currentWidth = wordWidth
      } else if (currentWidth + 1 + wordWidth <= safeWidth) {
        current += ` ${word}`
        currentWidth += 1 + wordWidth
      } else {
        lines.push(current)
        current = word
        currentWidth = wordWidth
      }
    }

    lines.push(current)
  }

  return lines
}

/** Compact relative time such as "3h" or "5d"; falls back to a short date. */
export const relativeTime = (value?: string): string => {
  if (!value) {
    return ""
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return ""
  }

  const diffSeconds = Math.round((Date.now() - timestamp) / 1000)
  if (diffSeconds < 60) {
    return "now"
  }

  const minutes = Math.round(diffSeconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours}h`
  }

  const days = Math.round(hours / 24)
  if (days < 7) {
    return `${days}d`
  }

  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** Truncate to a maximum display width, appending an ellipsis when clipped. */
export const truncate = (value: string, width: number): string => {
  if (width <= 1 || stringWidth(value) <= width) {
    return value
  }

  let result = ""
  let used = 0
  for (const char of value) {
    const w = charWidth(char)
    // Reserve one cell for the ellipsis.
    if (used + w > width - 1) {
      break
    }
    result += char
    used += w
  }
  return `${result}…`
}
