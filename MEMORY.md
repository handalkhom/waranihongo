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

## Project state (2026-11-10)

* **Git:** repository initialised 2026-11-10, branch `master`. Commits: `f532e6b`
`[WARA-0.1.0] docs: planning documents baseline`, `669b3bc` `[WARA-0.1.0] docs: apply design
decisions 2026-11-10`. Docs are tracked. This machine has `core.autocrlf=true`; the documents are
CRLF.
* **Agent files exist:** `.claude/agents/{coordinator,core-coder,web-coder,content-author,test-coder}.md`.
* Planning documents and agent files reflect the decisions below. The `kana-exit` decisions
(answer mode, Beranda card, `romajiMatches`, `kanaExitAvailable`) are in the working tree, not yet
committed — the owner has not asked.
* **Nothing is built.** No `package.json`. Every block in `ARCHITECTURE.md` is Decided, not yet
built.
* **Not yet written:** `docs/qa-session.md`, the ESLint tier rule, `docs/plan-v0.2.md`.
* **Last verification:** none has ever run.
* **Guards and orchestration skill: NOT installed (checked 2026-11-09, user's machine
  `GMBR-KEMLU-100`, Git Bash):** `~/.claude/hooks/` does not exist, `~/.claude/settings.json`
  has no `hooks` key, and `~/.claude/skills/` holds only `synced/` with nothing matching
  "orchestrat". Every guard in `CLAUDE.md` is run by hand; the coordinator classifies size and
  tracks phases manually, as its "FIRST ACTION" already allows. Re-check with the same commands
  before assuming otherwise.

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

Taken by the assistant, 2026-11-09 — **awaiting the user's confirmation**:

* **Monorepo with npm workspaces**, not separate repositories, because `@wara/core` and
`@wara/content` are shared with the future mobile app and a future `apps/api`. The owner's
habit of separate FE/BE repos was weighed and set aside for this reason.
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

None yet. The first entries will be: the `ts-fsrs` ↔ `ReviewState` mapping in
`core/srs/schedule.ts`; the `commitReview` transaction (states, logs, session progress); the
`SessionProvider` persistence point; the `lang="ja"` wrapper; the TypeScript 7/6 outcome.

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

## Before step 0.1.1 — checklist

* Confirm every "Decided, not yet built" block in `ARCHITECTURE.md` against the real tree as code
arrives.
* Record the TypeScript 7/6 outcome under Decisions.
* Write the ESLint tier rule with the first module.
* Write `docs/qa-session.md` before tagging v0.1.
* Replace "none has ever run" above with the first real verification outcome, failures included.
