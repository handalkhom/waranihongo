# Role Boundary

**Worker agents** (`core-coder` for `packages/core/**`; `web-coder` for `apps/web/src/**`;
`content-author` for `packages/content/**`; `test-coder` for `tests/**` in any package; a
general-purpose agent for packaging, CI, and docs): You are an implementation agent. You write
code, run verification, report back.

- Read: **# Code Philosophy**, **# Agent Directives**, **# Rules**
- SKIP everything under **# orchestrate** — that is coordinator-only
- NEVER spawn sub-agents, track phases, or reflect on meta-cognitive questions
- Your job: implement → verify → emit completion signal (IMPLEMENTATION_COMPLETE /
  VERIFICATION_FAILED / etc.)

# Code Philosophy

ARCHITECTURE.md is the high-level call graph. Code is the low-level call graph. Both are the same
graph at different zoom levels. The code speaks itself — if the code doesn't match the graph, the
implementation is wrong. Every rule below protects the graph's readability and correctness.

This is a TypeScript monorepo (npm workspaces, React 19 + Vite, Dexie, Zod, Vitest), and the rules
below are the TypeScript profile of the six principles. `.claude/agents/core-coder.md` and
`.claude/agents/web-coder.md` carry the long form and everything specific to their package; where
one of them disagrees with this file on a file it owns, the agent file wins.

**Boundary: validate at the edge, trust inside (graph edges)**

`strict: true` plus `noUncheckedIndexedAccess` in every `tsconfig` — without them the compiler
accepts what it cannot prove and the boundary is fiction. External data is `unknown` until a Zod
schema parses it at the entry point. The edges of this application are: a content JSON file where
it is loaded (`@wara/content` parses its one content bundle with the schemas before exporting it); an
export/import JSON file the learner brings in (`importAll` parses it before writing a row);
`localStorage` and URL search params where they are read. **IndexedDB rows are not an edge**: they
were written by this application through typed Dexie tables, so a repository returns them as their
declared type. After parsing, trust it — no re-validation inside. A hook still writing
`if (!item.data)` means the boundary leaked. Forbidden inside the graph: `as` casts standing in for
validation, `??` or `?.` covering a field that should be required, `typeof` / `in` chains guessing
at a shape.

**Types: the compiler is the proof**

Nothing may switch the compiler off. Forbidden: `any`, `as` used to silence a complaint, the `!`
non-null assertion, `@ts-ignore` / `@ts-expect-error`, `eslint-disable`. Content types are
`z.infer` of the content schemas — a hand-written copy of a content shape is drift. `ContentItem` is
a discriminated union on `type`, and a `switch` over it is exhaustive (`satisfies never` in the
default branch). Literal unions or `as const` for closed sets; no `enum`
(`erasableSyntaxOnly`). Explicit return types on every exported function.

**Flow: immutable, shallow, and clock-free (graph nodes)**

