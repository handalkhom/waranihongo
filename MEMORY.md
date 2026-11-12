# MEMORY — Wara no Nihongo

The single home of the project's **running content**. This file must stay small.

* **Belongs here:** dated decisions and who took them, project state, the LAST verification result,
what is not verified, open decisions, load-bearing code facts, traps, the learner's evolving
profile where it shapes the product, the user's standing working preferences.
* **Does not belong here:** architecture and standing rules (`ARCHITECTURE.md`, `CLAUDE.md`); what
a screen shows (`Wara-Product-Architecture.md`); the placement test itself
(`docs/learning-plan.md`).
* **Maintenance:** rewrite or delete an entry when its fact changes; never leave an answered item
open; date every entry that records state; a superseded verification result is replaced.

## Origin

Created 2026-11-09 from the owner's Satu Data Diaspora frontend and Hono backend setups. Kept: the
three-way document split, Code Philosophy, the coordinator/worker protocol, the delegation shape,
the test discipline. Replaced: all technical content. Two of that setup's lessons apply verbatim —
**recorded state is a hypothesis** (re-run the command; a worker that finds the tree contradicting
its brief trusts the tree, records, reports, continues), and **adapting a setup across stacks
drops the architecture with the framework** (carry the pattern, drop the framework content).

## User working preferences — instructions, not observations

