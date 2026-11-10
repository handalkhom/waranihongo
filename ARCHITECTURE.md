# ARCHITECTURE

The high-level call graph; code is the low-level one (`CLAUDE.md`, Code Philosophy). This file is
the map: where a change belongs, what boundary it crosses, what it can silently break. It is
written as the present state and carries no dates, history, status, verification results, or open
questions — those live in `MEMORY.md`. What a screen shows is in `Wara-Product-Architecture.md`.

> **Status: nothing is built.** Every block in this file is **Decided, not yet built**. When the
> code exists, each block is checked against the real tree and either confirmed or corrected; a
> reference-implementation cell reading *none yet* is replaced by a real path. `MEMORY.md` records
> which blocks have been confirmed.

Authority order: `package.json` files and source code; then this file; then `MEMORY.md` for what
was decided but is not yet in the code.

## 1. What this application is

Wara no Nihongo is a single-learner Japanese study application: a daily 30-minute session built
from spaced repetition (FSRS), a curriculum that unlocks from the learner's own review data, and a
journal that turns daily anime input into reading practice. The learner is also the owner; the
placement test and 12-month plan in `docs/learning-plan.md` are the requirement, and
`Wara-Product-Architecture.md` §2 maps them to features.

Phase 1 (v0.1–v0.4) is an installable web app with all data on the device. v1.0 adds a sync
backend; v1.x adds an Expo mobile app. Both reuse `@wara/core` and `@wara/content` unchanged,
which is why this is a monorepo.

## 2. Monorepo layout and dependency direction

```text
wara-no-nihongo/
  apps/web/                 React 19 + Vite PWA — the only app in phase 1
  packages/core/            @wara/core: pure domain logic
  packages/content/         @wara/content: JSON data + Zod schemas + validate script
  tests/ (per package)      each package has its own tests/ tree mirroring its src/
  docs/                     learning-plan.md, qa-session.md (tracked in git)
  CLAUDE.md  ARCHITECTURE.md  MEMORY.md  Wara-Product-Architecture.md
  package.json              npm workspaces; root scripts fan out with --workspaces
```

**Dependency direction, one way:** `content` ← `core` ← `web`. `core` imports only content
schemas (`@wara/content/schema`) for types, never the data bundle; data reaches it as arguments.
`core` imports no React, DOM, or Dexie. Nothing imports `web`. A future `apps/api` (Hono) and
`apps/mobile` (Expo) sit beside `web` and obey the same direction. Enforced by an ESLint
`no-restricted-imports` rule per package (written with the first module — *none yet*).

**Module tiers inside `apps/web/src/modules/`.** Phase-1 modules: `session`, `learn`, `kana`,
`vocab`, `grammar`, `kanji`, `journal`, `progress`, `settings`.

| Tier | Modules | May import |
| --- | --- | --- |
| Leaf | `kana`, `vocab`, `grammar`, `kanji` — each owns its drill and item-detail components | No module |
| Composer | `session`, `learn` | Leaf modules, only through their `index.ts` |
| Standalone | `journal`, `progress`, `settings` | No module |

A leaf never imports a composer; a composer never imports another composer. Enforced by an ESLint
`no-restricted-imports` rule per module tier (written with the first module — *none yet*).

## 3. Technology decisions

