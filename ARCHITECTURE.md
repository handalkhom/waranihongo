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
  packages/content/         @wara/content: JSON data + Zod schemas + validate/bundle scripts
  tests/ (per package)      each package has its own tests/ tree mirroring its src/
  docs/                     learning-plan.md, qa-session.md (tracked in git)
  CLAUDE.md  ARCHITECTURE.md  MEMORY.md  Wara-Product-Architecture.md
  package.json              npm workspaces; root scripts fan out with --workspaces
```

**Dependency direction, one way:** `content` ← `core` ← `web`. `core` imports only content
schemas (`@wara/content/schema`) for types, never a data bundle; data reaches it as arguments.
`core` imports no React, DOM, or Dexie. Nothing imports `web`. A future `apps/api` (Hono) and
`apps/mobile` (Expo) sit beside `web` and obey the same direction. Enforced by an ESLint
`no-restricted-imports` rule per package (written with the first module — *none yet*).

## 3. Technology decisions

| Concern | Choice | Reason |
| --- | --- | --- |
| Language | TypeScript 6, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters` | The compiler is the proof |
| Package manager | npm workspaces | One lockfile; matches the owner's other projects |
| Web runtime | React 19 + Vite 8, `vite-plugin-pwa` (Workbox, `autoUpdate`) | Installable, offline, no server |
| Routing | React Router 8 from `react-router` (`RouterProvider` from `react-router/dom`) | Route table as data, one guard |
| Persistence | `dexie` 4 + `dexie-react-hooks` (`useLiveQuery`) | IndexedDB with reactive reads; `fake-indexeddb` in tests |
| Server state | **Not installed** before v1.0 | No network source exists; two reactive caches over one table would fight |
| SRS | `ts-fsrs` | Current standard scheduler; parameters can later be fitted to the learner's log; wrapped in one file |
| Client state | One Context per concern: `SessionContext`, `SettingsContext` | Only two cross-route concerns |
| Forms | React Hook Form 7 + Zod 4 via `@hookform/resolvers` | Journal entry and settings; the official resolver |
| Styling | Tailwind CSS 4 in CSS (`@theme`), no config file | — |
| Components | shadcn/ui on Base UI (`@base-ui/react`), `tsx: true`; `lucide-react`; `cn()` from `clsx` + `tailwind-merge` in `src/lib/utils.ts` | Primitives owned by the repo; the `shadcn` package is not a dependency, its stylesheet is vendored |
| Fonts | System font stack; `lang="ja"` on Japanese text | No multi-MB web font; the OS Japanese font is correct and offline |
| Charts | `recharts` 3, behind `React.lazy` on the progress page only | Bundle size |
| Audio | Web Speech API through `src/services/tts.ts` | No audio files in phase 1 |
| Lint | ESLint 10 flat config with `typescript-eslint`, `react-hooks`, `react-refresh`; errors on `any`, `@ts-ignore`, `==`, `react-router-dom` imports | — |
| Tests | Vitest 5; `core` and `content` unit-level; `web` with jsdom + React Testing Library + `fake-indexeddb` | Route tests run the real repository against an in-memory IndexedDB |

Not chosen and not to be assumed: Redux, Zustand, TanStack Query (before v1.0), Axios, Prettier,
MSW (before v1.0), another component library. Adding a dependency is a coordinator decision
recorded in this table.

Facts about the tools that shape the code:

- `baseUrl` is deprecated in TS 6; the `@/*` alias is `paths` only, repeated in `vite.config.ts`.
- Base UI composes through `render`, not `asChild`; state attributes are `data-open`, not
  `data-state`. A registry primitive's hand edits are re-applied after any `shadcn add`; the CLI's
  `cn` package is removed from `package.json` after each add.
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
  → RouterProvider (apps/web/src/app/App.tsx: createBrowserRouter(appRoutes))
    → OnboardingGuard                 // redirects to /mulai while no profile row exists
      → AppLayout                     // bottom tabs < lg, sidebar ≥ lg; hidden on /sesi
        → Page (lazy per route)
          → Feature hook              // composes core + repository; owns no rule
            → @wara/core              // pure: schedule, planSession, applyConfusion, nextUnit
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
| `@wara/content` | Data, schemas, validate and bundle | Hold logic beyond load/validate |
| `@wara/core` | Domain model, FSRS wrapper, planner, confusion logic, curriculum unlock, progress math, typed errors, `Repository` interface | Import React/DOM/Dexie; read the clock or RNG |
| `src/data/` | Implement `Repository` over Dexie; schema versions; export/import | Contain a scheduling or scoring rule |
| Feature hook | Compose core + repository; expose read models and actions | Render; hold a rule |
| Component/page | Render, interaction, local state | Touch Dexie, storage, TTS, or core scheduling directly |
| Shared component (`src/components/`) | Props-driven UI from primitives | Import from a module; call a data hook |
| Context provider | The two cross-route concerns above | Cache an IndexedDB table |
| `services/tts.ts` | The only reader of `window.speechSynthesis` | Know content or scheduling |

