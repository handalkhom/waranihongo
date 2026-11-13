# ARCHITECTURE

The high-level call graph; code is the low-level one (`CLAUDE.md`, Code Philosophy). This file is
the map: where a change belongs, what boundary it crosses, what it can silently break. It is
written as the present state and carries no dates, history, status, verification results, or open
questions — those live in `MEMORY.md`. What a screen shows is in `Wara-Product-Architecture.md`.

> **Status: built are the monorepo scaffold; the content package (schemas, validator, v0.1 data);
> `@wara/core` — the types, typed errors, and `Repository` interface (`domain.ts`, `errors.ts`,
> `repository.ts`) and the v0.1 functions `romajiMatches`, `rateAnswer`, `schedule`,
> `applyConfusion`, `planSession`, `derivePhase`, `evaluateKanaExit`, `kanaExitAvailable`,
> `streak`; and the web data layer `apps/web/src/data/` (`db.ts`, `exportBundleSchema.ts`,
> `dexieRepository.ts`).** Every other block in this file is **Decided, not yet built**. When the
> code exists, each block is checked against the real tree and either confirmed or corrected; a
> reference-implementation cell reading *none yet* is replaced by a real path. `MEMORY.md`
> records which blocks have been confirmed.

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
  docs/                     learning-plan.md, qa-session.md (local only, git-ignored)
  CLAUDE.md  ARCHITECTURE.md  MEMORY.md  Wara-Product-Architecture.md
  package.json              npm workspaces; root scripts fan out with --workspaces