| Concern | Choice | Reason |
| --- | --- | --- |
| Language | TypeScript 7 if `typescript-eslint` and Vite tooling pass lint/typecheck/build at init, else latest 6.x — outcome recorded in `MEMORY.md`; `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters` | The compiler is the proof |
| Package manager | npm workspaces | One lockfile; matches the owner's other projects |
| Web runtime | React 19 + Vite 8, `vite-plugin-pwa` (Workbox, `autoUpdate`) | Installable, offline, no server |
| Hosting | Vercel, static PWA; SPA rewrite of every route to `index.html` | Static files only; a deep link reaches the router |
| Routing | React Router 8 from `react-router` (`RouterProvider` from `react-router/dom`) | Route table as data, one guard |
| Persistence | `dexie` 4 + `dexie-react-hooks` (`useLiveQuery`) | IndexedDB with reactive reads; `fake-indexeddb` in tests |
| Server state | **Not installed** before v1.0 | No network source exists; two reactive caches over one table would fight |
| SRS | `ts-fsrs` 6.x | Current standard scheduler; parameters can later be fitted to the learner's log; wrapped in one file |
| Client state | One Context per concern: `SessionContext`, `SettingsContext` | Only two cross-route concerns |
| Forms | React Hook Form 7 + Zod 4 via `@hookform/resolvers` | Journal entry, custom vocabulary, and settings; the official resolver |
| Styling | Tailwind CSS 4 in CSS (`@theme`), no config file | — |
| Components | shadcn/ui on Base UI (`@base-ui/react`), `tsx: true`; `lucide-react`; `cn()` from `clsx` + `tailwind-merge` in `src/lib/cn.ts`; `src/lib/` is a closed list: `cn.ts`, `typography.ts` | Primitives owned by the repo; the `shadcn` package is not a dependency, its stylesheet is vendored |
| Fonts | System font stack; `lang="ja"` on Japanese text | No multi-MB web font; the OS Japanese font is correct and offline |
| Charts | `recharts` 3, behind `React.lazy` on the progress page only | Bundle size |
| Audio | Web Speech API through `src/services/tts.ts` | No audio files in phase 1 |
| Lint | ESLint 10 flat config with `typescript-eslint`, `react-hooks`, `react-refresh`; errors on `any`, `@ts-ignore`, `==`, `react-router-dom` imports, and imports that cross a package or module tier the wrong way | — |
| Tests | Vitest 5; `core` and `content` unit-level; `web` with jsdom + React Testing Library + `fake-indexeddb` | Route tests run the real repository against an in-memory IndexedDB |

Not chosen and not to be assumed: Redux, Zustand, TanStack Query (before v1.0), Axios, Prettier,
MSW (before v1.0), another component library. Adding a dependency is a coordinator decision
recorded in this table.

Facts about the tools that shape the code:

- `baseUrl` is not used; the `@/*` alias is `paths` only, repeated in `vite.config.ts`.
- Base UI composes through `render`, not `asChild`; state attributes are `data-open`, not
  `data-state`. After any `shadcn add`, a registry primitive's hand edits are re-applied, its
  imports are repointed to `@/lib/cn`, and the CLI's `cn` package is removed from `package.json`.
- `ts-fsrs` keeps its own `Card` shape; `core/srs/schedule.ts` is the only file that imports it
  and maps to and from `ReviewState`. No other file sees an FSRS type.
- `useLiveQuery` re-runs on any write to the tables it read. A hook that reads `reviewStates`
  re-renders on every review commit; a page that must not (the session screen) reads once through
  the repository and holds the plan in `SessionContext`.
- `speechSynthesis.getVoices()` is empty until `voiceschanged` fires on some browsers;
  `tts.ts` resolves the `ja-JP` voice lazily and falls back to the default voice with a visible
  "suara Jepang tidak tersedia" notice.

## 4. Runtime topology

```text
Browser (phone first)
  → RouterProvider (apps/web/src/app/App.tsx: createBrowserRouter(appRoutes from app/router.tsx))
    → OnboardingGuard                 // redirects to /mulai while no profile row exists
      → AppLayout                     // bottom tabs < lg, sidebar ≥ lg; hidden on /sesi and /tes/:kind
        → Page (lazy per route, owned by one module)
          → composer module           // session | learn
            → leaf module index.ts    // kana | vocab | grammar | kanji: drill and item-detail components
          → Feature hook              // composes core + repository; reads now, computes today (LocalDate)
                                      // via toLocalDate (src/utils/localDate.ts) from the device clock
                                      // at the edge; owns no rule
            → @wara/core              // pure: romajiMatches, rateAnswer, schedule, applyConfusion,
                                      // planSession, derivePhase, evaluateKanaExit,
                                      // kanaExitAvailable, nextCurriculumUnit, streak,
                                      // progressSummary
            → Repository (src/data)   // Dexie; the only code that knows IndexedDB
            → useLiveQuery            // reactive reads for lists and counters
          → services/tts.ts           // speechSynthesis

Cross-route client state
  → AppProviders
    → SettingsProvider                // romajiAid, dailyTargetMin, theme — read-through of the profile row
    → SessionProvider                 // mounted by /sesi only: the running plan and its cursor
```