## 5. Domain model (`packages/core/src/domain.ts`)

Types are `z.infer` of the content schemas where they describe content, and hand-written
`readonly` types where they describe learner state.

| Type | Key fields | Lives in |
| --- | --- | --- |
| `ContentItem` | discriminated union on `type`: `kana \| vocab \| grammar \| kanji`; `id`, `level`, `phase`, `tags`, `supersededBy?`, `data` | content bundles + `customContent` table |
| `KanaData` | `char`, `romaji`, `script`, `group`, `confusionGroup?`, `mnemonic?` | content |
| `VocabData` | `word`, `reading`, `meaningId`, `pos`, `register`, `examples` | content |
| `GrammarData` | `title`, `structure`, `explanationId`, `examples`, `pitfalls`, `exercises`, `priority?` | content |
| `KanjiData` | `kanji`, `meaningId`, `onyomi`, `kunyomi`, `vocabIds` | content |
| `ReviewState` | `itemId`, `stability`, `difficulty`, `due`, `reps`, `lapses`, `state`, `seededWeak` | `reviewStates` |
| `ReviewLog` | `id`, `itemId`, `at`, `rating` (1–4), `elapsedMs`, `confusedWith?` | `reviewLogs` |
| `Session` | `id`, `date`, `plannedMin`, `actualMin`, `activities`, `completed` | `sessions` |
| `JournalEntry` | `id`, `date`, `source?`, `sentenceKana`, `guess`, `status`, `correction?`, `extractedVocabIds` | `journal` |
| `Assessment` | `id`, `date`, `kind`, `scores` | `assessments` |
| `UserProfile` | `id: 'me'`, `name`, `dailyTargetMin`, `romajiAid`, `currentPhase`, `startDate`, `weakSeeds` | `profile` |

`meaningId` and `explanationId` resolve in `packages/content/data/i18n/id.json`; a second UI
language is a data addition.

## 6. Core contracts

Every function below is pure and takes `now` (and `rng` where it samples). Reference: *none yet*.

| Function | Signature (abridged) | Rule |
| --- | --- | --- |
| `schedule` | `(state, rating, now) => ReviewState` | Wraps `ts-fsrs`. A `seededWeak` state is initialised as if it had lapsed once. |
| `applyConfusion` | `(log, states, groups) => ReadonlyArray<{ itemId; boost }>` | A wrong answer matching another member of the same group brings both forward and flags a contrast drill. |
| `planSession` | `({ availableMin, dueStates, cursor, profile, now, rng }) => SessionPlan` | Ordered activities with estimated seconds. When time is short: review → production → new material. Deterministic for identical inputs. |
| `nextCurriculumUnit` | `(curriculum, states) => Unit \| null` | The next unit whose `unlockWhen` holds, evaluated from review data only; `priority: true` units first. |
| `progressSummary` | `(states, logs, sessions, now) => ProgressSummary` | Streak (one forgiveness day per week), accuracy per confusion group, on-track flag against the 12-month map. |

Defaults (`core/session/defaults.ts`): `availableMin` 30, split 5/15/10, new items per day 20 in
phase 0 and 10 after, romaji aid auto-off at kana accuracy ≥ 0.95 over the last 200 kana reviews.
A default is a named export, never a literal at a call site.

Typed errors (`core/errors.ts`): `ContentValidationError`, `RepositoryError`,
`ImportFormatError`, each carrying the ids involved.

## 7. Repository contract (`packages/core/src/repository.ts`)

```ts
export interface Repository {
  readonly getReviewStates: (ids: ReadonlyArray<string>) => Promise<ReadonlyArray<ReviewState>>
  readonly getDueStates: (before: Date) => Promise<ReadonlyArray<ReviewState>>
  readonly commitReview: (states: ReadonlyArray<ReviewState>, logs: ReadonlyArray<ReviewLog>) => Promise<void>
  readonly saveSession: (session: Session) => Promise<void>
  readonly getProfile: () => Promise<UserProfile | null>
  readonly saveProfile: (profile: UserProfile) => Promise<void>
  readonly saveJournalEntry: (entry: JournalEntry) => Promise<void>
  readonly saveAssessment: (assessment: Assessment) => Promise<void>
  readonly exportAll: () => Promise<ExportBundle>
  readonly importAll: (bundle: unknown) => Promise<void>
}
```

