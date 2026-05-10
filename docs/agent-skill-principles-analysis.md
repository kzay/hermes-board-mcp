# Agent Skill Principles And Hermes Board Analysis

Source: Perplexity Research, ["Designing, Refining, and Maintaining Agent Skills at Perplexity"](https://research.perplexity.ai/articles/designing-refining-and-maintaining-agent-skills-at-perplexity), published May 1, 2026.

Analysis date: May 10, 2026.

This note distills the article into project-facing principles. It is not a copy of the article; it translates the guidance into decisions for `hermes-board-mcp`, the project-local Codex/OpenSpec skills, and the published `@kzay/hermes-board-skills` client package.

## Core Principles

1. A skill is a directory, not just a Markdown file.
   Keep `SKILL.md` as the small hub. Put deterministic helpers in `scripts/`, bulky conditional material in `references/`, reusable output shapes in `assets/`, and first-run setup data in config files.

2. A skill description is a routing trigger.
   Descriptions should say when the agent should load the skill, using user intent and real user phrasing. They should not summarize the workflow or market the skill.

3. Every token is a tax.
   Index descriptions are paid every session. Loaded skill bodies are paid for the rest of the conversation. Runtime files are cheaper because the agent reads them only when needed.

4. Add a skill only when it changes agent behavior that otherwise fails.
   Good reasons include durable project knowledge outside model training, repeated inconsistency, domain boundaries, project taste, or safety-critical workflow constraints. A list of obvious commands is better as documentation than as a skill.

5. Evals should come before skill changes.
   A skill needs positive examples, negative examples, and neighboring examples that should route elsewhere. Description changes are especially risky and should be backed by routing evals.

6. Skill bodies should contain judgment, not recipes.
   Tell the agent what outcome matters, what to preserve, when to stop, and which edge cases matter. Avoid over-prescribing command sequences the model already knows.

7. Gotchas are high-value content.
   A known failure, forbidden action, off-target load, or domain boundary is often more valuable than more general guidance. Skills should be append-mostly after release, with the gotchas section growing as failures are observed.

8. Use progressive disclosure.
   Heavy provider details, API quirks, formatting rules, and rare branches should live outside `SKILL.md` and be read only when conditions call for them.

9. New skills can regress old skills.
   Adding or broadening one skill changes the routing environment for all others. Treat skill additions and description edits like changes to a shared public API.

10. Test across supported agent surfaces.
    This project has Codex-local skills, `.agents` skills, Cursor client skills, and an MCP server. Skill expectations should be checked where they actually run, not only where they are authored.

## Project Fit

The current project already follows several of these principles:

- The published client skills use focused, task-shaped names: `hb-deploy`, `hb-monitor`, `hb-plan`, `hb-worker`, and `hb-release`.
- The `hb-*` split is product-shaped rather than implementation-shaped. Each skill maps to a recognizable user intent.
- The client skills are short enough that context cost is not currently the main risk.
- The skills repeatedly enforce external-action boundaries: no push, publish, merge, release, credential mutation, or remote side effect without explicit approval.
- `hb_import_spec` keeps provider-backed dispatch inside the MCP server instead of requiring client skills to construct task payloads by hand.
- `test/release-check.test.ts` protects the canonical package surface by rejecting stale OpenSpec-named client skills and missing `hb-*` skills.

## Main Risks

1. Skill routing overlap in project-local skills.
   `.agents/skills` contains both `openspec-*` skills and `source-command-opsx-*` skills for similar propose/apply/explore/archive workflows. `.codex/skills` contains another `openspec-*` set. If more than one family is indexed by the same agent, the descriptions are close enough to cause accidental loads.

2. Routing descriptions are useful but not maximally discriminating.
   The Codex skill descriptions generally say "Use when...", which is good, but they still read partly like summaries. The `source-command-opsx-*` descriptions are shorter and more ambiguous, especially next to the canonical `openspec-*` descriptions.

3. Routing evals are missing.
   The repository verifies package shape and stale names, but there is no dedicated fixture proving that realistic user requests choose `hb-deploy` instead of `hb-plan`, `hb-monitor` instead of `hb-release`, or `openspec-explore` instead of `openspec-propose`.

4. Some deterministic repeated logic still lives as prose.
   `hb-deploy` tells agents to resolve config precedence, validate provider refs, check OpenSpec state, verify Git status, and determine whether a commit is reachable. That is acceptable at the current size, but these are good candidates for helper scripts if the behavior becomes more complex or failure-prone.

5. Provider-specific details may grow.
   Today `openspec:` is the only release-ready provider. As additional prefixes become real, provider-specific validation and dispatch guidance should move into `references/providers/<provider>.md` or equivalent runtime-loaded material.

6. Documentation drift is already visible.
   The root `package.json` reports `3.3.0`, while some installation and release-facing docs still refer to `3.2` or `3.2.0`. This is not a skill-design problem by itself, but stale release facts often leak into skills and agent instructions.

## Recommended Skill Architecture

For project-local skills:

- Keep `.codex/skills/<name>/SKILL.md` as the concise routing and behavior hub.
- Prefer descriptions shaped like: `Load when the user wants...`
- Keep each description under about 50 words and include two or three realistic user phrasings only when they improve routing.
- Retire, hide, or sharply distinguish legacy/experimental skill families that overlap with canonical skills.
- Split long exploratory or procedural skills into `references/` when they contain mode guides, templates, or rare branches.

For `client/skills/hb-*`:

- Treat each skill directory as the package surface, even if Cursor does not use Codex-style frontmatter.
- Keep the first heading and `When to Use` section as the routing surface for platforms that scan Markdown directly.
- Keep `SKILL.md` focused on intent, guardrails, and the primary workflow.
- Move provider-specific or uncommon detail into references once another provider becomes release-ready.
- Consider adding a small `scripts/` helper if agents repeatedly get config resolution, provider validation, or commit reachability wrong.

For the MCP server:

- Keep deterministic protocol behavior in TypeScript, not in skills.
- Use skills to express orchestration judgment: when to call a tool, when to stop, what evidence is required, and which external actions require approval.
- Keep tool descriptions aligned with skill routing so MCP tools and client skills do not fight each other.

## Suggested Eval Fixtures

Add a lightweight routing fixture, for example `client/skills/evals/routing.json`, and include it in `npm run release:check` or a future skill-specific check.

Suggested positive and negative cases:

| User request | Expected skill | Should not load |
| --- | --- | --- |
| "Deploy this OpenSpec change to Hermes workers." | `hb-deploy` | `hb-plan`, `hb-worker` |
| "Create a few board tasks for this refactor." | `hb-plan` | `hb-deploy` |
| "What is running on the board right now?" | `hb-monitor` | `hb-release` |
| "Follow this dispatched spec until it finishes." | `hb-monitor` | `hb-worker` |
| "I am working task HB-123 and need to report progress." | `hb-worker` | `hb-monitor` |
| "Mark verified release tasks complete and archive them." | `hb-release` | `hb-worker` |
| "Think through this OpenSpec idea before we write a proposal." | `openspec-explore` | `openspec-propose` |
| "Create a proposal and tasks for this change." | `openspec-propose` | `openspec-explore` |
| "Implement the accepted OpenSpec change." | `openspec-apply-change` | `openspec-propose` |
| "Archive the completed OpenSpec change." | `openspec-archive-change` | `openspec-apply-change` |

For each skill, include forbidden examples for adjacent intents. Negative examples are especially important for this repository because the skill names are intentionally close.

## Practical Maintenance Rules

1. Any new skill must include:
   - A routing description.
   - Positive routing examples.
   - Negative routing examples.
   - A collision review against neighboring skills.
   - A clear owner surface: Codex local, `.agents`, Cursor client package, or server documentation.

2. Any skill description edit must include:
   - At least one positive eval explaining the new phrasing.
   - At least one negative eval showing what should not route there.
   - A review of overlapping skill descriptions.

3. Any observed agent failure should usually become:
   - A gotcha, if the routing was correct but execution went wrong.
   - A negative eval plus description tightening, if the skill loaded off target.
   - A positive eval plus description keyword, if the skill failed to load.
   - A server-side fix, if deterministic MCP behavior was wrong.

4. Any provider expansion should include:
   - Server-side provider tests.
   - Client skill routing updates.
   - Provider-specific reference material.
   - Release checks that prevent stale provider names or unsupported promises.

## Near-Term Actions

1. Decide whether `source-command-opsx-*` is still needed beside `openspec-*`. If it is experimental, make that visible in the routing description and keep it out of normal indexes where possible.

2. Add skill routing eval fixtures for `hb-*` and OpenSpec skills. The current release checks prove files ship; they do not prove agents choose the right skill.

3. Tighten project-local skill descriptions toward `Load when...` phrasing with real user intent and clearer boundaries.

4. Add `Gotchas` sections to the published `hb-*` skills as failures are observed. Start with existing known boundaries: no automatic push, no local task arrays for `hb_import_spec`, no release action without explicit approval, and no unsupported provider promises.

5. Add a docs/version drift check for release-facing instructions so `AGENTS.md`, `README.md`, `client/README.md`, and package metadata do not diverge.

6. When a second provider becomes release-ready, split provider-specific client guidance out of `hb-deploy` into a progressively loaded reference file.