### Layer responsibilities

| Layer | Responsibility | Must not do |
| --- | --- | --- |
| `@wara/content` | Data, schemas, validate | Hold logic beyond load/validate |
| `@wara/core` | Domain model, FSRS wrapper, answer rating, planner, confusion logic, phase derivation, curriculum unlock, progress math, typed errors, `Repository` interface | Import React/DOM/Dexie; read the clock or RNG |
| `src/data/` | Implement `Repository` over Dexie; schema versions; export/import | Contain a scheduling or scoring rule |
| Leaf module (`kana`, `vocab`, `grammar`, `kanji`) | The drill and item-detail components and hooks for one content type | Import any module |
| Composer module (`session`, `learn`) | Assemble leaf modules into a session, a test, or a browse flow | Import another composer; reach a leaf past its `index.ts` |
| Standalone module (`journal`, `progress`, `settings`) | One screen area | Import any module |
| Feature hook | Compose core + repository; read `now` and compute `today` from the device clock through `toLocalDate`; expose read models and actions | Render; hold a rule |
| `src/utils/` | Pure helpers, one job each, listed here: `toLocalDate(now: Date): LocalDate` in `localDate.ts` — the only place `apps/web` derives the learner's local date from the device clock | Hold a domain rule (rules live in `@wara/core`) |
| Component/page | Render, interaction, local state | Touch Dexie, storage, TTS, or core scheduling directly |
| Shared component (`src/components/`) | Props-driven UI from primitives | Import from a module; call a data hook |
| Context provider | The two cross-route concerns above | Cache an IndexedDB table |
| `services/tts.ts` | The only reader of `window.speechSynthesis` | Know content or scheduling |

## 5. Domain model (`packages/core/src/domain.ts`)

Types are `z.infer` of the content schemas where they describe content, and hand-written
`readonly` types where they describe learner state.

| Type | Key fields | Lives in |
| --- | --- | --- |
| `ContentItem` | discriminated union on `type`: `kana \| vocab \| grammar \| kanji`; `id`, `level`, `phase`, `tags`, `supersededBy?`, `data`. `vocab` splits on `source`: `'content'` (`VocabData`) or `'custom'` (`CustomVocabData`, id `vocab:custom:<uuid>`) | content bundle + `customContent` table |
| `KanaData` | `char`, `romaji`, `romajiAccepted` (accepted variants: を `o`/`wo`, ん `n`/`nn`), `script`, `group`, `mnemonic?` | content |
| `VocabData` | `word`, `reading`, `meaningId`, `pos`, `register`, `examples` | content |
| `CustomVocabData` | `word`, `reading`, `meaning` (free text, no `meaningId`) | `customContent` |
| `GrammarData` | `title`, `structure`, `explanationId`, `examples`, `pitfalls`, `exercises`, `priority?` | content |
| `KanjiData` | `kanji`, `meaningId`, `onyomi`, `kunyomi`, `vocabIds` | content |
| `ConfusionGroup` | `id`, `items` | `confusion-groups.json` |
| `LocalDate` | `YYYY-MM-DD`, the learner's local date; computed from the device clock at the edge | `Session.date`, `JournalEntry.date`, `Assessment.date`, `UserProfile.startDate` |
| `Phase` | `0 \| 1 \| 2 \| 3`; returned by `derivePhase`, never stored | — |
| `ReviewState` | `itemId`, `stability`, `difficulty`, `due`, `lastReview`, `reps`, `lapses`, `learningSteps`, `state` — the fields the ts-fsrs 6 `Card` mapping needs | `reviewStates` |
| `ReviewLog` | `id`, `itemId`, `at`, `rating` (1–4), `elapsedMs`, `confusedWith?` | `reviewLogs` |
| `Session` | `id`, `date`, `plannedMin`, `actualMin`, `activities: ReadonlyArray<SessionActivity>`, `cursor: number` (index of the next activity), `completed` | `sessions` |
| `SessionActivity` | `{ kind: 'review' \| 'new' \| 'production'; itemIds: ReadonlyArray<string>; estimatedSec: number; done: boolean }`; the new items a session introduced are the `itemIds` of its `kind: 'new'` activities | `Session.activities` |
| `JournalEntry` | `id`, `date`, `source?`, `sentenceKana`, `guess`, `status`, `correction?`, `extractedVocabIds` | `journal` |
| `Assessment` | `id`, `date`, `kind` (includes `'kana-exit'`, `'weekly'`), `scores` | `assessments` |
| `UserProfile` | `id: 'me'`, `name`, `dailyTargetMin`, `romajiAid`, `startDate`, `weakSeeds` (seed ids introduced first as new material) | `profile` |