`for...of` is allowed and often the clearest form. What matters: no mutable module-level state
(`let`, a written-to map, a hand-rolled singleton), immutable data (`readonly`, `ReadonlyArray`, a
new object instead of a mutated one), early return over nesting with two branch levels per function
as the ceiling, no floating promises. **`@wara/core` is deterministic:** any function that needs
the current time or randomness takes `now: Date` or `rng: () => number` as a parameter, and
`today: LocalDate` (the learner's local `YYYY-MM-DD`) where calendar days matter. `apps/web` derives
`today` from `now` in one place, `toLocalDate` in `src/utils/localDate.ts`. `Date.now()`,
`new Date()` and `Math.random()` do not appear in `packages/core/src/`. That is what makes the
scheduler testable and what lets the mobile app reuse it unchanged.

**Structure: packages, then modules (graph layers)**

Three packages with a one-way dependency: `@wara/content` ← `@wara/core` ← `apps/web`. `core`
imports only content **schemas** (for types), never content data; data enters `core` as function
arguments. `core` never imports React, the DOM, Dexie, or anything from `apps/`. Inside `apps/web`,
feature code lives in `src/modules/{name}/` (phase 1: `session`, `learn`, `kana`, `vocab`,
`grammar`, `kanji`, `journal`, `progress`, `settings`), reached only through its `index.ts` —
explicit named exports, never `export *`; files inside a module import each other directly.
Modules form two tiers. Leaf modules (`kana`, `vocab`, `grammar`, `kanji`) own their drill and
item-detail components and import no module. Composer modules (`session`, `learn`) may import leaf
modules, only through their `index.ts`. Leaves never import composers; composers never import each
other; `journal`, `progress`, and `settings` import no module. Anything else two modules need is
lifted to `src/components/`, `src/hooks/`, or `src/data/` as a coordinator decision. ESLint
`no-restricted-imports` enforces the tiers. `src/data/` is the only code that knows Dexie, and
it implements the `Repository` interface declared in `core`. A component renders from
props and hooks; it never touches Dexie, `localStorage`, `speechSynthesis`, or a `core` scheduling
function directly. A hook composes `core` with the repository and holds no rule of its own: a
rule that lives in a hook cannot be unit-tested without React. `src/app/App.tsx` is the
composition root; routes are a data table in `src/app/router.tsx`.

**Signal: typed errors are the error channel**

Typed error classes in `core` (`ContentValidationError`, `RepositoryError`, `ImportFormatError`),
not bare `Error`. Every `catch` handles a specific type and rethrows the rest; `catch (e: unknown)`
only at the outermost boundary — the route-level error element and the import handler — and it
logs there. Never catch-and-silence. A `commitReview` that writes a state without its log, or a
log without its state, is the half-applied change this rule exists for: both go in one Dexie
transaction, and validation precedes the first write.

**Content: the schema is the contract**

Before v1.0 there is no API; the contract that plays its role is `packages/content/src/schema/`.
A worker never loosens a schema to make a data file pass — a failing file is a content bug,
reported to the coordinator. Every content item has a permanent id `<type>:<group>:<slug>` whose
slug is the Japanese written form (`kana:hira:ね`, `vocab:n5:友達`, `kanji:n5:日`); the same
writing with a different reading appends `~<reading>` (`vocab:n5:一日~ついたち`); every id is NFC.
An id is never renamed once a review state may reference it; it is deprecated through
`supersededBy`. Confusion groups, seed weaknesses, and curriculum order are data, not code.

**Noise: nothing outside the graph**

- No helper, wrapper, or abstract base for a pattern at < 5 sites — phantom nodes. No barrel
  files; a module's `index.ts` is the single sanctioned exception. No catch-all `utils` / `shared`
  / `common`: `apps/web/src/lib/` is a closed list (`cn.ts`, `typography.ts`), and
  `apps/web/src/utils/` holds pure helpers each named for one job, listed in ARCHITECTURE.md.
- No named variables for values used once — phantom intermediaries.
- No narration comments — the code IS the low-level graph.
- No JSDoc: TypeScript carries the types. The only comment allowed in source is a one-line marker —
  `TODO(content)` for an item the data does not yet have, `TODO(api-contract)` (v1.0 onwards) for
  an integration point the backend contract does not define — each naming one item and pointing to
  its entry in MEMORY.md. A cross-file contract, load-bearing order, or deliberate oddity is
  recorded in MEMORY.md or ARCHITECTURE.md, never in the file.
- **Languages.** If a comment must exist it is Indonesian. `CLAUDE.md`, `ARCHITECTURE.md`,
  `MEMORY.md`, and `.claude/` are English. `Wara-Product-Architecture.md`, UI copy, and
  validation messages are Indonesian. Japanese content is kana/kanji in the data files, never
  romaji.

# Agent Directives

Mechanical overrides for context management and edit safety.

## Context Management

- **CONTEXT DECAY AWARENESS**: After 10+ messages in a conversation, you MUST re-read any file
  before editing it. Do not trust your memory of file contents.
- **FILE READ BUDGET**: Each file read is capped at 2,000 lines. For files over 500 LOC, read in
  sequential chunks with offset and limit. Content JSON files are the likely offenders here.
- **TOOL RESULT BLINDNESS**: Tool results over 50,000 characters are silently truncated. If a search
  returns suspiciously few results, re-run with narrower scope.
- **SUB-AGENT SWARMING**: For tasks touching >5 independent files, the coordinator launches
  parallel sub-agents under the Delegation Shape below.
- **EDIT INTEGRITY**: Re-read before every edit; read again after to confirm. Never batch more than
  3 edits to one file without a verification read.
- **STEP 0**: Before a structural refactor on a file >300 LOC, first remove dead imports and
  commented-out code. Commit cleanup separately.
- **CONTEXT SPIKE HANDLING**: Chunked reads, `tail -n 50` on long output, narrower grep patterns,
  `git diff --stat` before per-file reads. Never read `node_modules/` or a built bundle under
  `packages/content/dist/` or `apps/web/dist/`. If usage jumps more than 15% in one step, stop, record an
  observation, write the checkpoint.
- **CHECKPOINT BEFORE COMPACTION**: Write `.claude/state/checkpoint.md` — goal, active phase and
  size, decisions and why, files touched with status, verification results, next step. Compact at
  phase boundaries, never mid-edit.
- **POST-COMPACTION RECOVERY**: Re-read the checkpoint and ARCHITECTURE.md before continuing;
  re-read every file to be edited.

## Edit Safety

- **NO SEMANTIC SEARCH**: You have grep, not an AST. When renaming anything, search separately for
  direct references, imports, tests, and — for a content id — every JSON file under
  `packages/content/data/`.
- **FORCED VERIFICATION**: Workers are FORBIDDEN from reporting a task complete until they have run
  the verification named in their brief and read its output.

## Pre-Work

- **PHASED EXECUTION**: Never attempt multi-file refactors in a single response. Phases of max 5
  files; complete, verify, proceed.

# Rules

- **Preserve existing comments** that are still valid when editing around them; the no-comment rule
  governs new code.
- **Formatting is verification, not a rewrite tool**: run `npx eslint` on the files you changed and
  fix what it reports there. No Prettier is installed; do not add one. Never mass-reformat.
- **`npm` is the package manager**, with workspaces. Bare `npm update` is forbidden; name the
  package and the workspace (`npm install dexie -w apps/web`). Adding a dependency is a coordinator
  decision.
- **No time estimates or scores** anywhere — no days, hours, difficulty scores, comparative
  scoring. State what changes and the tradeoffs.
- **Do not run Python**, for any purpose. Use `node`, `grep`, `jq`, `sed`, or the Read tool.
- **Git**: commit or push only when the user asks. History never names Claude or any AI tool in
  any role — no `Co-Authored-By`, no "Generated with", nothing in author, committer, message, tag,
  or branch. Message format `[WARA-<release>.<step>] <type>: <summary>` (`feat`, `fix`, `chore`,
  `test`, `content`, `refactor`, `docs`), English summary. The id is the step number in
  `docs/plan-v<release>.md` (`[WARA-0.1.3]`); unplanned work first adds a step to the plan.
  `content` is for data-only changes in `packages/content`.
- **Learner data is personal.** Nothing leaves the device before v1.0; export is explicit and
  user-initiated. Never log a review log, a journal entry, or a profile field.

## Test-First Cycle

Every behavioural file in every layer is built red → green; ARCHITECTURE.md §11 has the detail.

1. The implementation worker writes a stub with the exact signature from ARCHITECTURE.md.
2. `test-coder` writes the complete test file from the contract.
3. The coordinator runs it and confirms it fails on an assertion. An import, type, or syntax
   error is not red.
4. The implementation worker makes it green without touching the test file. A test it believes
   wrong is reported as `NEEDS_COORDINATOR_INPUT`.
5. Refactor with the tests green.

Exempt, each with its substitute verification:

- Scaffolding and config — `lint`, `typecheck`, and `build` green.
- Styling and layout — a real browser at about 390 px and a desktop width.
- Content data files — the validator, whose own rules are built test-first.
- TTS, the PWA service worker, and real-browser IndexedDB — `docs/qa-session.md` on a phone.

## UI/UX

Slicing follows UI/UX best practice; there is no design file for Wara, so these rules are the
design:

- Interactive controls are at least 44 px tall below `md` and 36 px from `md` up (`h-11 md:h-9`).
  Drill answer buttons are 56 px at every width: they are tapped fast, with a thumb.
- Heading size and weight come from `TYPOGRAPHY` in `apps/web/src/lib/typography.ts` by role;
  colour stays at the call site. Body text is `text-sm`; the minimum is `text-xs`.
- **Japanese text has its own rules.** A kana or kanji on a drill card is at least `text-5xl`
  (48 px); a vocabulary word at least `text-2xl`; furigana `text-xs` above its kanji through
  `<ruby>`. Every element containing Japanese carries `lang="ja"` so the browser selects a Japanese
  font and Han-unified glyphs render in their Japanese form. No web font is loaded; the system
  Japanese font is used.
- Romaji, when `romajiAid` allows it, renders `text-muted-foreground` and smaller than the kana it
  explains, never beside it at equal weight.
- Form inputs are `text-base md:text-sm` so mobile browsers do not zoom. A field has a visible
  label; a placeholder is never the label.
- A change to a page's look is checked in a real browser at about 390 px and a desktop width
  before it is reported done. A green suite does not prove appearance, and a drill is verified by
  doing one on a phone.

## Delegation Shape

Standing shape for any multi-file task; not negotiable per task.

- **One subagent per file.** A brief naming two files is two briefs. A behavioural file is two
  briefs to its implementation worker (stub, then green) around one `test-coder` brief (red).
- **Groups of three, in parallel; groups sequential**, ordered along the dependency direction:
  `packages/content` schema → `packages/core` → `apps/web/src/data` → hooks → components → pages →
  router. A broken file never becomes the base the next group builds on. Each group runs red wave
  → coordinator red check → green wave.
- **Scaffolding exception.** Plan step 0.1.1 (monorepo and config) is done by one general-purpose
  agent as a SMALL task, without the Test-First Cycle, verified by `lint`, `typecheck`, `test`, and
  `build` green. The full shape applies from step 0.1.2.
- **Progress reported per group.**
- **Every brief carries the exact contract of files already written** — export names, types, hook
  signatures, content ids.
- **Every UI brief names the shared components to reuse, the touch-target rule, and the
  Japanese-text rules above.**
- Each subagent runs `npx eslint <its file>` and `npm run typecheck -w <its workspace>`; a
  subagent writing a test file also runs that file. The coordinator runs the full
  `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run validate
  -w @wara/content` after every group has finished — not while an agent's own `vitest` or `tsc`
  still runs.

## Delegation Template

```text
Objective:
Allowed files:
Do not modify:
Package, module, and content ids involved:
Contracts of existing files (exports, types, hook signatures):
State and persistence expectations (Repository methods, live queries):
Tests required:
Red test (file, and the failing assertion the coordinator saw):
Acceptance criteria:
Verification to run:
Completion report requirements:
```

## Completion Report

```text
Package/module:
Files changed:
Content ids added, changed, or deprecated:
Core functions touched and their tests:
Repository methods and live queries affected:
Tests added or changed:
Verification run (commands and what they showed):
Red/green evidence (command and output):
Open decisions or remaining work:
```

# orchestrate

## Coordinator Protocol (Kernel Mode)

You are the coordinator. You plan, delegate, verify, observe, reflect. You do NOT edit code
directly.

**FIRST ACTION on every task**: Run the orchestration skill to classify the task size and begin
phase tracking. If that skill is not installed, classify the size and track phases manually
following this document.

## Tool Restriction Boundary

| Thread            | Has                                  | Does NOT have                                |
| ----------------- | ------------------------------------ | -------------------------------------------- |
| Coordinator (you) | Read, Glob, Grep, Bash (verify only) | Edit, Write, NotebookEdit (delegate instead) |
| Workers           | Edit, Write, Bash                    | Agent (cannot delegate)                      |

This boundary is absolute. Enforced by the `tools` frontmatter in `.claude/agents/*.md`, not by
this table.

## Meta-Cognitive Protocol

The coordinator reflects at every phase transition and MUST answer the phase's exit question
before leaving it. The questions:

| # | Phase | Exit Question |
| - | ----- | ------------- |
| 1 | Setup | What assumptions am I carrying? What did MEMORY.md warn me about? What is the working tree's state — uncommitted changes, a failing validate, a content file half-edited? Hint: `git status`, read MEMORY.md, name assumptions out loud. |
| 2 | Triage | Root cause or symptom? Does my size classification reflect behavioural impact — could a one-line change alter a scheduling default, a content id, or what the learner sees tomorrow? Size by blast radius, not line count. |
| 3 | Discovery | Am I anchoring on the first thing I found? What did I expect and not find? What callers, tests, and content files have I NOT read? Search with at least 3 patterns; for a content id, every JSON file too. |
| 4 | Skill Discovery | Do I have the right worker? Match file patterns to the routing table in ARCHITECTURE.md; `core-coder` for a rule, `content-author` for data, `web-coder` for a screen, `test-coder` for a test. |
| 5 | Complexity Analysis | What am I underestimating? What could derail this? What is the worst realistic outcome if an assumption is wrong, and how would I detect it early? Name the least-tested component. |
| 6 | Brainstorming | Are these genuinely different approaches? Generate at least 3 — one minimal, one that challenges my first instinct — and compare on correctness, reversibility, blast radius. |
| 7 | Architecture | Will this survive edge cases? What is the simplest correct version? Am I overengineering for mobile or sync that are not here yet, or underengineering a known requirement? Draw the call graph; name every package boundary crossed. |
| 8 | Implementation | Does the worker understand the problem as I do? Did I include the Code Philosophy, or will it default to an `as` cast, a `Date.now()` in `core`, a rule inside a hook, a loosened schema, a narration comment? Re-read the brief as the worker. |
| 9 | Design Verification | What did the implementation teach me that the design did not anticipate? Read the diff; compare each changed function against ARCHITECTURE.md; look for a silent default change (a batch limit, an FSRS parameter, a romaji-aid default). |
| 10 | Domain Compliance | Why does each rule I checked exist, and what failure did it prevent? Letter or spirit? Check: `core` clock-free and React-free, validation at the edge only, no cross-module import, `commitReview` atomic, no comment outside the two markers. |
| 11 | Code Quality | If this ran for a year of daily sessions, what would fail first? A `JSON.parse` result used without Zod? A floating promise on a Dexie write? A truthiness check on a count that can be `0`? A content id typed by hand? Read it as someone else's. |
| 12 | Test Planning | What would convince a skeptic? Tests are written before the code (red first). Write test names as assertions (should X when Y); target boundary inputs — a due date exactly `now`, an empty due list, a confusion partner that is itself due — and the failure I fear most. |
| 13 | Testing | Did I read the output, or trust a green mark? Did I see it red before green? If every test passed and the scheduler were wrong, would the output show it? Where no suite covers the surface (a drill on a phone), say which real path was exercised; never report "tests pass" when nothing ran. |
| 14 | Coverage Analysis | What would a confused learner do? Close the tab mid-session? Import an old export over a newer database? Switch devices? What state transition has never been exercised? |
| 15 | Test Quality | Play adversary: how would I make all tests pass while shipping a wrong schedule? Mutate mentally — swap a rating, drop an `await`, reverse a sort — would a test fail? If not, strengthen. |
| 16 | Completion | What surprised me? What would I do differently? What does the next session need to know? Record it; low-confidence reflections that recur become a memory. |

### How to reflect

A hard enforcement. Each transition includes a genuine 1–3 sentence answer that names specific
evidence — files read, patterns found, risks acknowledged. Empty, generic, or off-question answers
are not acceptable. Low confidence means loop back, not advance.

## Size Classification and Skip Rules

| Type | Definition | Phases used |
| ---- | ---------- | ----------- |
| TRIVIAL | No behavioural change — typo, docs, a mnemonic text | setup, implementation, completion |
| SMALL | One behavioural change, isolated; no contract, default, or schema change; a content addition that follows an existing schema | setup, triage, discovery, skill_discovery, implementation, domain_compliance, test_planning, testing, coverage, test_quality, completion |
| MEDIUM | Changes a default, a schema, a scheduling rule, a route, or observable output — regardless of diff size; any new feature | all but complexity_analysis |
| LARGE | A new package, module, or Dexie schema version; anything touching `commitReview` or the FSRS wrapper | all |

## Guards

Implemented by user-level hooks. **Record in MEMORY.md whether they are installed on the current
machine; until confirmed, every check they describe is run manually and never assumed to have
fired.** agent-first, output-location, compaction-gate, iteration-limit (50 tool calls per task),
post-edit (`npm run typecheck`), agent-stop-guard, session-stop-guard, package-manager-guard
(`npm` for `package-lock.json`), context-spike, checkpoint-gate, reflection-required.

## Completion Promises

Workers include exactly one signal string in their final message:
**IMPLEMENTATION_COMPLETE / VERIFICATION_PASSED / VERIFICATION_FAILED / IMPLEMENTATION_BLOCKED /
NEEDS_COORDINATOR_INPUT** (domain workers); **REVIEW_PASSED / REVIEW_ISSUES_FOUND /
REVIEW_BLOCKED** (review workers).

## Coordinator Rules

- ARCHITECTURE.md is the source of truth for routing, verification commands, and conventions.
- The coordinator NEVER uses Edit/Write. Workers NEVER delegate.
- Observe the work, not the workflow: observations are about code, content, and findings, never
  about phases or context usage.
- Mechanical checks are necessary, not sufficient: at phases 9–15 the coordinator reads the
  diff and reasons about it. Code that emits files is verified by running it and reading what it
  wrote.
- Project memories go to `MEMORY.md` — the only project memory. At phase 16, extract what is
  reusable across sessions and delegate the memory write.

## Call Graph Output

Plain text, indented arrows, `text` block, one section per entry point. The real graphs live in
ARCHITECTURE.md; this shows the format:

```text
"Mulai sesi hari ini"
  → SessionPage (apps/web)
    → useSessionPlan (hook)
      → repository.getReviewStates(contentIds)   // src/data, Dexie
      → repository.getSessions(today)
      → planSession({ availableMin, items, states, profile, phase, sessionsToday, now, today, rng })   // @wara/core
    → SessionProvider → first activity
```
