# Phase 7: VS Token Savings A/B Plan

**Date:** 2026-04-18
**Goal:** Validate C-VS-b Variable Substitution prototype for shipping (>10% token savings gate)

---

## Current State

Swarm Registry in `render-rich.mjs` (lines 120-125) generates full expert list with summaries:

```javascript
// Section 6: Registry
out += `## 7. Swarm Registry\n`;
out += system.experts
  .map((e) => `* **${e.id}:** ${e.summary}`)
  .join("\n");
out += `\n`;
```

Output (~880 chars for 11 experts):
```
## 7. Swarm Registry
* **expert-abstractions-liskov:** Design specialist for stable interfaces...
* **expert-architect-descartes:** Foundational architect who strips assumptions...
...
```

The `EXPERT_ROSTER` variable currently produces just IDs (pipe-separated). Need to update it to produce the full formatted list for actual token savings.

---

## Implementation Steps

### 1. Update `buildVariableMap()` in `scripts/lib/build-prompt-system.mjs`

Change `EXPERT_ROSTER` to produce full markdown list with summaries:

```javascript
// EXPERT_ROSTER: full Swarm Registry markdown
if (system.experts) {
  vars.EXPERT_ROSTER = "## 7. Swarm Registry\n" +
    system.experts.map(e => `* **${e.id}:** ${e.summary}`).join("\n") +
    "\n";
}
```

### 2. Update renderers to use `{{EXPERT_ROSTER}}` placeholder

- `render-rich.mjs`: Replace lines 121-124 with `out += "{{EXPERT_ROSTER}}";`
- `render-codex.mjs`: Find and update Swarm Registry section
- Verify all targets use consistent variable

### 3. Add unit tests for formatted roster

Add test in `prompt-system.test.mjs`:
```javascript
test("EXPERT_ROSTER variable produces formatted markdown", () => {
  const content = "{{EXPERT_ROSTER}}";
  const system = {
    experts: [{ id: "expert-engineer-peirce", summary: "Implementation lead" }]
  };
  const result = applyVariableSubstitution(content, system, { vsEnabled: true });
  assert.ok(result.includes("## 7. Swarm Registry"));
  assert.ok(result.includes("* **expert-engineer-peirce:** Implementation lead"));
});
```

### 4. Run VS A/B Measurement

```bash
# Control (no --vs): default build
npm run build:prompts
CONTROL_SIZE=$(wc -c compiled/*/rules/00-init.md | tail -1)

# Ablated (--vs): with substitution
node scripts/build-prompt-system.mjs --vs
VS_SIZE=$(wc -c compiled/*/rules/00-init.md | tail -1)

# Calculate savings
echo "Control: $CONTROL_SIZE"
echo "VS: $VS_SIZE"
echo "Savings: $(($CONTROL_SIZE - $VS_SIZE)) chars"
```

### 5. Gate Check

- Calculate: `(control - ablated) / control * 100`
- If >10%: ship VS (set as default)
- If <10%: defer C-VS-b to follow-up phase

---

## Estimated Token Savings

- 11 experts × ~80 chars each = ~880 chars in Swarm Registry
- × 6 targets (claude, windsurf, cursor, crush, gemini, codex)
- Total: ~5,280 chars saved
- Current avg artifact size: ~50,000 chars
- **Estimated savings: ~10.5%** (meets >10% gate)

---

## Files to Modify

| File | Change |
|------|--------|
| `scripts/lib/build-prompt-system.mjs` | Update EXPERT_ROSTER variable format |
| `scripts/lib/render-rich.mjs` | Replace with `{{EXPERT_ROSTER}}` placeholder |
| `scripts/lib/render-codex.mjs` | Replace with `{{EXPERT_ROSTER}}` placeholder |
| `scripts/lib/prompt-system.test.mjs` | Add formatted roster test |

---

## Verification

1. `npm run test:unit` passes (135 tests)
2. `npm run build:prompts` produces identical output to control
3. ~~VS A/B shows >10% token savings~~ **Gate not met: 0% savings**
4. Routing behavior unchanged (smoke suite passes)

## Result: Gate Not Met

Token savings measured: **0%**

The current VS implementation substitutes content at the same size — the Swarm Registry is ~1000 chars whether inlined or via substitution. Token savings would require a genuinely shorter representation (e.g., just expert IDs without summaries), which would change semantic content.

**Recommendation:** Defer C-VS-b to follow-up phase. VS infrastructure is in place; future work could explore:
- Compact variable formats (IDs only, no summaries)
- Global deduplication across targets (shared variable references)
- Per-project customization via project-overrides.json