`meaningId` and `explanationId` resolve in `packages/content/data/i18n/id.json`; a second UI
language is a data addition. Confusion-group membership lives only in `confusion-groups.json`; an
item may belong to several groups. The current phase is always derived, never a profile field.

## 6. Core contracts

Every function below is pure, takes `now`, takes `today: LocalDate` where calendar days matter,
and takes `rng` where it samples. Reference: *none yet*.

| Function | Signature (abridged) | Rule |
| --- | --- | --- |
| `romajiMatches` | `({ reading, given, kana }: { reading: string; given: string; kana: ReadonlyArray<KanaData> }) => boolean` | The reading (one kana or a whole word) is tokenised longest-match first (しゃ before し); each token accepts its `romajiAccepted` variants; small っ/ッ doubles the first consonant of the next token; ー repeats the previous vowel (a typed `-` is also accepted); ん before a vowel or y accepts `n'` and `nn`. Case- and surrounding-whitespace-insensitive. A reading containing a kana not in `kana` throws `ContentValidationError` (the content validator makes that unreachable). |
| `rateAnswer` | `({ correct, elapsedMs, mode }: { correct: boolean; elapsedMs: number; mode: 'choice' \| 'typed' }) => Rating` | Wrong → Again; correct → Hard / Good / Easy by the elapsed-time thresholds. Multiple choice is capped at Good; typed can reach Easy. Correctness comes from `romajiMatches` (typed) or an id comparison (choice). Open-recall cards are not rated here: the learner's four buttons give the `Rating`. |
| `schedule` | `({ itemId, state: ReviewState \| null, rating, now, weakSeeds }) => ReviewState` | Wraps `ts-fsrs`. `state: null` is the first review; an item in `weakSeeds` is then initialised as if it had lapsed once. |
| `applyConfusion` | `({ itemId, given, groups, items, states, now }) => { confusedWith: string \| null; moved: ReadonlyArray<ReviewState>; priorityNew: ReadonlyArray<string> }` | When the answer to A matches another member B of a group containing A: A is scheduled normally (Again, through `schedule`); B's `due` moves to `now` with stability and difficulty unchanged (`moved`); a B with no state is returned in `priorityNew`. `confusedWith` is written to A's `ReviewLog`. The contrast drill is neither logged nor scheduled. |
| `planSession` | `({ availableMin, dueStates, curriculumCursor, profile, phase, sessionsToday, now, today, rng }) => SessionPlan` | Allocation priority review → production → new material: review is never cut; due reviews beyond the review slice consume the new-material slice; new items per day are throttled when the backlog exceeds its threshold; new items already introduced today — counted from `sessionsToday` activities of kind `new` — count against the per-day limit. Display order review → new material → production. `weakSeeds` come first among new items. Deterministic for identical inputs. |
| `derivePhase` | `(states, assessments) => Phase` | Phase from data only; phase 1 requires a passed `kana-exit` assessment. |
| `evaluateKanaExit` | `(answers: ReadonlyArray<{ itemId: string; correct: boolean }>, elapsedMs: number) => { passed: boolean; wrong: ReadonlyArray<string> }` | `elapsedMs` is the sum of per-word display times (a word appearing to "Siap"; typing time excluded). Pass = all 50 correct and `elapsedMs` ≤ the kana-exit time limit default. Each kana-exit answer is also a review: `romajiMatches` → `rateAnswer` (mode `typed`, `elapsedMs` = that word's display time) → `schedule` → `commitReview`. |
| `kanaExitAvailable` | `({ kanaIds, states, assessments }: { kanaIds: ReadonlyArray<string>; states: ReadonlyArray<ReviewState>; assessments: ReadonlyArray<Assessment> }) => boolean` | True when every id in `kanaIds` has a `ReviewState` (each kana reviewed at least once) and no passed `kana-exit` assessment exists. Drives the "Tes keluar Fase 0" card on Beranda; a failed attempt keeps it true so the test can be retaken. |
| `nextCurriculumUnit` | `(curriculum, states) => Unit \| null` | The next unit whose `unlockWhen` holds, evaluated from review data only; `priority: true` units first. |
| `streak` | `({ sessions, today }) => { days: number; forgivenessUsedThisWeek: boolean }` | Consecutive local days ending today or yesterday with a completed session; one forgiveness day per ISO week. Used by Beranda; `progressSummary` reuses it. |
| `progressSummary` | `(states, logs, sessions, now, today) => ProgressSummary` | Streak via `streak`, accuracy per confusion group from `ReviewLog.confusedWith`, on-track flag against the 12-month map. |

The placement test has no function of its own: each answer goes through `romajiMatches` →
`rateAnswer` → `schedule` → `commitReview`.

Defaults (`core/session/defaults.ts`): `availableMin` 30, split 5/15/10, new items per day 20 in
phase 0 and 10 after, the backlog threshold that throttles new items, the `rateAnswer`
elapsed-time thresholds, kana-exit word count 50 and time limit 120 s, romaji aid `on-demand` in
phase 0 and `off` from phase 1 (the learner may change it), romaji aid auto-off at kana accuracy
≥ 0.95 over the last 200 kana reviews. A default is a named export, never a literal at a call
site.

Typed errors (`core/errors.ts`): `ContentValidationError`, `RepositoryError`,
`ImportFormatError`, each carrying the ids involved.

## 7. Repository contract (`packages/core/src/repository.ts`)

```ts
export interface Repository {
  readonly getReviewStates: (ids: ReadonlyArray<string>) => Promise<ReadonlyArray<ReviewState>>
  readonly getDueStates: (before: Date) => Promise<ReadonlyArray<ReviewState>>
  readonly commitReview: (states: ReadonlyArray<ReviewState>, logs: ReadonlyArray<ReviewLog>, session?: Session) => Promise<void>
  readonly saveSession: (session: Session) => Promise<void>
  readonly getSessions: (from?: LocalDate) => Promise<ReadonlyArray<Session>>
  readonly getProfile: () => Promise<UserProfile | null>
  readonly saveProfile: (profile: UserProfile) => Promise<void>
  readonly saveJournalEntry: (entry: JournalEntry) => Promise<void>
  readonly saveAssessment: (assessment: Assessment) => Promise<void>
  readonly exportAll: () => Promise<ExportBundle>
  readonly importAll: (bundle: unknown) => Promise<void>
}
```

- `commitReview` writes the states, the logs, and the session row (when given) in **one
  transaction**; a log without its state change corrupts FSRS history, and a session cursor ahead
  of its reviews skips them on resume. The running session calls it with its session; "Latih
  sekarang" and the placement test call it without one.
- `saveSession` creates and finishes a session row.
- `getSessions(from?)` returns the sessions with `date >= from` (all when omitted), ordered by
  date. The planning hook calls `getSessions(today)` for `planSession`'s `sessionsToday` and for
  Beranda's "Lanjutkan sesi" (today's unfinished session); Beranda's streak calls `getSessions()`.