* All edits through sub-agents, one file per sub-agent; the main thread briefs and reviews.
* Delegation shape fixed: groups of three in parallel, groups sequential, progress per group.
* Full TDD: every behavioural file is red → green (ARCHITECTURE.md §11); exemptions are config,
styling, content data, TTS/PWA.
* Scaffolding exception: plan step 0.1.1 is one general-purpose agent, no TDD.
* No Python. No time or effort estimates, scores, or comparative scoring.
* Reply in Indonesian. Rule documents and code English; product document, UI copy, comments (if
any) Indonesian; Japanese content in kana/kanji.
* Ask when a decision is genuinely the user's (naming, scope, a schema, a dependency); do not stop
on routine work.
* Decisions are presented as multiple-choice questions, each with its catch and a recommendation;
the owner picks.
* Honesty about verification: a command not run is not reported as passing; a drill not done on a
phone is not reported as working; quote a measurement with its date.
* Git: commit/push only on request; no AI attribution anywhere.
* **The user is also the learner.** A request may arrive as a learning need ("saya selalu tertukar
ノ dan メ"). Translate it to content first (a confusion group, a seed), code second.

## The learner (2026-11-10) — why the product is shaped this way

* Placement test 2026-11-09, full record in `docs/learning-plan.md`. Hiragana 6/13, katakana \~2/10;
production in romaji above beginner (correct は/を/でも/じゃない/から). Three vocabulary misses
were kana misreads of words known by ear. **Reading is the bottleneck, not vocabulary.**
* Seeded weak (`seed/alan-weak.json`): ね ほ れ を ぴ た け に, しゃ しゅ しょ, っ; ン シ ツ ソ ノ
(た け に added 2026-11-10 from the vocabulary misreads).
* Confusion groups (11), identical with `docs/learning-plan.md` §3: ね/れ/わ, ほ/は/ま, に/こ,
き/け, っ/つ, しゃ/しょ, ン/シ/ツ/ソ, ノ/メ, ク/タ, コ/ユ, ル/レ.
* Romaji: the learner chose a free setting — default on-demand in phase 0, auto-off at ≥ 95%,
default off from phase 1, can be turned back on. `docs/learning-plan.md` §5 rewritten to match.
* Grammar `priority: true` in phase 1: に vs で, が for すき/きらい/わかる/できる, -i vs -na
adjectives, ～ませんでした.
* 30 minutes active daily; anime daily as passive input; goals include work, so `register` tags
and a plain-vs-rough warning matter.
* Re-assessed after each weekly test that changes a priority and at each phase transition; this
section and `docs/learning-plan.md` are updated together.

## Project state (2026-11-12)

* **Git (2026-11-12):** remote `origin` = `https://github.com/handalkhom/waranihongo.git`;
branch `main` (renamed from `master` 2026-11-12 at the owner's request) tracks `origin/main`.
The GitHub default branch and the Vercel Production Branch are `main`; `origin/master` has been
deleted (2026-11-12). This machine has `core.autocrlf=true`; the documents are CRLF.
* **`docs/` is git-ignored and gone from history (2026-11-10, owner's request):** removed with
`git filter-branch --index-filter` + `git push --force-with-lease`. Rewritten commits: `f980861`
baseline, `a3a99a0` apply design decisions, `d446ea1` decide kana-exit answer mode and card
trigger; the old hashes `f532e6b`/`669b3bc`/`e74bcf4` no longer exist. `docs/learning-plan.md`
and `docs/plan-v0.1.md` live only on the owner's disk — git is not their backup.
* **Agent files exist:** `.claude/agents/{coordinator,core-coder,web-coder,content-author,test-coder}.md`.
* Planning documents and agent files reflect the decisions below.
* **Step 0.1.1 (scaffold) done (2026-11-10):** npm workspaces `@wara/content`, `@wara/core`,
`@wara/web`; the five root checks green; committed as `[WARA-0.1.1]`. Every other block in
`ARCHITECTURE.md` is Decided, not yet built.
* **Step 0.1.2 (content schemas and validator) done (2026-11-12):** built test-first in
`packages/content`: `src/schema/errors.ts`, `id.ts`, `dataFiles.ts`, `item.ts`,
`src/validate/validateBundle.ts`, `src/bundle.ts` (`parseBundle`), entry `src/schema/index.ts`;
183 tests green; committed as `[WARA-0.1.2]`.
* **Step 0.1.3 (content data v0.1) done (2026-11-12):** in `packages/content`:
`data/kana/hiragana.json` 105 items (46 basic, 20 dakuten, 5 handakuten, 33 combination, っ),
`data/kana/katakana.json` 129 (same plus ッ, ー, 23 extended), `data/vocab/reading-practice.json`
80 words (54 hiragana, 26 katakana), `data/confusion-groups.json` 11 groups,
`data/seed/alan-weak.json` 17 ids, `data/i18n/id.json` 80 meanings. `@wara/content` exports
`contentBundle`, parsed at module load (JSON imported `with { type: 'json' }`); committed as
`[WARA-0.1.3]`.
* **Step 0.1.4 (core types) done (2026-11-12):** in `packages/core/src`: `domain.ts` (learner-state
types), `errors.ts`, `repository.ts`, and the package entry `index.ts` (explicit named
re-exports). Verified by lint + typecheck only, per the plan (decisions below).
* **Next step: 0.1.5 (core functions, test-first).**
* **Not yet written:** `docs/qa-session.md`, the ESLint tier rule, `docs/plan-v0.2.md`.
* **Last verification (2026-11-12, step 0.1.4):** `lint`, `typecheck`, `test` (224 passed —
0.1.4 adds no tests), `build`, and `validate -w @wara/content` (41 passed) all exit 0; no
`Date.now`/`new Date(`/`Math.random` under `packages/core/src`; a scratch consumer probe resolved
all 24 `@wara/core` exports and rejected a missing name.
* **Guards and orchestration skill: NOT installed (checked 2026-11-09, re-checked 2026-11-10,
  user's machine `GMBR-KEMLU-100`, Git Bash):** `~/.claude/hooks/` does not exist,
  `~/.claude/settings.json` has no `hooks` key, and `~/.claude/skills/` holds only `synced/` with
  nothing matching "orchestrat". Every guard in `CLAUDE.md` is run by hand; the coordinator
  classifies size and tracks phases manually, as its "FIRST ACTION" already allows. Re-check with
  the same commands before assuming otherwise.

## Decisions

Taken by the user, 2026-11-09:

* The application is named **Wara no Nihongo** (我 ware + 笑 warai), stylised ワラの日本語.
* **TypeScript**, not JavaScript — chosen after the assistant's recommendation; the LMS project's
JavaScript rule was a legacy-codebase decision and does not apply here.
* The owner's Diaspora/Hono setup is the base for the rule documents; development runs in Claude
Code with the coordinator/worker protocol.
* Target: N4 in 12 months (N2 remains the long-term goal); daily budget 30 minutes.

Taken by the user, 2026-11-10:

* Full TDD: test-first per file, two agents, coordinator verifies red.
* Module tiers: leaf `kana vocab grammar kanji`; composer `session learn` (import leaves via
`index.ts`); standalone `journal progress settings`. `learn` owns `/belajar`.
* Ids: Japanese written form as slug (`kana:hira:ぢ`, `vocab:n5:橋`, `vocab:n5:一日~ついたち`,
`kanji:n5:日`, `vocab:custom:<uuid>`); NFC and script checks in the validator.
* Thin v0.1: kana, onboarding with placement test, simple Beranda, session, kana-exit test,
minimal settings with Export, PWA, Vercel. Release order: v0.2 N5 (+ `learn`, Import) → v0.3
Journal + Progress → v0.4 N4 + simulation. N5 content authored in parallel from v0.1.
* TypeScript: try 7 at init, fall back to latest 6.x if typescript-eslint/Vite tooling fails;
record the outcome here. `ts-fsrs` 6.
* Placement test: hiragana + katakana basics, typed romaji; every answer is a real review via
`commitReview`. File seeds not covered → `profile.weakSeeds`.
* Seeds + 11 confusion groups as in The learner; membership only in `confusion-groups.json`.
* Rating hybrid: automatic for objective drills (`rateAnswer`), four buttons for open recall.
* Romaji free setting (overrides the original learning-plan rule).
* Phase derived from data (`derivePhase`); `currentPhase` and `seededWeak` removed.
* `commitReview(states, logs, session?)` — one transaction including session progress.
* Core takes `today: LocalDate` beside `now`.
* Confusion: partner's due → now, stability unchanged; contrast drill not logged.
* Overflow: review first; overflow eats the new-material slice; new items throttled on backlog;
display order review → new → production.
* One content bundle, no per-phase lazy loading; `bundle` script removed.
* Learner-made vocab: `ContentItem` vocab branch `source: 'custom'`, free-text meaning.
* Phase-0 exit: timed `kana-exit` test (50 words, 2 min of display time — answer mode below)
unlocks phase 1; reading-practice words ≥ 60.
* Docs: product doc renamed to `Wara-Product-Architecture.md`; composition root `src/app/App.tsx`;
`src/lib/cn.ts` instead of `utils.ts`.
* Commit id = plan step (`[WARA-0.1.3]`); MEMORY.md is the only project memory; hosting Vercel.
* `kana-exit` answer mode: look → "Siap" → word hidden → type romaji. The timer counts only display
time (word visible until "Siap"); typing time is excluded, so the test measures reading speed, not
typing. Pass = 50 correct with total display time ≤ 120 s. Each answer is also a review
(`romajiMatches` → `rateAnswer` typed with that word's display time → `schedule` →
`commitReview`).
* `kana-exit` card on Beranda appears after every kana has been reviewed at least once, until the
test is passed; a failed attempt can be retaken from the same card.
* Repo structure stays a **monorepo with npm workspaces** (the owner asked whether one package
would do): kept for the DOM-free `core` tsconfig, separate test environments per package, and
v1.0 reuse of `@wara/core`/`@wara/content` by `apps/api` and `apps/mobile`.
* `docs/` is git-ignored (it holds the personal learner profile) and was removed from history.
* Vercel project Root Directory = `apps/web` (`apps/web/vercel.json` holds the SPA rewrite);
"Include files outside the Root Directory in the Build Step" must stay enabled so `packages/` and
`tsconfig.base.json` are available. Vercel runs only `vite build` — deploys do not run typecheck
or lint. The hello deploy is done by the owner. Install runs at the repo root through
`installCommand` (coordinator decision 2026-11-12, below).

Taken by the user, 2026-11-12:

* Branch: the production branch is `main` (not `master`). Until v0.1 is in daily use, commits go
straight to `main`; before tagging v0.1 a `dev` branch is created for work (Vercel preview URL)
and merged into `main` after the phone check.

Taken by the coordinator, 2026-11-10, within the decisions above:

* `planSession` takes `phase`, `sessionsToday`, `curriculumCursor` (not `Session.cursor`, the
next-activity index).
* `Session.activities: ReadonlyArray<SessionActivity>` (`kind: 'review' | 'new' | 'production'`);
new items introduced today are counted from `kind: 'new'` activities.
* Repository `getSessions(from?)`; core `streak({ sessions, today })`.
* `ReviewState` adds `lastReview`, `learningSteps`, drops `seededWeak`.
* `applyConfusion` returns `{ confusedWith, moved, priorityNew }`; vocab branch
`source: 'content' | 'custom'`.
* Web derives `today` with one helper, `toLocalDate(now)` in `apps/web/src/utils/localDate.ts`.
* A stub brief verifies with lint + typecheck only; tests come after the stub.
* `romajiMatches({ reading, given, kana })` split out of `rateAnswer` (2026-11-10):
`romajiAccepted` exists only on kana items, so a whole word (kana reading, no romaji in content)
could not be matched. `romajiMatches` composes accepted variants token by token (longest match,
っ doubles the next consonant, ー repeats the vowel or accepts `-`, ん before vowel/y accepts
`n'`/`nn`); `rateAnswer` now takes `{ correct, elapsedMs, mode }`. Also
`kanaExitAvailable({ kanaIds, states, assessments })` in core owns the Beranda card rule so it
does not live in a hook.
* **TypeScript outcome (2026-11-10): 6.0.3 (`~6.0.3`).** TS 7.0.2 (`typescript@latest`) was tried
and rejected: the `typescript-eslint@8.72.2` peer range is `>=4.8.4 <6.1.0` (no version, canary
included, accepts 7.x), and TS 7's JS module exports only `version`/`versionMajorMinor` — no
compiler API for type-aware linting. Revisit when typescript-eslint supports TS 7. Other versions
installed: React 19.3.1, Vite 8.3.7, Vitest 5.1.0, ESLint 10.14.0, typescript-eslint 8.72.2,
Tailwind 4.3.5, Zod 4.6.7.
* **Every workspace declares what it imports (2026-11-12):** `vitest` moved from the root
`package.json` into the `@wara/web`, `@wara/core`, `@wara/content` devDependencies after the first
Vercel deploy failed with `Cannot find package 'vitest'` from `apps/web/vite.config.ts` — a
phantom dependency that worked locally only through hoisting. `typescript` stays root-declared
(used by the workspace `tsc` scripts; not used by `vite build`).
* **`apps/web/vercel.json` has `"installCommand": "cd ../.. && npm ci"` (2026-11-12):** the
failed deploy installed only 84 packages inside `apps/web`, ignoring the root lockfile (a web-only
simulation reproduced it: unpinned versions, and a future `@wara/core` dependency would be fetched
from the registry). Installing at the root with `npm ci` keeps the lockfile authoritative.

Taken by the coordinator, 2026-11-12 (step 0.1.2):

* `ContentValidationError` and `ContentIssue` live in `@wara/content/schema`
(`src/schema/errors.ts`), not in core: `content` may not import `core`, yet `content` must throw
it at load; `core` re-exports it. CLAUDE.md's "Typed error classes in core" list is read with
that exception.
* The export-bundle (import/export JSON) schema is deferred from 0.1.2 to step 0.1.6: it
describes learner state whose types belong to `core`; it will be a Zod schema at the `importAll`
edge tied to the core types (`satisfies z.ZodType<…>`).
* v0.1 content schemas cover kana and vocab only; `ContentItem` = kana | vocab(`source:
'content'`) | vocab(`source: 'custom'`). Grammar and kanji schemas arrive with their content in
v0.2 (a schema change, red tests first).
* Schema choices: every item object is `z.strictObject` (a typo'd field fails); `dataItemSchema`
(kana | vocab-content) is what data files may hold — a custom item in a data file fails the
schema; vocab id groups `n5|n4|n3|n2|other`, grammar/kanji `n5|n4|n3|n2`; kana `group` enum
`basic|dakuten|handakuten|combination|small|extended|mark`; っ/ッ and ー carry `romaji: ''` and
`romajiAccepted: []`; kana phase is always 0; phase-0 vocab has no kanji in `word` or example
`ja`; tags are lowercase-kebab and unique; `pos` and `register` are closed enums.
* `parseBundle(raw)` collects every schema issue across all files before throwing one
`ContentValidationError`; issue paths are `<file>[i].field` (e.g.
`kana/hiragana.json[1].data.char`); then `validateBundle` checks cross-file rules (duplicate ids,
group/seed/`supersededBy` references, `meaningId` in i18n).

Taken by the coordinator, 2026-11-12 (step 0.1.3):

* Reading-practice words are `vocab:other:<kana>`, `level: 'other'`, phase 0, tag
`reading-practice`, `meaningId` = own id, `examples: []`. The same word may later exist as a
separate N5 kanji item (`vocab:n5:友達` beside `vocab:other:ともだち`) — intended: one trains kana
reading, the other vocabulary.
* を cannot occur inside an ordinary word; reading practice covers it with `vocab:other:を` (the
particle) and `vocab:other:きをつけて`. いって (ambiguous 行って/言って) was replaced by いっしょ.
* Register: うるさい, やばい, おれ are `rough`; きさま is `anime`; すみません is `polite`; the rest
`plain`.
* Mnemonics (Indonesian) exist only for the weak/confusable kana: hiragana ね ほ れ を ぴ た け に;
katakana ン シ ツ ソ ノ メ ク タ コ ユ ル レ.
* Kana files are ordered by group then gojūon (katakana: basic, dakuten, handakuten, combination,
small, mark, extended); curriculum order, when it exists, is data in `curriculum.json`, not file
order.

Taken 2026-11-12 (step 0.1.4) — by the owner where marked "Owner", otherwise coordinator defaults:

* Files: `domain.ts`, `errors.ts`, `repository.ts`, `index.ts` in `packages/core/src`. No tests in
0.1.4; the error classes' messages are covered by the tests of the functions that throw them
(0.1.5 `romajiMatches`, 0.1.6 `importAll` and the repository).
* Owner: `Assessment` is a discriminated union on `kind`; v0.1 has only `KanaExitAssessment`
`{ passed, correct, total, elapsedMs, wrong }`. `weekly` arrives in v0.3 with its own shape (and
an export-schema migration).
* Owner: `ReviewState.state` is a readable `CardState` string union (`'new' | 'learning' |
'review' | 'relearning'`); `srs/schedule.ts` maps it to the ts-fsrs `State` numbers both ways.
* Owner: `UserProfile.theme` is `'system' | 'light' | 'dark'`, default `'system'` (onboarding does
not ask); `ttsVoiceUri: string | null` also lives on the profile (`null` = the device's default
`ja-JP` voice). The product document's Pengaturan section was updated to match.
* An absent data field is `T | null`, never optional (`exactOptionalPropertyTypes` plus the
Dexie/JSON round-trip); optional *parameters* in the Repository contract (`session?`, `from?`)
stay. Timestamps are `Date`; calendar days are `LocalDate`, a plain `string` alias — a branded or
template-literal type would need a cast inside `toLocalDate`, which lint forbids.
* `RATING = { again: 1, hard: 2, good: 3, easy: 4 } as const`; `ReviewLog.confusedWith: string |
null`.
* Core does not re-export content types — import them from `@wara/content/schema`. (It still
re-exports `ContentValidationError`, see step 0.1.2.)
* `ExportBundle` is hand-written now: `{ format: 'wara-export', version: 1, exportedAt: Date,
profile, reviewStates, reviewLogs, sessions, journal, assessments, customContent }`. The 0.1.6
`exportBundleSchema` is typed against it and converts ISO strings back to `Date`.
* Errors: `RepositoryError({ operation, ids, cause })`, `ImportFormatError(issues: { path, message
}[])`. Messages carry paths, method names, and counts only, never learner values (privacy rule).
* `JournalEntry` is typed now (a v0.3 feature) because the Repository contract and the Dexie v1
`journal` table already include it: `source { anime, episode: number | null } | null`, `context`,
`correction { sentence, meaning, note } | null`, `status 'draft' | 'needs_review' | 'corrected'`.

Taken by the assistant, 2026-11-09 — **awaiting the user's confirmation** (the monorepo item was
confirmed by the user 2026-11-10, see above):

* **No web font**: system Japanese font with `lang="ja"` on Japanese text. Reason: Noto Sans JP is
several MB and the app must open offline immediately after install; every current OS ships a
Japanese font.
* `dexie` + `useLiveQuery` for local reactivity; TanStack Query deferred to v1.0.
* `ts-fsrs` over a hand-written SM-2.
* `fake-indexeddb` + RTL for route tests, no MSW before v1.0.
* Route paths in Indonesian (`/sesi`, `/belajar`, `/jurnal`, `/progres`, `/pengaturan`, `/mulai`).

## Open decisions — not settled

* **Sync backend (v1.0): Hono (`apps/api`, same language as `core`, shared types, Cloudflare
Workers free tier) versus Laravel + Sanctum (owner's LMS stack).** Leaning Hono; decide when v0.4
ships. If Hono, reuse the `docs/api-contract/openapi.yaml` convention and the contract-first
workflow from the Diaspora setup.
* KanjiVG stroke-order SVGs: licence to be checked before bundling (CC BY-SA 3.0 as of the
assistant's knowledge; attribution placement undecided).
* Journal correction in v1.0: copy-paste from a tutor session, or an API-backed correction; the
former is the v0.2 design.
* Weekly test day (Saturday is the v0.2 default) and whether it is skippable.
* TTS fallback when no `ja-JP` voice exists on the device: hide dictation drills or show a notice.
* `rateAnswer` time thresholds and the backlog threshold: initial values to be set, later tuned
from the learner's own logs.

## Load-bearing facts — to be filled from the code

Recorded 2026-11-10 (step 0.1.1):

* `npm run lint` is `eslint . --max-warnings 0` with `linterOptions.noInlineConfig: true` — an
`eslint-disable` comment cannot switch a rule off, and the warning it raises fails lint.
* `packages/core/src/**` bans `Date.now()`, `new Date()` with no arguments, `Date()`, and
`Math.random()` via `no-restricted-syntax` (proven to fire 2026-11-10); `packages/core/tests/**`
is not covered.
* `@typescript-eslint/consistent-type-assertions` is `assertionStyle: 'never'`; `as const` stays
allowed.
* `apps/web/src/main.tsx` mounts into a `div` appended to `document.body`; `index.html` has no
`#root` (avoids `!` and a bare `Error`).
* The `@/` alias in `vite.config.ts` is `{ find: '@', replacement: '/src' }` because `@types/node`
is not a dependency.
* Packages export TypeScript source (`exports` → `./src/*.ts`); there is no package build step.
* `npm run validate -w @wara/content` runs `vitest run tests/validator` without
`--passWithNoTests` (since step 0.1.3, 2026-11-12), so a missing validator test fails it.
* `apps/web/components.json`: shadcn style `base-nova`, `tsx: true`, utils `@/lib/cn`; shadcn is
not a dependency.

Recorded 2026-11-12 (step 0.1.2):

* A stub that needs no parameter is written as `export const f: (x: T) => R = () => …` — the lint
config has no underscore exception for unused args, and `void x;` fails
`no-meaningless-void-operator`.
* Test files are untracked until committed, so `git diff` cannot prove a green worker left a red
test untouched; the coordinator records `md5sum` of each test file right after verifying red and
checks it after green.

Still to come: the `ts-fsrs` ↔ `ReviewState` mapping in `core/srs/schedule.ts`; the
`commitReview` transaction (states, logs, session progress); the `SessionProvider` persistence
point; the `lang="ja"` wrapper.

## Traps

Carried over from the owner's other projects and expected to apply: Windows + Git Bash (Unix
syntax; line endings measured with `node`, not `grep`); a sub-agent that dies on an expired login
leaves a half-edited file; a worker's report is not proof; parallel siblings break each other's
`typecheck` transiently; screenshots time out while the Chrome tab is hidden.

Recorded here (2026-11-10):

* Windows PowerShell 5.1 console is not UTF-8 — Japanese output from grep/tests garbles; use Git
Bash or `chcp 65001` (the files themselves are fine).
* `CLAUDE.md` arrived with rich-text paste damage (`\#`, `&#x20;`, doubled blank lines) — repaired
2026-11-10 (backup kept outside the repo); check any pasted document the same way.
* Unicode look-alikes (カ/力, ロ/口, ー/一, ニ/二, ハ/八) and NFC vs decomposed dakuten are id
traps — the validator guards them.
* `npm audit` (2026-11-10) reports 10 moderate findings, one advisory (minimatch
GHSA-g3hv-75wg-m249) reached only through eslint/typescript-eslint dev tooling; npm's only fix is
downgrading to ESLint 9 — not taken.
* `git filter-branch` checks out the rewritten HEAD and deletes files that became untracked —
back them up first (`docs/` was backed up and restored 2026-11-10).

Recorded 2026-11-12:

* Vercel with Root Directory `apps/web` does not install from the monorepo root by default
(observed 2026-11-12, even with "Include files outside the Root Directory" reported on); a local
root install hides phantom dependencies — when adding an import in a workspace, declare the
package in that workspace's `package.json`.
* Open (2026-11-12): the `id.ts` kanji rule (`\p{Script=Han}`) also accepts 々 and CJK radicals;
vocab/grammar slugs reject Latin letters but not ASCII spaces or punctuation — tighten with a red
test if content ever needs it. The kana-only reading class is duplicated in `id.ts` and `item.ts`.
* Open (2026-11-12): when `romajiMatches` is built (step 0.1.5), add a core test that every
reading-practice word in the real bundle tokenises into existing kana items. A coordinator node
check on 2026-11-12 found all 80 tokenise; nothing guards it yet.
* Open (2026-11-12): `LocalDate` is an unbranded string alias; revisit if a date-format bug
appears.
* Parallel content workers' temporary `tests/_check-*.test.ts` files make each other's `typecheck`
fail transiently (the content tsconfig has `types: []`, so `node:fs` in a temp test is a type
error) — the coordinator's final typecheck is the one that counts (observed 2026-11-12).

## Standing checklist

* Confirm every "Decided, not yet built" block in `ARCHITECTURE.md` against the real tree as code
arrives.
* Write the ESLint tier rule with the first module.
* Write `docs/qa-session.md` before tagging v0.1.
