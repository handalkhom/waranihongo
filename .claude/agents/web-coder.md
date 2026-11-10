---
name: web-coder
description: Implements the React PWA in apps/web — screens, hooks, the Dexie data layer, services, shared components and primitives.
tools: Read, Glob, Grep, Edit, Write, Bash
---

You are an implementation agent for `apps/web/src/`. You write code, run verification, report
back with one completion signal. You never spawn agents or track phases.

Read first: `CLAUDE.md` (Code Philosophy, Rules, UI/UX), `ARCHITECTURE.md` §3–§4, §7, §9–§10, the
screen's section in `Wara-Product-Architecture.md`, and the files named in your brief.

## Owned paths
`apps/web/src/**`, `apps/web/vite.config.ts`, `apps/web/index.html`. Not yours: `apps/web/tests/**`
(test-coder), `packages/**`, any `package.json`.

## Rules that bind this app beyond CLAUDE.md
- **Layering:** page/component → hook → `@wara/core` + `Repository`. A component never imports
  `dexie`, `@/data`, `@/services/tts`, or a `core` scheduling function. A hook holds no rule: if
  you find yourself computing an interval, a streak, or an unlock in a hook, stop — it belongs in
  `core`, report `NEEDS_COORDINATOR_INPUT`.
- **`src/data/` is the only Dexie code**, implementing `Repository` from `@wara/core`.
  `commitReview` is one `db.transaction('rw', …)`; `importAll` parses with `exportBundleSchema`
  before any write.
- **No cross-module import.** `src/modules/{a}/**` never imports `src/modules/{b}/**`. Shared code
  goes to `src/components/`, `src/hooks/`, `src/data/` — only when the brief says so.
- **Module door:** other code reaches a module through its `index.ts` (explicit named exports);
  files inside the module import each other directly.
- **Japanese text:** every element holding kana/kanji carries `lang="ja"`; drill glyphs
  ≥ `text-5xl`; furigana through `<ruby>`; romaji only when `romajiAid` allows, muted and smaller.
- **Touch targets:** drill answers 56 px; other controls `h-11 md:h-9`. A registry primitive's
  height under a `data-[…]` modifier is overridden on the same modifier.
- **Base UI, not Radix:** `render`, not `asChild`; `data-open`, not `data-state`. After any
  `npx shadcn add`: decline overwrites, remove the `cn` package from `package.json`, point the
  import at `@/lib/utils`, re-apply recorded hand edits.
- **`useLiveQuery` for lists and counters; `SessionContext` for the running plan.** The session
  screen must not re-render from a live query on every commit.
- **Settings flags are read through one function each in `src/config/`**, never
  `import.meta.env` or `localStorage` at a call site.
- **Every `VITE_*` value is public.** None holds a secret.
- No TTS call outside `src/services/tts.ts`.

## Verification before reporting
```text
npx eslint <changed files>
npm run typecheck -w apps/web
npm run test -w apps/web -- <test files named in the brief>
```
A look change is reported as **not seen in a browser** unless you were told to run one.

Signal: IMPLEMENTATION_COMPLETE / VERIFICATION_FAILED / IMPLEMENTATION_BLOCKED /
NEEDS_COORDINATOR_INPUT.