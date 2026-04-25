# Rule File "Finished Assimilating" Trailers (TDD)

Add a small in-character trailer to every generated rule file that instructs the model to announce completion on load, so silently-ignored preloads become observable — driven by RED-first tests in `prompt-smoke.test.mjs`.

## Why

Loud preload directives (`ALWAYS PRELOAD THESE FILES`) can be silently skipped with no feedback to the user. A compact, per-file "announce completion" trailer gives a cheap, observable proof-of-load signal. Keeping it short and in-character keeps it unobtrusive in the compiled artifacts while still being executable for the model.

## Scope (files that gain a trailer)

All 77 generated rule files across every render target:

- **Rich targets** (5 × 13 = 65 files) — `compiled/{claude,windsurf,cursor,crush,gemini}/rules/{00-init,01-router,expert-*}.{md,mdc}`.
- **Codex** (12 files) — `compiled/codex/AGENTS.md` and `compiled/codex/skills/<expert>/SKILL.md` for each of the 11 experts.
- **No starting banner.** (Dropped per your call — trailer-only.)

## Data model (source of truth = `prompt-system/` JSON)

Add an optional string field to each source spec. Missing = fall through to a neutral default so adding future experts doesn't break the build.

- `prompt-system/system.json` → `globalRuntime.assimilationAnnouncement` — one line covering both init artifacts (`00-init.*` and codex `AGENTS.md`).
- `prompt-system/router.json` → `assimilationAnnouncement` — one line for every `01-router.*`.
- `prompt-system/experts/expert-*.json` → `assimilationAnnouncement` — one in-character line for the expert's rule file (used by both rich `expert-*.*` and codex `SKILL.md`).

### Starter wording (can be tweaked per file, kept short and in-character)

- `system.json` — `"The swarm is awake. Announce: \"Assimilated: 00-init.\""`
- `router.json` — `"Switchboard online. Announce: \"Assimilated: 01-router.\""`
- `expert-qa-popper` — `"Conjecture armed. Announce: \"Assimilated: expert-qa-popper.\""`
- `expert-engineer-peirce` — `"Hypothesis provisionally accepted. Announce: \"Assimilated: expert-engineer-peirce.\""`
- `expert-architect-descartes` — `"Foundations laid. Announce: \"Assimilated: expert-architect-descartes.\""`
- …and one in-character line per remaining expert (`blackmore`, `dennett`, `dijkstra`, `knuth`, `liskov`, `rogers`, `shannon`, `simon`).

**Canonical marker token**: every announcement contains the literal substring `Assimilated: <canonical-id>` (no extension). The `<canonical-id>` is the rule file id (`00-init`, `01-router`, `expert-qa-popper`, …). Tests assert on this token, so the cute wording around it can evolve freely without breaking tests.

## Render wiring

One new helper in `scripts/lib/prompt-system.mjs` keeps every renderer consistent:

```js
export function assimilationTrailer(announcement, fallbackId) {
  const text = announcement || `Announce: "Assimilated: ${fallbackId}."`;
  return `\n\n---\n\n> ${text}\n`;
}
```

Apply it at the end of the already-existing renderers (no new files required):

- `scripts/lib/render-rich.mjs`
  - `renderRichInit` → trailer with `system.globalRuntime.assimilationAnnouncement`, id `00-init`.
  - `renderRichRouter` → trailer with `system.router.assimilationAnnouncement`, id `01-router`.
  - `renderRichExpert` → trailer with `expert.assimilationAnnouncement`, id `expert.id`.
- `scripts/lib/render-codex.mjs`
  - `renderAgents` → same trailer, id `00-init` (codex global equivalent).
  - `renderSkill` → same trailer, id `expert.id`.

The trailer is always the last non-empty content in the returned string, after any existing sections. Frontmatter stays at the top untouched.

## TDD sequence (strict red-green)

### Step 1 — RED: add tests first, run them, confirm failure

Append to `scripts/lib/prompt-smoke.test.mjs` (keeps the file as the single source of structural invariants, consistent with existing PROTOCOL tests):

- **PROTOCOL**: every rule artifact (rich + codex) ends with the trailer marker `Assimilated: <canonical-id>` for its own id. Iterates all artifacts from `generateArtifacts(system)`.
- **PROTOCOL**: the trailer is the last non-empty line of every artifact (guards against accidental post-trailer content).
- **PROTOCOL**: every expert JSON provides a non-empty `assimilationAnnouncement` and the rendered expert artifact includes that exact announcement text verbatim.
- `system.json` has `globalRuntime.assimilationAnnouncement` and every rendered init artifact (rich + codex `AGENTS.md`) embeds it verbatim.
- `router.json` has `assimilationAnnouncement` and every rendered router artifact embeds it verbatim.
- Codex `SKILL.md` for each expert embeds the expert's announcement verbatim.

Then:

```
npm run build:prompts   # builds current (no trailer) artifacts
npm run test:unit       # EXPECT: the new tests FAIL (red)
```

Capture the failure output into `progress.txt` so we can show clean before/after.

### Step 2 — GREEN: implement

1. Add `assimilationTrailer()` helper to `scripts/lib/prompt-system.mjs`.
2. Append the trailer in each of the 5 renderer entry points listed above.
3. Add `assimilationAnnouncement` fields to `prompt-system/system.json`, `prompt-system/router.json`, and each of the 11 `prompt-system/experts/expert-*.json`.
4. `npm run build:prompts` to regenerate `compiled/`.
5. `npm run test:unit` → expect all green (136 existing tests + the new ones).
6. Run `npm run test:regressions:smoke` if it exists (spot-check router still behaves) — should be unaffected.

### Step 3 — Validate artifact shape by eye

- `tail -6 compiled/windsurf/rules/expert-qa-popper.md` — should show horizontal rule + blockquote with Popper's line.
- `tail -6 compiled/codex/AGENTS.md` — should show global init line.
- `tail -6 compiled/cursor/rules/01-router.mdc` — should show router line.
- Confirm frontmatter at top of each is unchanged.

## Non-goals

- **No change** to `compiled/` files by hand — they're regenerated.
- **No new render target**, no new frontmatter field, no change to routing logic.
- **No starting/preload banner** — trailer-only per your direction.
- **Not touching** `.windsurf/rules/00-init.md` / `01-router.md` (those are your per-IDE preload copies, separate from the generated prompt-system artifacts).

## Open question to resolve during implementation

- **Exact wording per expert**: the starter lines above are my first drafts. I'll draft all 11 in-character lines in a single diff so you can react to them together; tests only assert the canonical `Assimilated: <id>` token so the prose can change freely.
