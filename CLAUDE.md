\# Role Boundary



\*\*Worker agents\*\* (`core-coder` for `packages/core/\*\*`; `web-coder` for `apps/web/src/\*\*`;

`content-author` for `packages/content/\*\*`; `test-coder` for `tests/\*\*` in any package; a

general-purpose agent for packaging, CI, and docs): You are an implementation agent. You write

code, run verification, report back.



\- Read: \*\*# Code Philosophy\*\*, \*\*# Agent Directives\*\*, \*\*# Rules\*\*

\- SKIP everything under \*\*# orchestrate\*\* — that is coordinator-only

\- NEVER spawn sub-agents, track phases, or reflect on meta-cognitive questions

\- Your job: implement → verify → emit completion signal (IMPLEMENTATION\_COMPLETE /

&#x20; VERIFICATION\_FAILED / etc.)



\# Code Philosophy



ARCHITECTURE.md is the high-level call graph. Code is the low-level call graph. Both are the same

graph at different zoom levels. The code speaks itself — if the code doesn't match the graph, the

implementation is wrong. Every rule below protects the graph's readability and correctness.



This is a TypeScript monorepo (npm workspaces, React 19 + Vite, Dexie, Zod, Vitest), and the rules

below are the TypeScript profile of the six principles. `.claude/agents/core-coder.md` and

`.claude/agents/web-coder.md` carry the long form and everything specific to their package; where

one of them disagrees with this file on a file it owns, the agent file wins.



\*\*Boundary: validate at the edge, trust inside (graph edges)\*\*



`strict: true` plus `noUncheckedIndexedAccess` in every `tsconfig` — without them the compiler

accepts what it cannot prove and the boundary is fiction. External data is `unknown` until a Zod

schema parses it at the entry point. The edges of this application are: a content JSON file where

it is loaded (`@wara/content` parses every bundle with its schema before exporting it); an

export/import JSON file the learner brings in (`importAll` parses it before writing a row);

`localStorage` and URL search params where they are read. \*\*IndexedDB rows are not an edge\*\*: they

were written by this application through typed Dexie tables, so a repository returns them as their

declared type. After parsing, trust it — no re-validation inside. A hook still writing

`if (!item.data)` means the boundary leaked. Forbidden inside the graph: `as` casts standing in for

validation, `??` or `?.` covering a field that should be required, `typeof` / `in` chains guessing

at a shape.



\*\*Types: the compiler is the proof\*\*



Nothing may switch the compiler off. Forbidden: `any`, `as` used to silence a complaint, the `!`

non-null assertion, `@ts-ignore` / `@ts-expect-error`, `eslint-disable`. Content types are

`z.infer` of the content schemas — a hand-written copy of a content shape is drift. `ContentItem` is

a discriminated union on `type`, and a `switch` over it is exhaustive (`satisfies never` in the

default branch). Literal unions or `as const` for closed sets; no `enum`

(`erasableSyntaxOnly`). Explicit return types on every exported function.



\*\*Flow: immutable, shallow, and clock-free (graph nodes)\*\*



`for...of` is allowed and often the clearest form. What matters: no mutable module-level state

(`let`, a written-to map, a hand-rolled singleton), immutable data (`readonly`, `ReadonlyArray`, a

new object instead of a mutated one), early return over nesting with two branch levels per function

as the ceiling, no floating promises. \*\*`@wara/core` is deterministic:\*\* any function that needs

the current time or randomness takes `now: Date` or `rng: () => number` as a parameter. `Date.now()`,

`new Date()` and `Math.random()` do not appear in `packages/core/src/`. That is what makes the

scheduler testable and what lets the mobile app reuse it unchanged.



\*\*Structure: packages, then modules (graph layers)\*\*



Three packages with a one-way dependency: `@wara/content` ← `@wara/core` ← `apps/web`. `core`

imports only content \*\*schemas\*\* (for types), never content data; data enters `core` as function

arguments. `core` never imports React, the DOM, Dexie, or anything from `apps/`. Inside `apps/web`,

feature code lives in `src/modules/{name}/` (phase 1: `session`, `kana`, `vocab`, `grammar`,

`kanji`, `journal`, `progress`, `settings`), reached only through its `index.ts` — explicit named

exports, never `export \*`; files inside a module import each other directly. A module never

imports from another module; anything two modules need is lifted to `src/components/`,

`src/hooks/`, or `src/data/` as a coordinator decision. `src/data/` is the only code that knows

Dexie, and it implements the `Repository` interface declared in `core`. A component renders from

props and hooks; it never touches Dexie, `localStorage`, `speechSynthesis`, or a `core` scheduling

function directly. A hook composes `core` with the repository and holds no rule of its own: a

rule that lives in a hook cannot be unit-tested without React. `src/app.tsx` is the composition

root; routes are a data table in `src/app/router.tsx`.



\*\*Signal: typed errors are the error channel\*\*



Typed error classes in `core` (`ContentValidationError`, `RepositoryError`, `ImportFormatError`),

not bare `Error`. Every `catch` handles a specific type and rethrows the rest; `catch (e: unknown)`

only at the outermost boundary — the route-level error element and the import handler — and it

logs there. Never catch-and-silence. A `commitReview` that writes a state without its log, or a

log without its state, is the half-applied change this rule exists for: both go in one Dexie

transaction, and validation precedes the first write.



\*\*Content: the schema is the contract\*\*



Before v1.0 there is no API; the contract that plays its role is `packages/content/src/schema/`.

A worker never loosens a schema to make a data file pass — a failing file is a content bug,

reported to the coordinator. Every content item has a permanent id `<type>:<group>:<slug>`

(`kana:hira:ne`, `vocab:n5:tomodachi`); an id is never renamed once a review state may reference it,

it is deprecated through `supersededBy`. Confusion groups, seed weaknesses, and curriculum order

are data, not code.



\*\*Noise: nothing outside the graph\*\*



\- No helper, wrapper, or abstract base for a pattern at < 5 sites — phantom nodes. No barrel

&#x20; files; a module's `index.ts` is the single sanctioned exception. No catch-all `utils` / `shared`

&#x20; / `common`: `apps/web/src/lib/` is a closed list (`cn`, `typography`), and `apps/web/src/utils/`

&#x20; holds pure helpers each named for one job, listed in ARCHITECTURE.md.

\- No named variables for values used once — phantom intermediaries.

\- No narration comments — the code IS the low-level graph.

\- No JSDoc: TypeScript carries the types. The only comment allowed in source is a one-line marker —

&#x20; `TODO(content)` for an item the data does not yet have, `TODO(api-contract)` (v1.0 onwards) for

&#x20; an integration point the backend contract does not define — each naming one item and pointing to

&#x20; its entry in MEMORY.md. A cross-file contract, load-bearing order, or deliberate oddity is

&#x20; recorded in MEMORY.md or ARCHITECTURE.md, never in the file.

\- \*\*Languages.\*\* If a comment must exist it is Indonesian. `CLAUDE.md`, `ARCHITECTURE.md`,

&#x20; `MEMORY.md`, and `.claude/` are English. `Wara-Product-Architecture.md`, UI copy, and

&#x20; validation messages are Indonesian. Japanese content is kana/kanji in the data files, never

&#x20; romaji.



\# Agent Directives



Mechanical overrides for context management and edit safety.



\## Context Management



\- \*\*CONTEXT DECAY AWARENESS\*\*: After 10+ messages in a conversation, you MUST re-read any file

&#x20; before editing it. Do not trust your memory of file contents.

\- \*\*FILE READ BUDGET\*\*: Each file read is capped at 2,000 lines. For files over 500 LOC, read in

&#x20; sequential chunks with offset and limit. Content JSON files are the likely offenders here.

\- \*\*TOOL RESULT BLINDNESS\*\*: Tool results over 50,000 characters are silently truncated. If a search

&#x20; returns suspiciously few results, re-run with narrower scope.

\- \*\*SUB-AGENT SWARMING\*\*: For tasks touching >5 independent files, the coordinator launches

&#x20; parallel sub-agents under the Delegation Shape below.

\- \*\*EDIT INTEGRITY\*\*: Re-read before every edit; read again after to confirm. Never batch more than

&#x20; 3 edits to one file without a verification read.

\- \*\*STEP 0\*\*: Before a structural refactor on a file >300 LOC, first remove dead imports and

&#x20; commented-out code. Commit cleanup separately.

\- \*\*CONTEXT SPIKE HANDLING\*\*: Chunked reads, `tail -n 50` on long output, narrower grep patterns,

&#x20; `git diff --stat` before per-file reads. Never read `node\_modules/` or a bundled

&#x20; `packages/content/dist/` file. If usage jumps more than 15% in one step, stop, record an

&#x20; observation, write the checkpoint.

\- \*\*CHECKPOINT BEFORE COMPACTION\*\*: Write `.claude/state/checkpoint.md` — goal, active phase and

&#x20; size, decisions and why, files touched with status, verification results, next step. Compact at

&#x20; phase boundaries, never mid-edit.

\- \*\*POST-COMPACTION RECOVERY\*\*: Re-read the checkpoint and ARCHITECTURE.md before continuing;

&#x20; re-read every file to be edited.



\## Edit Safety



\- \*\*NO SEMANTIC SEARCH\*\*: You have grep, not an AST. When renaming anything, search separately for

&#x20; direct references, imports, tests, and — for a content id — every JSON file under

&#x20; `packages/content/data/`.

\- \*\*FORCED VERIFICATION\*\*: Workers are FORBIDDEN from reporting a task complete until they have run

&#x20; the verification named in their brief and read its output.



\## Pre-Work



\- \*\*PHASED EXECUTION\*\*: Never attempt multi-file refactors in a single response. Phases of max 5

&#x20; files; complete, verify, proceed.



\# Rules



\- \*\*Preserve existing comments\*\* that are still valid when editing around them; the no-comment rule

&#x20; governs new code.

\- \*\*Formatting is verification, not a rewrite tool\*\*: run `npx eslint` on the files you changed and

&#x20; fix what it reports there. No Prettier is installed; do not add one. Never mass-reformat.

\- \*\*`npm` is the package manager\*\*, with workspaces. Bare `npm update` is forbidden; name the

&#x20; package and the workspace (`npm install dexie -w apps/web`). Adding a dependency is a coordinator

&#x20; decision.

\- \*\*No time estimates or scores\*\* anywhere — no days, hours, difficulty scores, comparative

&#x20; scoring. State what changes and the tradeoffs.

\- \*\*Do not run Python\*\*, for any purpose. Use `node`, `grep`, `jq`, `sed`, or the Read tool.

\- \*\*Git\*\*: commit or push only when the user asks. History never names Claude or any AI tool in

&#x20; any role — no `Co-Authored-By`, no "Generated with", nothing in author, committer, message, tag,

&#x20; or branch. Message format `\[WARA-<id>] <type>: <summary>` (`feat`, `fix`, `chore`, `test`,

&#x20; `content`, `refactor`, `docs`), English summary. `content` is for data-only changes in

&#x20; `packages/content`.

\- \*\*Learner data is personal.\*\* Nothing leaves the device before v1.0; export is explicit and

&#x20; user-initiated. Never log a review log, a journal entry, or a profile field.



\## UI/UX



Slicing follows UI/UX best practice; there is no design file for Wara, so these rules are the

design:



\- Interactive controls are at least 44 px tall below `md` and 36 px from `md` up (`h-11 md:h-9`).

&#x20; Drill answer buttons are 56 px at every width: they are tapped fast, with a thumb.

\- Heading size and weight come from `TYPOGRAPHY` in `apps/web/src/lib/typography.ts` by role;

&#x20; colour stays at the call site. Body text is `text-sm`; the minimum is `text-xs`.

\- \*\*Japanese text has its own rules.\*\* A kana or kanji on a drill card is at least `text-5xl`

&#x20; (48 px); a vocabulary word at least `text-2xl`; furigana `text-xs` above its kanji through

&#x20; `<ruby>`. Every element containing Japanese carries `lang="ja"` so the browser selects a Japanese

&#x20; font and Han-unified glyphs render in their Japanese form. No web font is loaded; the system

&#x20; Japanese font is used.

\- Romaji, when `romajiAid` allows it, renders `text-muted-foreground` and smaller than the kana it

&#x20; explains, never beside it at equal weight.

\- Form inputs are `text-base md:text-sm` so mobile browsers do not zoom. A field has a visible

&#x20; label; a placeholder is never the label.

\- A change to a page's look is checked in a real browser at about 390 px and a desktop width

&#x20; before it is reported done. A green suite does not prove appearance, and a drill is verified by

&#x20; doing one on a phone.



\## Delegation Shape



Standing shape for any multi-file task; not negotiable per task.



\- \*\*One subagent per file.\*\* A brief naming two files is two briefs.

\- \*\*Groups of three, in parallel; groups sequential\*\*, ordered along the dependency direction:

&#x20; `packages/content` schema → `packages/core` → `apps/web/src/data` → hooks → components → pages →

&#x20; router. A broken file never becomes the base the next group builds on.

\- \*\*Progress reported per group.\*\*

\- \*\*Every brief carries the exact contract of files already written\*\* — export names, types, hook

&#x20; signatures, content ids.

\- \*\*Every UI brief names the shared components to reuse, the touch-target rule, and the

&#x20; Japanese-text rules above.\*\*

\- Each subagent runs `npx eslint <its file>` and `npm run typecheck -w <its workspace>`; a

&#x20; subagent writing a test file also runs that file. The coordinator runs the full

&#x20; `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run validate

&#x20; -w @wara/content` after every group has finished — not while an agent's own `vitest` or `tsc`

&#x20; still runs.



\## Delegation Template



```text

Objective:

Allowed files:

Do not modify:

Package, module, and content ids involved:

Contracts of existing files (exports, types, hook signatures):

State and persistence expectations (Repository methods, live queries):

Tests required:

Acceptance criteria:

Verification to run:

Completion report requirements:

```



\## Completion Report



```text

Package/module:

Files changed:

Content ids added, changed, or deprecated:

Core functions touched and their tests:

Repository methods and live queries affected:

Tests added or changed:

Verification run (commands and what they showed):

Open decisions or remaining work:

```



\# orchestrate



\## Coordinator Protocol (Kernel Mode)



You are the coordinator. You plan, delegate, verify, observe, reflect. You do NOT edit code

directly.



\*\*FIRST ACTION on every task\*\*: Run the orchestration skill to classify the task size and begin

phase tracking. If that skill is not installed, classify the size and track phases manually

following this document.



\## Tool Restriction Boundary



| Thread            | Has                                  | Does NOT have                                |

| ----------------- | ------------------------------------ | -------------------------------------------- |

| Coordinator (you) | Read, Glob, Grep, Bash (verify only) | Edit, Write, NotebookEdit (delegate instead) |

| Workers           | Edit, Write, Bash                    | Agent (cannot delegate)                      |



This boundary is absolute. Enforced by the `tools` frontmatter in `.claude/agents/\*.md`, not by

this table.



\## Meta-Cognitive Protocol



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

| 12 | Test Planning | What would convince a skeptic? Write test names as assertions (should X when Y); target boundary inputs — a due date exactly `now`, an empty due list, a confusion partner that is itself due — and the failure I fear most. |

| 13 | Testing | Did I read the output, or trust a green mark? If every test passed and the scheduler were wrong, would the output show it? Where no suite covers the surface (a drill on a phone), say which real path was exercised; never report "tests pass" when nothing ran. |

| 14 | Coverage Analysis | What would a confused learner do? Close the tab mid-session? Import an old export over a newer database? Switch devices? What state transition has never been exercised? |

| 15 | Test Quality | Play adversary: how would I make all tests pass while shipping a wrong schedule? Mutate mentally — swap a rating, drop an `await`, reverse a sort — would a test fail? If not, strengthen. |

| 16 | Completion | What surprised me? What would I do differently? What does the next session need to know? Record it; low-confidence reflections that recur become a memory. |



\### How to reflect



A hard enforcement. Each transition includes a genuine 1–3 sentence answer that names specific

evidence — files read, patterns found, risks acknowledged. Empty, generic, or off-question answers

are not acceptable. Low confidence means loop back, not advance.



\## Size Classification and Skip Rules



| Type | Definition | Phases used |

| ---- | ---------- | ----------- |

| TRIVIAL | No behavioural change — typo, docs, a mnemonic text | setup, implementation, completion |

| SMALL | One behavioural change, isolated; no contract, default, or schema change; a content addition that follows an existing schema | setup, triage, discovery, skill\_discovery, implementation, domain\_compliance, test\_planning, testing, coverage, test\_quality, completion |

| MEDIUM | Changes a default, a schema, a scheduling rule, a route, or observable output — regardless of diff size; any new feature | all but complexity\_analysis |

| LARGE | A new package, module, or Dexie schema version; anything touching `commitReview` or the FSRS wrapper | all |



\## Guards



Implemented by user-level hooks. \*\*Record in MEMORY.md whether they are installed on the current

machine; until confirmed, every check they describe is run manually and never assumed to have

fired.\*\* agent-first, output-location, compaction-gate, iteration-limit (50 tool calls per task),

post-edit (`npm run typecheck`), agent-stop-guard, session-stop-guard, package-manager-guard

(`npm` for `package-lock.json`), context-spike, checkpoint-gate, reflection-required.



\## Completion Promises



Workers include exactly one signal string in their final message:

\*\*IMPLEMENTATION\_COMPLETE / VERIFICATION\_PASSED / VERIFICATION\_FAILED / IMPLEMENTATION\_BLOCKED /

NEEDS\_COORDINATOR\_INPUT\*\* (domain workers); \*\*REVIEW\_PASSED / REVIEW\_ISSUES\_FOUND /

REVIEW\_BLOCKED\*\* (review workers).



\## Coordinator Rules



\- ARCHITECTURE.md is the source of truth for routing, verification commands, and conventions.

\- The coordinator NEVER uses Edit/Write. Workers NEVER delegate.

\- Observe the work, not the workflow: observations are about code, content, and findings, never

&#x20; about phases or context usage.

\- Mechanical checks are necessary, not sufficient: at phases 9–15 the coordinator reads the

&#x20; diff and reasons about it. Code that emits files (the content bundler) is verified by running it

&#x20; and reading what it wrote.

\- Project memories go to `.claude/memories/` (tracked). At phase 16, extract what is reusable

&#x20; across sessions and delegate the memory write.



\## Call Graph Output



Plain text, indented arrows, `text` block, one section per entry point. The real graphs live in

ARCHITECTURE.md; this shows the format:



```text

"Mulai sesi hari ini"

&#x20; → SessionPage (apps/web)

&#x20;   → useSessionPlan (hook)

&#x20;     → repository.getDueStates(now)            // src/data, Dexie

&#x20;     → planSession({ availableMin, dueStates, cursor, profile, now })   // @wara/core

&#x20;   → SessionProvider → first activity

```