- `importAll` takes `unknown`, parses it with `exportBundleSchema` (the one edge where stored data
  is external), and **replaces** the database only after the whole bundle validates. It is called
  only after an explicit confirmation dialog.
- The web implementation is `apps/web/src/data/dexieRepository.ts`; a mobile one will be
  `expo-sqlite`; a sync layer wraps either and adds a `pendingOps` table.

### Dexie schema (`apps/web/src/data/db.ts`)

```text
version 1:
  reviewStates:  itemId, due, state
  reviewLogs:    id, itemId, at
  sessions:      id, date
  journal:       id, date, status
  assessments:   id, date, kind
  profile:       id
  customContent: id, type
```

Schema changes are additive `version(n + 1).stores().upgrade()` steps; a shipped version block is
never edited.

## 8. Content contract (`packages/content`)

- `data/{kana,vocab,grammar,kanji}/*.json`, `data/curriculum.json`, `data/confusion-groups.json`,
  `data/i18n/id.json`, `data/seed/alan-weak.json`.
- Two entries: `@wara/content` exports the parsed, typed data; `@wara/content/schema` exports the
  Zod schemas and types only (the one `core` imports). `src/schema/*.ts` are the Zod schemas. Data
  that fails to parse throws `ContentValidationError` at module load — the application does not
  start on bad content.