- `commitReview` writes states and logs in **one transaction**; a log without its state change
  corrupts FSRS history.
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
- `src/schema/*.ts` are Zod schemas; `src/index.ts` exports parsed, typed bundles. A bundle that
  fails to parse throws `ContentValidationError` at module load — the application does not start
  on bad content.
- `npm run validate -w @wara/content` additionally checks: every referenced id exists
  (`vocabIds`, `items`, `supersededBy`, `confusionGroup`); every `meaningId` / `explanationId`
  resolves; no duplicate id; every id in `seed/alan-weak.json` exists.
- `npm run bundle -w @wara/content` writes `dist/phase{0..3}.json`. Phase 0 is imported
  statically by `apps/web`; later phases through `import()` when their first unit unlocks.
- Ids are permanent. Deprecation is `supersededBy`; the planner treats a superseded item as
  retired and its review state as read-only history.

## 9. Routes (`apps/web/src/app/router.tsx`)

| Path | Page | Notes |
| --- | --- | --- |
| `/mulai` | `OnboardingPage` | Only route while no profile exists; redirects to `/` once one does |
| `/` | `HomePage` | Streak, due counts, "Mulai sesi hari ini", 12-month map |
| `/sesi` | `SessionPage` | Full-screen; mounts `SessionProvider`; hides the app chrome |
| `/belajar` | `LearnPage` | Browse content outside a session |
| `/belajar/:type/:id` | `ItemPage` | One item; "Latih sekarang" is the only way browsing touches the SRS |
| `/jurnal`, `/jurnal/baru`, `/jurnal/:id` | journal pages | RHF + Zod form |
| `/progres` | `ProgressPage` | `lazy`; recharts lives here |
| `/pengaturan` | `SettingsPage` | romaji aid, target, voice, theme, export/import |
| `*` | — | Redirects to `/` |

The route table is an exported `RouteObject[]`; `App.tsx` and `tests/renderApp.tsx` both consume
it. Pages are lazy per route with `PageLoader` as `hydrateFallbackElement`.

## 10. State contract

| Scope | Mechanism | Used for |
| --- | --- | --- |
| IndexedDB | `Repository` writes; `useLiveQuery` reads | Everything the learner has done |
| URL | search params | `LearnPage` filters (`?type=`, `?phase=`), the journal list's `?status=` |
| Context | `SettingsContext`, `SessionContext` | Render-time settings; the running session |
| Component | `useState` | Card flipped, answer typed, dialog open |

- Settings are persisted in the `profile` row and mirrored into `SettingsContext` on load and on
  each save; the Context is a read-through, not a second source.
- `SessionProvider` persists the session row after every activity, so a closed tab resumes.
- No IndexedDB row is ever copied into component state as a cache; a list renders from
  `useLiveQuery`.

## 11. Testing

- **`core`**: Vitest, pure; every exported function has a test file; `schedule` and `planSession`
  are additionally property-tested for determinism (same inputs → same output).
- **`content`**: Vitest runs the validator against the real data; a schema change ships with a
  fixture that fails it.
- **`web`**: Vitest + jsdom + React Testing Library + `fake-indexeddb`. `tests/renderApp.tsx`
  renders the real providers and route table on a memory router over a fresh in-memory database
  seeded through the real repository. Every page has a route test covering empty, loading,
  success, and error. A behaviour change ships with a route or component test, not only a core
  test. `URL.createObjectURL` is stubbed per test that exports. `speechSynthesis` is absent in
  jsdom; `tts.ts` is stubbed through its one module.
- `tests/` is a separate tree per package mirroring `src/`; no colocated tests.

## 12. Verification

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

Coordinator-only decisions, binding from the first line: adding a package or a module; a new Dexie
schema version; changing the `Repository` interface or a module's `index.ts` surface; changing a
default in `core/session/defaults.ts`; deprecating a content id; adding a dependency.

## 14. Change management

This file changes only when the architecture or a standing rule changes, and is written as the
present state. A rule is written here once the code follows it; until then it is recorded in
`MEMORY.md`. Page content goes to `Wara-Product-Architecture.md`. A cross-file contract — a
literal, shape, or invariant that must stay identical in two files — is recorded here at the
section that owns the subject, never in a code comment.