```

**Dependency direction, one way:** `content` ← `core` ← `web`. `core` imports only content
schemas (`@wara/content/schema`) for types, never the data bundle; data reaches it as arguments.
`core` imports no React, DOM, or Dexie. Nothing imports `web`. A future `apps/api` (Hono) and
`apps/mobile` (Expo) sit beside `web` and obey the same direction. Enforced by an ESLint
`no-restricted-imports` rule per package in the root `eslint.config.js`.

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
| Language | TypeScript 6.0.x (`~6.0.3`); TS 7 waits for `typescript-eslint` support (`MEMORY.md`); `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters` | The compiler is the proof |
| Package manager | npm workspaces | One lockfile; matches the owner's other projects |
| Web runtime | React 19 + Vite 8, `vite-plugin-pwa` (Workbox, `autoUpdate`) | Installable, offline, no server |
| Hosting | Vercel, static PWA; project Root Directory `apps/web`, whose `apps/web/vercel.json` rewrites every route to `index.html`; a deploy runs only `vite build` | Static files only; a deep link reaches the router |
| Routing | React Router 8 from `react-router` (`RouterProvider` from `react-router/dom`) | Route table as data, one guard |
| Persistence | `dexie` 4.4.x; `dexie-react-hooks` (`useLiveQuery`) with the hooks | IndexedDB with reactive reads; `fake-indexeddb` in tests |
| Server state | **Not installed** before v1.0 | No network source exists; two reactive caches over one table would fight |
| SRS | `ts-fsrs` 5.4.x | Current standard scheduler; parameters can later be fitted to the learner's log; wrapped in one file; the synchronous API with the FSRS-6 model (6.x replaces it with an async scheduler whose legacy API is deprecated) |
| Client state | One Context per concern: `SessionContext`, `SettingsContext` | Only two cross-route concerns |
| Forms | React Hook Form 7 + Zod 4 via `@hookform/resolvers` | Journal entry, custom vocabulary, and settings; the official resolver |
| Styling | Tailwind CSS 4 in CSS (`@theme`), no config file | — |
| Components | shadcn/ui on Base UI (`@base-ui/react`), `tsx: true`; `lucide-react`; `cn()` from `clsx` + `tailwind-merge` in `src/lib/cn.ts`; `src/lib/` is a closed list: `cn.ts`, `typography.ts` | Primitives owned by the repo; the `shadcn` package is not a dependency, its stylesheet is vendored |
| Fonts | System font stack; `lang="ja"` on Japanese text | No multi-MB web font; the OS Japanese font is correct and offline |
| Charts | `recharts` 3, behind `React.lazy` on the progress page only | Bundle size |
| Audio | Web Speech API through `src/services/tts.ts` | No audio files in phase 1 |
| Lint | ESLint 10 flat config with `typescript-eslint`, `react-hooks`, `react-refresh`; errors on `any`, `@ts-ignore`, `==`, `react-router-dom` imports, and imports that cross a package (or, with the first module, a module tier) the wrong way; `@wara/core` source bans `Date.now()`, `new Date()`, `Date()`, `Math.random()`; `lint` runs with `--max-warnings 0` and `noInlineConfig`, so an inline disable cannot switch a rule off | — |
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

Content types (`ContentItem`, `KanaData`, `VocabData`, `CustomVocabData`, `Phase`,
`ConfusionGroup`) are `z.infer` of the content schemas and are imported from
`@wara/content/schema`; `core` does not re-export them. `domain.ts` holds only the hand-written
`readonly` learner-state types. An absent value is `null`, never an optional field
(`exactOptionalPropertyTypes`; rows round-trip through Dexie and JSON). Timestamps are `Date`;
calendar days are `LocalDate`.

| Type | Key fields | Lives in |
| --- | --- | --- |
| `ContentItem` | discriminated union on `type`: `kana \| vocab \| grammar \| kanji`; `id`, `level`, `phase`, `tags`, `supersededBy?`, `data`. `vocab` splits on `source`: `'content'` (`VocabData`) or `'custom'` (`CustomVocabData`, id `vocab:custom:<uuid>`) | content bundle + `customContent` table |
| `KanaData` | `char`, `romaji`, `romajiAccepted` (accepted variants: を `o`/`wo`, ん `n`/`nn`), `script`, `group`, `mnemonic?` | content |
| `VocabData` | `word`, `reading`, `meaningId`, `pos`, `register`, `examples` | content |
| `CustomVocabData` | `word`, `reading`, `meaning` (free text, no `meaningId`) | `customContent` |
| `GrammarData` | `title`, `structure`, `explanationId`, `examples`, `pitfalls`, `exercises`, `priority?` | content |
| `KanjiData` | `kanji`, `meaningId`, `onyomi`, `kunyomi`, `vocabIds` | content |
| `ConfusionGroup` | `id`, `items` | `confusion-groups.json` |
| `LocalDate` | a `string` alias (`YYYY-MM-DD`), the learner's local date; computed from the device clock at the edge | `Session.date`, `JournalEntry.date`, `Assessment.date`, `UserProfile.startDate` |
| `Phase` | `0 \| 1 \| 2 \| 3`; returned by `derivePhase`, never stored | — |
| `Rating` | `RATING` const `{ again: 1, hard: 2, good: 3, easy: 4 }`; `Rating` is its value union. Returned by `rateAnswer` or given by the four buttons | — (stored in `ReviewLog.rating`) |
| `ReviewState` | `itemId`, `stability`, `difficulty`, `due`, `lastReview: Date \| null`, `reps`, `lapses`, `learningSteps`, `state: CardState` (`'new' \| 'learning' \| 'review' \| 'relearning'`, mapped to the ts-fsrs `State` numbers only in `srs/schedule.ts`) — the fields the ts-fsrs 5.4 `Card` mapping needs | `reviewStates` |
| `ReviewLog` | `id`, `itemId`, `at`, `rating: Rating`, `elapsedMs`, `confusedWith: string \| null` | `reviewLogs` |
| `Session` | `id`, `date`, `plannedMin`, `actualMin`, `activities: ReadonlyArray<SessionActivity>`, `cursor: number` (index of the next activity), `completed` | `sessions` |
| `SessionActivity` | `{ kind: SessionActivityKind; itemIds: ReadonlyArray<string>; estimatedSec: number; done: boolean }`, `SessionActivityKind` = `'review' \| 'new' \| 'production'`; the new items a session introduced are the `itemIds` of its `kind: 'new'` activities | `Session.activities` |
| `JournalEntry` | `id`, `date`, `source: { anime, episode: number \| null } \| null`, `sentenceKana`, `guess`, `context: string \| null`, `status: JournalStatus` (`'draft' \| 'needs_review' \| 'corrected'`), `correction: { sentence, meaning, note: string \| null } \| null`, `extractedVocabIds` | `journal` |
| `Assessment` | discriminated union on `kind` with two members. `KanaExitAssessment`: `id`, `date`, `kind: 'kana-exit'`, `passed`, `correct`, `total`, `elapsedMs`, `wrong` (item ids answered wrong). `JlptSimAssessment`: `id`, `date`, `kind: 'jlpt-sim'`, `level: JlptLevel` (`'n5' \| 'n4'`), `score` (fraction correct, 0–1); written by the JLPT simulation (v0.4). A `weekly` member with per-module scores is added with the weekly test (v0.3) | `assessments` |
| `UserProfile` | `id: 'me'`, `name`, `dailyTargetMin`, `romajiAid: RomajiAid` (`'always' \| 'on-demand' \| 'off'`), `theme: Theme` (`'system' \| 'light' \| 'dark'`; onboarding writes `'system'`), `ttsVoiceUri: string \| null` (`null` = the device's default Japanese voice), `startDate`, `weakSeeds` (seed ids introduced first as new material) | `profile` |
| `ExportBundle` | `format: 'wara-export'`, `version: 1`, `exportedAt: Date`, `profile: UserProfile \| null`, `reviewStates`, `reviewLogs`, `sessions`, `journal`, `assessments`, `customContent: ReadonlyArray<CustomVocabItem>`; returned by `exportAll`. `exportBundleSchema` (`apps/web/src/data/exportBundleSchema.ts`) is annotated `z.ZodType<ExportBundle>`; every object is strict; timestamps are ISO-8601 UTC (`Z`) strings parsed to `Date`; `LocalDate`s stay `YYYY-MM-DD` strings; item ids are checked with the content id schemas; `customContent` with `customVocabItemSchema` | the export file |

`meaningId` and `explanationId` resolve in `packages/content/data/i18n/id.json`; a second UI
language is a data addition. Confusion-group membership lives only in `confusion-groups.json`; an
item may belong to several groups. The current phase is always derived, never a profile field.

## 6. Core contracts

Every function below is pure, takes `now`, takes `today: LocalDate` where calendar days matter,
and takes `rng` where it samples. Reference: *none yet*.

`packages/core/src/` groups functions by concern: `answer/` (`romajiMatches`, `rateAnswer`), `srs/`
(`schedule`, `applyConfusion`), `session/` (`planSession`, `defaults.ts`), `phase/` (`derivePhase`,
`evaluateKanaExit`, `kanaExitAvailable`), `progress/` (`streak`, later `progressSummary`); the
placement of `nextCurriculumUnit` is decided with it. `tests/` mirrors this layout.

| Function | Signature (abridged) | Rule |
| --- | --- | --- |
| `romajiMatches` | `({ reading, given, kana }: { reading: string; given: string; kana: ReadonlyArray<KanaData> }) => boolean` | The reading (one kana or a whole word) is tokenised longest-match first (しゃ before し); each token accepts its `romajiAccepted` variants; small っ/ッ doubles the first consonant of the next token; ー repeats the previous vowel (a typed `-` is also accepted); ん before a vowel or y accepts `n'` and `nn`. After small っ/ッ a token starting with `ch` also accepts `tch` (っち → `cchi` or `tchi`); a っ/ッ with no following consonant (end of the reading, or before a vowel-initial token) adds nothing; ー at the start of a reading or after ん accepts only `-`. Comparison uses the given text trimmed and lower-cased. A reading containing a kana not in `kana` throws `ContentValidationError` (the content validator makes that unreachable). |
| `rateAnswer` | `({ correct, elapsedMs, mode }: { correct: boolean; elapsedMs: number; mode: 'choice' \| 'typed' }) => Rating` | Wrong → Again at any speed. Correct, by inclusive elapsed-time thresholds: typed — ≤ `RATE_TYPED_EASY_MAX_MS` (2.5 s) Easy, ≤ `RATE_TYPED_GOOD_MAX_MS` (6 s) Good, slower Hard; choice — ≤ `RATE_CHOICE_GOOD_MAX_MS` (4 s) Good, slower Hard. Multiple choice is capped at Good; typed can reach Easy. Correctness comes from `romajiMatches` (typed) or an id comparison (choice). Open-recall cards are not rated here: the learner's four buttons give the `Rating`. |
| `schedule` | `({ itemId, state: ReviewState \| null, rating, now, weakSeeds }) => ReviewState` | Wraps ts-fsrs 5.4 with `FSRS_DESIRED_RETENTION` and fuzz off (`FSRS_ENABLE_FUZZ`), so identical inputs give identical output. `state: null` is the first review and starts from an empty card at `now`. An item in `weakSeeds` on its first review is first given a virtual Again at `now`, then the actual rating, and its `lapses` is 1 (as if it had lapsed once). `lastReview` becomes `now`; `itemId` is preserved; the input state is never mutated. |
| `applyConfusion` | `({ itemId, given, groups, items, states, now }: { itemId: string; given: ConfusionAnswer; groups: ReadonlyArray<ConfusionGroup>; items: ReadonlyArray<ContentItem>; states: ReadonlyArray<ReviewState>; now: Date }) => { confusedWith: string \| null; moved: ReadonlyArray<ReviewState>; priorityNew: ReadonlyArray<string> }`, `ConfusionAnswer` = `{ mode: 'typed'; text: string } \| { mode: 'choice'; itemId: string }` | A's partners are the other members of every group containing A (`itemId`), in group order; a superseded partner is ignored. A typed answer confuses A with the first partner B whose reading `romajiMatches` it (a kana item's reading is its `char`, a vocab item's its `reading`); a choice answer with the chosen id when it is a partner. An answer that matches A itself, or no partner, returns `{ confusedWith: null, moved: [], priorityNew: [] }`. Only the one confused partner is returned (a group of four yields one pair). A is scheduled normally (Again, through `schedule`); B's `due` becomes the earlier of its `due` and `now` (a partner already overdue is not pushed later), with stability and difficulty unchanged (`moved`); a B with no state is returned in `priorityNew`. `confusedWith` is written to A's `ReviewLog`. The contrast drill is neither logged nor scheduled. |
| `planSession` | `({ availableMin, items, states, profile, phase, sessionsToday, now, today, rng }) => SessionPlan`, `SessionPlan` = `{ plannedMin: number; activities: ReadonlyArray<SessionActivity> }`; `curriculumCursor` returns as an input with the curriculum (v0.2) | Due = the `states` with `due <= now` whose item exists and is not superseded, most overdue first (ties by `itemId`). Review takes as many as fit in `availableMin` at `REVIEW_ITEM_SEC` each; the rest stay due for the next session (a session never exceeds `availableMin`). Production then takes up to `SESSION_SPLIT_MIN.production` / total of the session; new material takes what remains (unused review time goes to new material; review overflow eats new material first). New items per day: `NEW_ITEMS_PER_DAY.phase0` in phase 0, `.later` after; halved when the due count exceeds `BACKLOG_HALVE_NEW_ABOVE`, zero above `BACKLOG_STOP_NEW_ABOVE`; minus the itemIds of `kind: 'new'` activities in `sessionsToday` sessions dated `today`. New pool (v0.1): items without a state, not superseded, with `phase <= phase`, not already introduced today, ordered `profile.weakSeeds` (profile order) → kana items in content order → vocabulary items in content order; each costs `NEW_ITEM_SEC`. Production items: this plan's new items, or its review items when it has none, shuffled with `rng` and cut to fit at `PRODUCTION_ITEM_SEC` each. Activities in display order review → new → production; empty ones omitted; `estimatedSec` = count × per-item seconds; `done: false`. Deterministic for identical inputs (including `rng`). |
| `derivePhase` | `({ assessments }: { assessments: ReadonlyArray<Assessment> }) => Phase` | Phase from assessments only (review states are not an input), cumulative: 0 by default; 1 when a passed `kana-exit` assessment exists (a `KanaExitAssessment` with `passed: true`; `kanaExitAvailable` reads it the same way); 2 when additionally the best `jlpt-sim` score at level `n5` is ≥ `JLPT_SIM_PASS_SCORE.n5` (0.80); 3 when additionally the best `n4` score is ≥ `JLPT_SIM_PASS_SCORE.n4` (0.70). Mirrors the measurable targets of `docs/learning-plan.md` §4. |
| `evaluateKanaExit` | `(answers: ReadonlyArray<{ itemId: string; correct: boolean }>, elapsedMs: number) => { passed: boolean; wrong: ReadonlyArray<string> }` | `elapsedMs` is the sum of per-word display times (a word appearing to "Siap"; typing time excluded). Pass = exactly `KANA_EXIT_WORD_COUNT` answers, all correct, and `elapsedMs` ≤ `KANA_EXIT_TIME_LIMIT_MS` (inclusive). `wrong` lists the item ids answered wrong, in answer order. Each kana-exit answer is also a review: `romajiMatches` → `rateAnswer` (mode `typed`, `elapsedMs` = that word's display time) → `schedule` → `commitReview`. |
| `kanaExitAvailable` | `({ kanaIds, states, assessments }: { kanaIds: ReadonlyArray<string>; states: ReadonlyArray<ReviewState>; assessments: ReadonlyArray<Assessment> }) => boolean` | True when every id in `kanaIds` has a `ReviewState` (each kana reviewed at least once) and no passed `kana-exit` assessment exists; an empty `kanaIds` returns false. Drives the "Tes keluar Fase 0" card on Beranda; a failed attempt keeps it true so the test can be retaken. |
| `nextCurriculumUnit` | `(curriculum, states) => Unit \| null` | The next unit whose `unlockWhen` holds, evaluated from review data only; `priority: true` units first. |
| `streak` | `({ sessions, today }) => { days: number; forgivenessUsedThisWeek: boolean }` | Consecutive local days ending today or yesterday with a completed session; one forgiveness day per ISO week. A day counts when it has at least one `completed` session; today without a completed session neither counts nor breaks the streak. Walking back from the latest counted day, a single missed day is forgiven (not counted, not breaking) when no forgiveness was used yet in that missed day's ISO week (Monday start) and the day before it counts; two consecutive missed days end the streak. `forgivenessUsedThisWeek` is true when a forgiven day lies in the ISO week of `today`. Sessions dated after `today` are ignored. Used by Beranda; `progressSummary` reuses it. |
| `progressSummary` | `(states, logs, sessions, now, today) => ProgressSummary` | Streak via `streak`, accuracy per confusion group from `ReviewLog.confusedWith`, on-track flag against the 12-month map. |

The placement test has no function of its own: each answer goes through `romajiMatches` →
`rateAnswer` → `schedule` → `commitReview`.

Defaults (`core/session/defaults.ts`): `DEFAULT_AVAILABLE_MIN` 30, `SESSION_SPLIT_MIN`
`{ review: 5, newMaterial: 15, production: 10 }`, `REVIEW_ITEM_SEC` 10, `NEW_ITEM_SEC` 30,
`PRODUCTION_ITEM_SEC` 20, `NEW_ITEMS_PER_DAY` `{ phase0: 20, later: 10 }`,
`BACKLOG_HALVE_NEW_ABOVE` 100, `BACKLOG_STOP_NEW_ABOVE` 200, `FSRS_DESIRED_RETENTION` 0.9,
`FSRS_ENABLE_FUZZ` false, `RATE_TYPED_EASY_MAX_MS` 2500, `RATE_TYPED_GOOD_MAX_MS` 6000,
`RATE_CHOICE_GOOD_MAX_MS` 4000, `KANA_EXIT_WORD_COUNT` 50, `KANA_EXIT_TIME_LIMIT_MS` 120000,
`JLPT_SIM_PASS_SCORE` `{ n5: 0.8, n4: 0.7 }`, `ROMAJI_AID_DEFAULT`
`{ phase0: 'on-demand', later: 'off' }` (the learner may change it),
`ROMAJI_AID_AUTO_OFF_ACCURACY` 0.95 and `ROMAJI_AID_AUTO_OFF_WINDOW` 200 (romaji aid turns off
at kana accuracy ≥ 0.95 over the last 200 kana reviews). A default is a named export, never a
literal at a call site.

Typed errors (`core/errors.ts`): `ContentValidationError`, re-exported from
`@wara/content/schema`; `RepositoryError` (`operation`, `ids`, `cause`); `ImportFormatError`
(`issues: { path, message }[]`). Messages carry paths, method names, and counts, never learner
values.

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

- The web implementation is `createDexieRepository(db: WaraDb, now: () => Date): Repository` in
  `apps/web/src/data/dexieRepository.ts`; `now` supplies `exportAll`'s `exportedAt`, and the
  composition root passes the device clock. A mobile implementation will be `expo-sqlite`; a sync
  layer wraps either and adds a `pendingOps` table.
- `commitReview` writes the states, the logs, and the session row (when given) in **one
  transaction**; a log without its state change corrupts FSRS history, and a session cursor ahead
  of its reviews skips them on resume. The running session calls it with its session; "Latih
  sekarang" and the placement test call it without one. Validation precedes the first write:
  every log's `itemId` must be among the states' itemIds (a state without a log is allowed — a
  confusion partner brought forward); otherwise it throws `RepositoryError` carrying the orphan
  logs' itemIds and writes nothing. The write is one `rw` transaction over `reviewStates`,
  `reviewLogs`, and `sessions`; a storage failure rejects with `RepositoryError` (`ids` = the
  states' itemIds) and the aborted transaction leaves no row.
- The write methods (`commitReview`, `saveSession`, `saveProfile`, `saveJournalEntry`,
  `saveAssessment`, `importAll`) wrap a `Dexie.DexieError` in `RepositoryError` (`operation` = the
  method name) and rethrow anything else; reads do not wrap.
- `getReviewStates(ids)` returns the rows in `ids` order, skipping ids without a row.
  `getDueStates(before)` returns the states with `due <= before`, ordered by `due`, then `itemId`.
- `saveSession` creates and finishes a session row.
- `getSessions(from?)` returns the sessions with `date >= from` (all when omitted), ordered by
  date, then id. The planning hook calls `getSessions(today)` for `planSession`'s `sessionsToday`
  and for Beranda's "Lanjutkan sesi" (today's unfinished session); Beranda's streak calls
  `getSessions()`.
- The planning hook reads all review states (`getReviewStates` over the content ids) and passes
  them to `planSession` as `states`; `getDueStates` serves Beranda's due counts.
- `exportAll` reads all seven tables in one read transaction, each collection in primary-key
  order.
- `importAll` takes `unknown`, parses it with `exportBundleSchema` (the one edge where stored data
  is external), and **replaces** the database only after the whole bundle validates. A parse
  failure throws `ImportFormatError` whose issue paths are the Zod paths joined by `.`
  (`reviewStates.0.due`) and writes nothing; on success it clears and refills all seven tables in
  one `rw` transaction. It is called only after an explicit confirmation dialog.

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

`WaraDb extends Dexie`; its constructor takes `(name, options?: DexieOptions)`, so tests pass
`fake-indexeddb`'s `IDBFactory` and `IDBKeyRange`. Tables are typed through `this.table(...)`; the
file holds no module-level instance — the composition root creates it.

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
  Data-layer tests (`tests/data/`) open a fresh `WaraDb` per test over a new `fake-indexeddb`
  `IDBFactory`, seed through the repository, and force a storage failure with a row carrying a
  non-cloneable function property (structured clone throws `DataCloneError`).
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