- One content bundle: `apps/web` imports it statically and the PWA precaches it with the app
  shell. There is no per-phase split.
- `npm run validate -w @wara/content` additionally checks: every referenced id exists
  (`vocabIds`, curriculum `items`, confusion-group `items`, `supersededBy`); every `meaningId` /
  `explanationId` resolves; no duplicate id; every id in `seed/alan-weak.json` exists; and the id
  rules below.

### Ids

`<type>:<group>:<slug>`; the slug is the Japanese written form.

| Item | Form | Examples |
| --- | --- | --- |
| Kana | `kana:hira:<hiragana>`, `kana:kata:<katakana>` | `kana:hira:ね`, `kana:hira:ぢ`, `kana:hira:っ`, `kana:hira:しゃ`, `kana:kata:ン` |
| Vocabulary | `vocab:<level>:<written form>` | `vocab:n5:橋`, `vocab:n5:箸` |
| Vocabulary, same writing, different reading | `~<reading>` suffix, reading in kana | `vocab:n5:一日~ついたち`, `vocab:n5:一日~いちにち` |
| Kanji | `kanji:<level>:<one ideograph>` | `kanji:n5:日` |
| Grammar | `grammar:<level>:<pattern in Japanese>`; a contrast card joins forms with `・` | `grammar:n5:～ませんでした`, `grammar:n5:に・で` |
| Learner-made vocabulary | `vocab:custom:<uuid>` | stored in `customContent`, never in a data file |

Validator id rules: every id is NFC; a `kana:hira:` slug is only hiragana; a `kana:kata:` slug is
only katakana (including ー and small kana); a `kanji:` slug is exactly one CJK ideograph; a
`vocab:` slug contains no Latin letter; a `~` suffix is only kana.

- Ids are permanent. Deprecation is `supersededBy`; the planner treats a superseded item as
  retired and its review state as read-only history.

## 9. Routes (`apps/web/src/app/router.tsx`)

| Path | Page | Notes |
| --- | --- | --- |
| `/mulai` | `OnboardingPage` | Only route while no profile exists; redirects to `/` once one does |
| `/` | `HomePage` | Streak, due counts, "Mulai sesi hari ini", 12-month map; kana-exit card shown when `kanaExitAvailable` |
| `/sesi` | `SessionPage` | Owned by `session`; full-screen; mounts `SessionProvider`; hides the app chrome |
| `/tes/:kind` | `TestPage` | Owned by `session`; full-screen; hides the app chrome; first kind `kana-exit`; owns the per-word display timer, which runs only while a word is visible and pauses from "Siap" through the typed answer |
| `/belajar` | `LearnPage` | Owned by `learn`; browse content outside a session |
| `/belajar/:type/:id` | `ItemPage` | Owned by `learn`; one item; "Latih sekarang" is the only way browsing touches the SRS |
| `/jurnal`, `/jurnal/baru`, `/jurnal/:id` | journal pages | Owned by `journal`; RHF + Zod form |
| `/progres` | `ProgressPage` | Owned by `progress`; `lazy`; recharts lives here |
| `/pengaturan` | `SettingsPage` | Owned by `settings`; romaji aid, target, voice, theme, export/import |
| `*` | — | Redirects to `/` |

The route table is an exported `RouteObject[]` in `src/app/router.tsx`; `src/app/App.tsx` (the
composition root) and `tests/renderApp.tsx` both consume it. Pages are lazy per route with
`PageLoader` as `hydrateFallbackElement`.

## 10. State contract

| Scope | Mechanism | Used for |
| --- | --- | --- |
| IndexedDB | `Repository` writes; `useLiveQuery` reads | Everything the learner has done |
| URL | search params | `LearnPage` filters (`?type=`, `?phase=`), the journal list's `?status=` |
| Context | `SettingsContext`, `SessionContext` | Render-time settings; the running session |
| Component | `useState` | Card flipped, answer typed, dialog open |

