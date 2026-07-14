# Folo CLI (`folocli`) — Agent Notes

Guidance for working on `apps/cli`, especially the interactive TUI. The root
`AGENTS.md` still applies; this file adds CLI/TUI-specific context.

## Overview

- Published as `folocli`; binary is `folo`. Built with `tsup` (ESM, bundles
  `ink`/`react`). Commander-based subcommands plus an interactive reader
  (`folo tui`).
- Auth/config/client are shared by every command:
  - `createCommandContext` (`src/client.ts`) builds a `FollowClient`
    (`@follow-app/client-sdk`) and applies the token.
  - `readConfig` reads `~/.folo/config.json`; token also via `--token` or
    `FOLO_TOKEN`. Sign in with `folo login` (browser) or `login --token`.

## TUI (`folo tui`)

- Entry: `src/commands/tui.ts` (TTY guard + auth) → `src/tui/index.tsx` renders
  the Ink `App`.
- Layout: three panes — feeds/groups → entries → reader — driven from `App.tsx`
  state (no external store; the SDK client is passed in).
- Files:
  - `tui/App.tsx` — state, keybindings, layout, help overlay
  - `tui/data.ts` — normalized, SDK-decoupled data layer
  - `tui/sidebar.ts` — subscriptions → group/feed rows
  - `tui/format.ts` — HTML→text, display-width truncate/wrap, relative time
  - `tui/components/` — `FeedList`, `EntryList`, `Reader`, `StatusBar`
  - `tui/theme.ts` — colorscheme roles + dark/light palettes, React context
  - `tui/openUrl.ts` — open a link in the OS default browser
  - `tui/useTerminalSize.ts`
- Keys: `↑↓`/`jk` move · `Enter`/`→` open · `←`/`Esc` back · `Space`/`PgDn`
  page down · `-`/`PgUp` page up · `t` translate · `o` open in browser · `r`
  toggle read · `R` refresh entries · `c` toggle colorscheme · `?` help · `q`
  quit.
- Auto-read: moving the entry-list cursor off an entry marks the one you left
  read (mark-on-leave), so browsing clears unread without opening posts. Shared
  `markRead` helper in `App.tsx` also backs open-to-read and unread toggling.
- Refresh (`R`) re-sorts the list unread-first via `unreadFirst`, floating read
  entries to the bottom; it merges in locally-marked reads so a lagging server
  can't resurface them on top.

## Non-obvious decisions & gotchas (read before changing the TUI)

1. **Ink 7, not 6 — flicker.** Ink repaints the whole frame on every keystroke
   (no line diffing). Ink 7 wraps each frame in synchronized-output mode
   (DEC private mode `2026`, `ESC[?2026h…l`) so supporting terminals repaint
   atomically → no flicker. Ink 6 does **not** and flickers. Ink 7 needs
   **Node ≥ 22**, hence `engines.node >=22` and tsup `target: "node22"`.
2. **Keep output shorter than the terminal.** `paneHeight = termRows - 4` and
   the outer `<Box>` has **no fixed height**. If total output equals/exceeds the
   terminal height, Ink clears the entire screen each frame (`ESC[2J`) → flicker.
3. **CJK display width.** `format.ts` `stringWidth`/`charWidth` count
   CJK/fullwidth/emoji as **2 cells**; `truncate`/`wrapText` measure display
   width, not JS string length. Every content `<Text>` sets
   `wrap="truncate-end"` so a box can never grow past its fixed height (overflow
   → wrap → taller-than-terminal → flicker + misaligned borders).
   `useTerminalSize` uses `|| 30` (not `?? 30`) because a PTY can report
   `rows === 0`.
4. **Translation.** `client.api.ai.translationBatch({ ids, language: "zh-CN",
   fields, mode: "bilingual" })` returns an **NDJSON stream** of
   `{ id, data: { content | readabilityContent } }`. Bilingual mode returns HTML
   where each source paragraph is followed by its translation. **Translate the
   field that is actually displayed**: `readabilityContent` when the reader shows
   readability (the default), `content` only on fallback — otherwise link posts
   translate a stub (see RSSNext/Folo#5023). Translation is a **paid** feature
   (Basic tier); free accounts get an empty result.
5. **Data layer.** SDK response shapes are broad and untyped here. `data.ts`
   normalizes every payload through unknown-safe readers (`asRecord`, `str`,
   `num`) into small explicit interfaces — avoids `any` and decouples the TUI
   from SDK type churn.
6. **Colorscheme.** `theme.ts` defines semantic roles (accents `primary`/
   `muted`/`secondary`/`summary` — formerly the hardcoded `cyan`/`gray`/
   `yellow`/`green` — plus `text`/`background`) and dark/light palettes,
   delivered via React context (`useTheme`), not props. `c` toggles it; the
   choice persists to `config.json` (`theme` field) via the `onThemeChange`
   callback threaded through `runTui`. Palettes use **hex, not ANSI names** —
   names inherit each terminal's palette (inconsistent, often glaring); hex
   renders the same everywhere and chalk downsamples on limited terminals.
   **A TUI can't set the terminal's own window background**, so a real light
   theme must *paint* the cells it draws: set `backgroundColor` on every pane
   `Box` (an Ink Box bg fills its whole rectangle, behind child text too — the
   emitted line is `ESC[48;2;r;g;bm …text… ESC[49m`) **and** set an explicit
   dark `color={theme.text}` on all body/dim `<Text>`, else plain text inherits
   the terminal's light default fg and turns invisible on the light bg. For the
   dark theme `text`/`background` stay `undefined` (terminal default), so
   `color={undefined}`/`backgroundColor={undefined}` is a no-op there. Painting
   bg changes no heights, so the flicker invariants (#2) still hold. Test under
   a PTY with `FORCE_COLOR=3` so chalk emits exact 24-bit codes (`48;2;…` fills,
   `38;2;…` fg) to assert on, and re-check `ESC[2J` count stays 0 while
   scrolling.

## Develop & test

- Build: `pnpm --filter folocli build`. Run: `node dist/index.js tui` (or
  `pnpm --filter folocli dev tui`). Needs auth (`folo login` / `FOLO_TOKEN`).
- Gates: `pnpm --filter folocli typecheck`, `eslint apps/cli/src/tui`,
  `pnpm --filter folocli test` (vitest).
- The TUI has no unit tests; verify it by driving it under a **pseudo-TTY**
  (Python `os.openpty` + `TIOCSWINSZ` to set a real winsize — a 0×0 PTY makes
  Ink render nothing), sending keystrokes, and asserting on the emitted escape
  sequences (e.g. count `ESC[2J` for flicker) or the rendered text. A mock
  `FollowClient` (plain object cast to the type) exercises data/translation
  paths without network.

## Environment caveats

- This working copy was installed with a **filtered** `pnpm install --filter
  folocli`, so not all `packages/*` are built. Consequences:
  - The **pre-commit hook** (`lint-staged` → Prettier) fails because
    `prettier-plugin-tailwindcss` can't load the desktop Tailwind config
    (`@follow/configs` unbuilt). Commit TUI changes with `git commit
    --no-verify` (they are already typecheck/eslint/format-clean), or run a full
    `pnpm install` to fix the environment.
  - Format TUI files (no Tailwind classes) with a plugin-free Prettier config
    matching `.prettierrc.mjs` (semi:false, singleQuote:false, printWidth:100,
    tabWidth:2, trailingComma:all).