- Settings are persisted in the `profile` row and mirrored into `SettingsContext` on load and on
  each save; the Context is a read-through, not a second source.
- `SessionProvider` persists the session row with every `commitReview`, so a closed tab resumes;
  `saveSession` creates and finishes it.
- No IndexedDB row is ever copied into component state as a cache; a list renders from
  `useLiveQuery`.

## 11. Testing

Every behavioural file in every layer — a `core` function, a validator rule, a repository method,
a hook, a component, a page — is written test-first:

1. The implementation worker writes a stub with the exact signature from this file's contract.
2. `test-coder` writes the complete test file from the contract.
3. The coordinator runs it and confirms it fails on an assertion, not on an import or type error
   (**red verified**).
4. The implementation worker makes it green without touching the test file.
5. Refactor with the tests green.

An implementation worker who believes a test is wrong reports `NEEDS_COORDINATOR_INPUT`.

Exempt from TDD, each with its substitute verification:

| Exempt | Verified by |
| --- | --- |
| Scaffolding and config | lint, typecheck, build green |
| Styling and layout | Checked in a browser at about 390 px and a desktop width |
| Content data files | The validator, whose rules are themselves test-first |
| TTS, PWA service worker, real-browser IndexedDB | `docs/qa-session.md` on a phone |

- **`core`**: Vitest, pure; every exported function has a test file; `schedule` and `planSession`
  are additionally property-tested for determinism (same inputs → same output).
- **`content`**: Vitest runs the validator against the real data; every validator rule, the id
  rules included, has a fixture that fails it.
- **`web`**: Vitest + jsdom + React Testing Library + `fake-indexeddb`. `tests/renderApp.tsx`
  renders the real providers and route table on a memory router over a fresh in-memory database
  seeded through the real repository. Every page has a route test covering empty, loading,
  success, and error. A behaviour change ships with a route or component test, not only a core
  test. `URL.createObjectURL` is stubbed per test that exports. `speechSynthesis` is absent in
  jsdom; `tts.ts` is stubbed through its one module. A time-dependent route test sets the clock
  with Vitest fake timers; `toLocalDate` has its own test covering the local-midnight boundary.
- `tests/` is a separate tree per package mirroring `src/`; no colocated tests.

## 12. Verification

A red-verification step runs the one test file in its workspace (`npx vitest run <file>`) and
reads the failure: an assertion failure is red; an import, type, or syntax error is not.

Root scripts fan out to every workspace. After each group of source changes the coordinator runs:

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run validate -w @wara/content
```

None proves appearance or a working drill; `docs/qa-session.md` is run on a phone before each
release tag. Recorded outcomes live in `MEMORY.md`, dated.

## 13. Domain → worker routing

| Pattern | Agent | Notes |
| --- | --- | --- |
| `packages/core/src/**` | `core-coder` | Pure TypeScript; may not add a dependency or touch `apps/` |
| `packages/content/**` | `content-author` | Data and schemas; may not loosen a schema; runs `validate` |
| `apps/web/src/**` | `web-coder` | Screens, hooks, data layer, services, primitives |
| `**/tests/**` | `test-coder` | Written from the contract and the requested behaviour, not the implementation |
| `*.md`, `package.json`, configs, `.claude/**`, `docs/` | `general-purpose` | — |
| read-only search | `Explore`; planning | `Plan` | Cannot write |

For every behavioural file, `test-coder`'s red test precedes the implementation worker's green
step (§11).

Coordinator-only decisions, binding from the first line: adding a package or a module; a new Dexie
schema version; changing the `Repository` interface or a module's `index.ts` surface; changing a
default in `core/session/defaults.ts`; deprecating a content id; adding a dependency.

## 14. Change management

This file changes only when the architecture or a standing rule changes, and is written as the
present state. A rule is written here once the code follows it; until then it is recorded in
`MEMORY.md`. Page content goes to `Wara-Product-Architecture.md`. A cross-file contract — a
literal, shape, or invariant that must stay identical in two files — is recorded here at the
section that owns the subject, never in a code comment.