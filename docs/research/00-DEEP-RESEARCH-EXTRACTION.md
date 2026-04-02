# Deep Research Extraction: Claude Code Source Analysis

**Date:** 2026-03-31
**Source:** Claude Code CLI leaked source (~1,900 files, 512K+ lines TypeScript)
**Purpose:** Extract transferable process knowledge, architectural patterns, guardrails, and operational philosophy for application to other AI-powered tooling projects.

---

## Table of Contents

1. [Prompt Engineering Architecture](#1-prompt-engineering-architecture)
2. [The Permission & Trust Model](#2-the-permission--trust-model)
3. [Tool System Design](#3-tool-system-design)
4. [Safety Engineering at Every Layer](#4-safety-engineering-at-every-layer)
5. [Behavioral Guardrails in Natural Language](#5-behavioral-guardrails-in-natural-language)
6. [The Hook System: Extensibility Without Compromise](#6-the-hook-system-extensibility-without-compromise)
7. [Skill System: Reusable Behavioral Units](#7-skill-system-reusable-behavioral-units)
8. [Memory & Persistent Context](#8-memory--persistent-context)
9. [Context Management & Cache Optimization](#9-context-management--cache-optimization)
10. [Multi-Agent Coordination](#10-multi-agent-coordination)
11. [Configuration Hierarchy & Enterprise Lockdown](#11-configuration-hierarchy--enterprise-lockdown)
12. [Testing Philosophy](#12-testing-philosophy)
13. [Feature Flag Architecture & Dead Code Elimination](#13-feature-flag-architecture--dead-code-elimination)
14. [Agent Operating Guides](#14-agent-operating-guides)
15. [Output Style & Communication Design](#15-output-style--communication-design)
16. [Verification & False-Claims Mitigation](#16-verification--false-claims-mitigation)
17. [Plugin & Marketplace Architecture](#17-plugin--marketplace-architecture)
18. [Transferable Principles](#18-transferable-principles)
19. [Anti-Patterns Identified & Avoided](#19-anti-patterns-identified--avoided)
20. [Actionable Takeaways](#20-actionable-takeaways)

---

## 1. Prompt Engineering Architecture

### The Layered System Prompt

Claude Code does not use a monolithic system prompt. It constructs prompts through a **priority-based hierarchy** with distinct layers:

```
Override System Prompt (loop mode, replaces all)
  -> Coordinator System Prompt (multi-agent)
    -> Agent System Prompt (custom agent definitions)
      -> Custom System Prompt (--system-prompt flag)
        -> Default System Prompt (standard behavioral core)
          + appendSystemPrompt (suffix additions)
```

**Transferable insight:** The system prompt is not a flat string. It is a computed artifact assembled from multiple sources with clear precedence rules. This lets different execution contexts (single agent, multi-agent coordinator, IDE bridge, loop mode) share the same codebase with different behavioral profiles.

### Static vs Dynamic Boundary

The prompt is split by a boundary marker (`SYSTEM_PROMPT_DYNAMIC_BOUNDARY`):

- **Before the boundary:** Static content -- cacheable across users and sessions. Contains behavioral rules, tool guidance, tone instructions.
- **After the boundary:** Dynamic content -- session-specific. Contains memory, environment info, MCP server instructions, language preferences, model overrides.

This is a **prompt cache optimization**: the static prefix gets a Blake2b hash for cache lookup. Every conditional that crosses this boundary multiplies cache variants exponentially (`2^N` for N boolean conditions).

**Key engineering decision:** Several runtime conditionals were explicitly moved to the dynamic section even though they feel "static" -- because having them before the boundary would fragment the cache. Comments in the code document these decisions:

```
// @[MODEL LAUNCH]: capy v8 assertiveness counterweight (PR #24302) -- un-gate once validated on external via A/B
```

**Transferable insight:** Prompt caching is a first-class architectural concern. Treat the system prompt like a compiled artifact with a stable prefix and a dynamic suffix. Document why things live where they do.

### Section-Based Caching

Dynamic sections use a registry pattern:

```typescript
systemPromptSection('memory', () => loadMemoryPrompt())         // Cached until /clear or /compact
DANGEROUS_uncachedSystemPromptSection('mcp_instructions', ...)  // Recomputes every turn (explicit naming = intent)
```

The `DANGEROUS_` prefix on the uncached variant is deliberate API design -- it communicates cost and intent. Uncached sections bust the prompt cache, so each one must justify its existence.

**Transferable insight:** Name your performance-sensitive abstractions to communicate cost. `DANGEROUS_` is not security here -- it is performance. The naming convention prevents accidental cache-busting by future contributors.

---

## 2. The Permission & Trust Model

### Seven-Step Permission Pipeline

Every tool invocation passes through a 7-step check:

1. **Rule-based deny** -- Entire tool blocked by config
2. **Rule-based ask** -- Tool has an ask rule (unless sandbox auto-allows)
3. **Tool-specific permission check** -- `tool.checkPermissions()` custom logic
4. **Content-specific rules** -- Pattern matching (`Bash(npm publish:*)`)
5. **Safety checks on protected paths** -- `.git/`, `.claude/`, shell configs (**bypass-immune**)
6. **Mode-based logic** -- bypassPermissions, plan mode
7. **Fallback to ask** -- Default is "prompt the user"

**Critical design property:** Step 5 (protected paths) is bypass-immune. Even in `bypassPermissions` mode, writes to `.git/`, `.claude/`, or shell configs require approval. This is a hard safety boundary that cannot be overridden by any configuration.

### The Auto-Mode Classifier

When the `auto` permission mode is enabled, an ML classifier evaluates tool calls:

- Denial tracking: max 3 consecutive denials, max 20 total per session
- Fail-closed gate: if classifier unavailable, deny (not allow)
- Fast paths: known-safe tools skip the classifier entirely
- Configurable iron gate: `tengu_iron_gate_closed` feature flag

**Transferable insight:** When using ML for safety decisions, always fail closed. The Claude Code classifier defaults to DENY when the classifier API is unavailable, not to prompting. This prevents silent auto-approvals during outages.

### Permission Rule Syntax

Rules use a tool-name + glob pattern syntax:

```
Bash(git *)           # Allow all git commands
FileEdit(/src/*)      # Allow edits to anything in src/
FileRead(*)           # Allow reading any file
Agent(general-purpose) # Allow specific agent type
```

**Transferable insight:** Permission rules should be human-readable and composable. The `ToolName(pattern)` syntax is intuitive, supports wildcards, and can be stored in JSON config files. This same syntax works for allow, deny, and ask behaviors.

---

## 3. Tool System Design

### The `buildTool()` Factory

Every tool is constructed through a single factory function that enforces a consistent interface:

```typescript
export const MyTool = buildTool({
  name: 'MyTool',
  aliases: ['my_tool'],
  description: 'What this tool does',
  inputSchema: z.object({ param: z.string() }),

  async call(args, context, canUseTool, parentMessage, onProgress) { ... },
  async checkPermissions(input, context) { ... },
  isConcurrencySafe(input) { ... },
  isReadOnly(input) { ... },
  isDestructive(input) { ... },
  prompt(options) { ... },
  renderToolUseMessage(input, options) { ... },
  renderToolResultMessage(content, progressMessages, options) { ... },
})
```

**Design properties:**
- **Fail-closed defaults:** `isDestructive: () => false`, `checkPermissions: () => allow`
- **Self-describing:** Each tool contributes its own system prompt section via `prompt()`
- **Self-rendering:** Each tool owns its terminal UI via `renderToolUseMessage()` / `renderToolResultMessage()`
- **Concurrent-aware:** Each tool declares whether it can run in parallel
- **Input-validated:** Zod schemas at the boundary, before permissions are checked

**Transferable insight:** The tool factory pattern forces consistency across 40+ tools by making the interface impossible to skip. Every tool must declare its permission model, concurrency safety, and rendering. Optional methods have safe defaults.

### Tool Directory Convention

```
src/tools/MyTool/
  MyTool.ts       # Core implementation
  UI.tsx          # Terminal rendering
  prompt.ts       # System prompt contribution
  utils.ts        # Tool-specific helpers
  constants.ts    # Shared constants
```

**Transferable insight:** Co-locate everything about a tool in one directory. Prompt contribution, UI, logic, and constants all live together. This prevents the "where does this tool's prompt live?" question and makes tools genuinely self-contained.

### Tool Pool Assembly

Tools are not just registered -- they are assembled into filtered pools:

```typescript
getAllBaseTools()           // All tools
filterToolsByDenyRules()   // Remove denied tools BEFORE model sees them
getMergedTools()           // Combine built-in + MCP tools
assembleToolPool()         // Final pool for this session
```

**Critical detail:** Denied tools are stripped from the schema presented to the model. The LLM never sees tools it cannot use. This prevents the model from attempting denied actions and reduces prompt noise.

### Deferred Tool Loading

Not all tools are loaded upfront. The `ToolSearchTool` discovers tools at runtime from MCP servers. This prevents bloating the initial tool list while maintaining discoverability.

**Transferable insight:** For large tool ecosystems, use lazy discovery. Present a core set of tools plus a "discover more tools" meta-tool. This keeps the initial context budget lean.

---

## 4. Safety Engineering at Every Layer

### Bash Command Security

The `bashSecurity.ts` module implements layered defense:

1. **Dangerous pattern blocking:** 20+ regex patterns for high-risk commands (`rm -rf /`, `sudo`, `chmod 777`, `mkfs`, `dd if=`, pipe-to-shell)
2. **Git safety:** Allowlist of safe git subcommands (diff, log, show). Blocks force-push to protected branches
3. **Output redirection detection:** Parses commands for redirects to system paths (`> /etc/passwd`)
4. **Zsh-specific blocks:** `zmodload`, `emulate`, `sysopen`, `zpty`, `ztcp`
5. **PowerShell blocks:** Defense-in-depth -- blocks PS syntax even in bash
6. **Flag allowlists:** Each command has defined safe flags

### Protected Path Immunity

Certain paths are protected regardless of permission mode:

- `.git/` -- Version control metadata
- `.claude/` -- Session state
- `.vscode/` -- Editor config
- Shell configs (`~/.bashrc`, `~/.zshrc`, etc.)

These protections use `safetyCheck` as the decision reason and **cannot be bypassed** even in `bypassPermissions` mode.

**Transferable insight:** Identify the small set of paths/resources that must NEVER be modified without explicit consent. Make these protections immune to configuration overrides. Hard safety boundaries should be in code, not config.

### Sandbox Integration

The sandbox system wraps tool execution with filesystem and network restrictions:

- Read/write allowlists and denylists
- Network access control
- Auto-allow sandboxed bash: if a command would be sandboxed, skip the ask rule
- Server-side: command allowlist, 5-min timeout, 10MB output limit, env var scrubbing, rate limiting

### Sensitive Data Scrubbing

Environment variables matching sensitive patterns (API_KEY, SECRET, TOKEN, etc.) are stripped before passing to hooks and subprocesses. The system maintains explicit allowlists for what env vars can be interpolated in hooks.

---

## 5. Behavioral Guardrails in Natural Language

### The Prompt Rules

Claude Code's system prompt contains carefully crafted behavioral instructions. These are not generic -- they address specific observed failure modes:

**Code style discipline:**
> "Don't add features, refactor code, or make 'improvements' beyond what was asked. A bug fix doesn't need surrounding code cleaned up."

> "Don't create helpers, utilities, or abstractions for one-time operations. Three similar lines of code is better than a premature abstraction."

> "Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees."

**Diagnostic discipline:**
> "If an approach fails, diagnose why before switching tactics -- read the error, check your assumptions, try a focused fix. Don't retry the identical action blindly, but don't abandon a viable approach after a single failure either."

**Reversibility awareness:**
> "Carefully consider the reversibility and blast radius of actions. Generally you can freely take local, reversible actions. But for actions that are hard to reverse, affect shared systems, or could otherwise be risky, check with the user before proceeding."

> "A user approving an action (like a git push) once does NOT mean that they approve it in all contexts."

**Anti-gold-plating (Anthropic internal):**
> "Default to writing no comments. Only add one when the WHY is non-obvious."

> "Before reporting a task complete, verify it actually works: run the test, execute the script, check the output. Minimum complexity means no gold-plating, not skipping the finish line."

**Transferable insight:** These rules address real failure modes observed in production. Each rule exists because models actually do the prohibited thing. The rules are prescriptive AND proscriptive -- they say what to do AND what not to do, with specific examples. This is much more effective than vague instructions like "be helpful."

### The Anti-Patterns List

The prompt explicitly bans common model failure modes:

- Don't add docstrings/comments/type annotations to code you didn't change
- Don't use feature flags or backwards-compat shims when you can just change the code
- Don't rename unused vars or add `// removed` comments
- Don't propose changes to code you haven't read
- Don't give time estimates
- Don't use a colon before tool calls (UI rendering artifact)

**Transferable insight:** Maintain a living list of observed model failure modes and encode them directly in the system prompt. Each ban should trace to a specific incident or pattern.

---

## 6. The Hook System: Extensibility Without Compromise

### Hook Events

```
PreToolUse          # Before tool execution
PostToolUse         # After tool execution
PostToolUseFailure  # After tool fails
PermissionDenied    # After classifier denies
Notification        # When notifications sent
UserPromptSubmit    # When user submits prompt
SessionStart        # New session starts
Stop                # Before Claude concludes response
StopFailure         # After Stop hook fails
```

### Hook Types

1. **Command hooks** -- Shell command execution
2. **Prompt hooks** -- LLM prompt evaluation
3. **HTTP hooks** -- POST to external URL
4. **Agent hooks** -- Agentic verifier (sub-agent)
5. **Function hooks** -- Native SDK callbacks

### Hook Registration Sources

Hooks can come from five independent sources:
1. Settings.json (user/project/local)
2. Skill frontmatter (inline with skill definition)
3. Plugin manifests (marketplace-vetted)
4. SDK callbacks (programmatic consumers)
5. Session hooks (temporary, current session only)

### Hook Execution Properties

- **10-minute timeout per hook** (configurable for session-end hooks)
- **Structured JSON responses**: `{decision: "block", message: "..."}` for pre-tool hooks
- **Auto-decide for headless agents**: Hooks can return `{allow: true}` or `{deny: true}`
- **Background execution support**: Async hooks that don't block the main flow
- **Environment scrubbing**: Sensitive env vars stripped before hook execution

**Transferable insight:** The hook system is the primary extensibility mechanism. It turns Claude Code from a closed tool into a platform. The key design decisions: (1) hooks are external processes, not in-process plugins, so they can't crash the host; (2) hooks have timeouts; (3) hooks can block tool execution with structured responses; (4) multiple registration sources with clear precedence.

### Enterprise Hook Lockdown

```typescript
allowManagedHooksOnly: true  // Only hooks from managed settings run
```

This blocks user/project/local hooks, ensuring enterprises control the execution pipeline.

---

## 7. Skill System: Reusable Behavioral Units

### Skill Anatomy

Skills are markdown files with YAML frontmatter that define reusable workflows:

```yaml
---
description: What this skill does
allowed-tools: [Bash(git *), Read(*.ts)]
when_to_use: When to invoke this skill
model: haiku | sonnet | opus | inherit
context: inline | fork
agent: general-purpose | bash
hooks:
  PreToolUse:
    - type: command
      command: "echo $ARGUMENTS"
---

# Skill prompt content here
```

### Skill Sources

1. **Bundled skills**: Compiled into the binary (`registerBundledSkill()`)
2. **User skills**: `~/.claude/skills/` (personal, disk-based)
3. **Project skills**: `.claude/skills/` (team-shared, checked into repo)
4. **Plugin skills**: Via marketplace plugins
5. **Managed skills**: Enterprise-deployed

### Key Bundled Skills (16)

| Skill | Purpose |
|-------|---------|
| `batch` | Batch operations across multiple files |
| `debug` | Debugging workflows |
| `loop` | Iterative refinement loops |
| `remember` | Persist information to memory |
| `simplify` | Simplify complex code |
| `skillify` | Create new skills from workflows |
| `stuck` | Get unstuck when blocked |
| `verify` / `verifyContent` | Verify code correctness |
| `updateConfig` | Modify configuration programmatically |

### Skill Discovery

When `EXPERIMENTAL_SKILL_SEARCH` is enabled, relevant skills are automatically surfaced each turn via "Skills relevant to your task:" reminders. The `DiscoverSkillsTool` allows mid-task discovery for pivots or unusual workflows.

**Transferable insight:** Skills are the unit of reuse for AI agent behaviors. A skill is a prompt + tool restrictions + execution context + optional hooks. This is more powerful than just a prompt template because it carries its own security boundary (allowed-tools) and lifecycle hooks. Making skills discoverable (not just invocable) helps the agent find the right workflow without being explicitly told.

---

## 8. Memory & Persistent Context

### Memory Hierarchy

| Scope | Location | Purpose |
|-------|----------|---------|
| User | `~/.claude/CLAUDE.md` | Personal preferences, always private |
| Project | `.claude/CLAUDE.md` | Team conventions, shared |
| Local | `.claude/.claude-local/CLAUDE.md` | Git-ignored personal overrides |
| Extracted | `services/extractMemories/` | Auto-extracted from conversations |
| Team sync | `services/teamMemorySync/` | Shared team knowledge |

### Memory Types

The memory system defines four semantic types:

1. **user** -- Information about the user (role, expertise, preferences)
2. **feedback** -- Guidance on how to approach work (corrections AND confirmations)
3. **project** -- Ongoing work context (goals, deadlines, constraints)
4. **reference** -- Pointers to external systems (Linear projects, Grafana boards, Slack channels)

### Auto-Memory

The system can automatically extract memories from conversations:
- `autoMemoryEnabled`: Toggle auto-memory
- `autoDreamEnabled`: Background memory consolidation ("dreaming")
- Memories stored per-project: `~/.claude/projects/<sanitized-cwd>/memory/`

### Memory Constraints

- `MEMORY.md` index: 200 line limit, 25KB byte limit
- Lines beyond 200 are truncated with a warning
- Memory files use markdown with frontmatter
- Each memory is a separate file, indexed by `MEMORY.md`

**Transferable insight:** Memory is not a flat key-value store. It has semantic types that determine when memories should be created and recalled. The separation between "user" memories (who you're talking to) and "feedback" memories (how they want you to work) is powerful -- it lets the system adapt both its knowledge and its behavior. The auto-dream feature suggests memory consolidation as a background process, not just conversation-time extraction.

---

## 9. Context Management & Cache Optimization

### Prompt Cache Strategy

1. **Static prefix** before boundary marker -- globally cacheable across users/orgs (Blake2b hash)
2. **Dynamic sections** after boundary -- session-specific, no cross-session cache
3. **Section-level memoization** -- computed once, stored until `/clear` or `/compact`
4. **Feature-gated DCE** -- unused features stripped at build time to avoid prompt variance
5. **Session-stable tool schemas** -- cached to prevent mid-session cache busts from feature flag flips

### Context Compression

The `services/compact/` system handles conversation compression when approaching context limits:
- Automatic summarization of prior messages
- The conversation is presented as unlimited to the user ("This means your conversation with the user is not limited by the context window.")
- Cached microcompact configuration for efficiency

### Fork Subagent Cache Sharing

When forking a subagent, the child inherits the parent's rendered system prompt bytes. This means the child shares the parent's prompt cache prefix, reducing cold-start cost.

**Transferable insight:** Prompt caching is not just about the API-level cache. It is an architectural concern that influences where code lives, how conditionals are structured, and how subagents are spawned. Every boolean condition before the cache boundary doubles the number of cache variants. This is a performance cliff that must be managed deliberately.

---

## 10. Multi-Agent Coordination

### Agent Types & Tool Restrictions

Different agent types get different tool pools:

- `ALL_AGENT_DISALLOWED_TOOLS`: Tools blocked for ALL agents (Plan mode, AskUser, etc.)
- `ASYNC_AGENT_ALLOWED_TOOLS`: Whitelist for background agents
- `COORDINATOR_MODE_ALLOWED_TOOLS`: Coordinator gets only control tools
- `IN_PROCESS_TEAMMATE_ALLOWED_TOOLS`: Teammates get task/messaging tools

### Fork Subagent Pattern

When `FORK_SUBAGENT` is enabled:
- Fork child inherits parent's full conversation context (for cache sharing)
- Child receives `<fork_boilerplate>` tag to prevent recursive forking
- `isInForkChild()` detects and rejects fork recursion
- Children operate with `shouldAvoidPermissionPrompts: true` in headless mode

### Permission Bubble-Up

Fork children can bubble permission prompts to the parent terminal. This means a background agent can still request dangerous operations -- they just route through the parent's UI.

### Denial Tracking Per Agent

Each async agent gets its own denial tracking state (not synced to global state). Tracks consecutive and total denials separately. Falls back to prompting when limits exceeded.

### Verification Agent

When enabled (`tengu_hive_evidence` flag), non-trivial implementations require an independent adversarial verifier before reporting completion:
- 3+ file edits, backend/API changes, or infrastructure changes trigger verification
- The main agent cannot self-assign PASS
- Verifier has its own tool access and runs independently
- On FAIL: fix and re-verify. On PASS: spot-check the verifier's output

**Transferable insight:** The verification agent is adversarial by design. The implementing agent and the verifying agent are separate concerns. This prevents the "I wrote it and it looks good to me" failure mode. The contract is explicit: "Your own checks, caveats, and a fork's self-checks do NOT substitute."

---

## 11. Configuration Hierarchy & Enterprise Lockdown

### Settings Priority (Highest to Lowest)

1. CLI flags (`--model`, `--agent`, `--permissions-mode`)
2. Inline settings (programmatic API)
3. Managed settings (enterprise, MDM-deployed, read-only)
4. Policy settings (MDM + Windows Registry)
5. Project settings (`.claude/settings.json`, checked into repo)
6. User settings (`~/.claude/settings.json`)
7. Local settings (`~/.claude/local-settings.json`, not synced)
8. Built-in defaults

### Enterprise Lockdown Controls

```typescript
strictPluginOnlyCustomization: boolean | string[]  // Only plugin-provided customization
allowManagedHooksOnly: boolean                      // Only admin-approved hooks
allowManagedPermissionRulesOnly: boolean            // Only admin-approved permissions
allowManagedMcpServersOnly: boolean                 // Only admin-approved MCP servers
strictKnownMarketplaces: MarketplaceSource[]        // Lock marketplace sources
blockedMarketplaces: MarketplaceSource[]            // Block specific marketplaces
```

When `strictPluginOnlyCustomization` is active:
- Blocks: user/project/local skills, agents, hooks, MCP servers
- Allows: plugin-provided customizations (marketplace-vetted)
- Allows: managed/policy settings

**Transferable insight:** Enterprise deployment requires a lockdown hierarchy where admins can restrict what users and projects can customize. The key pattern: managed settings are read-only and take precedence over everything except CLI flags. The `strictPluginOnlyCustomization` flag is elegant -- it channels all customization through a vetted marketplace, preventing configuration drift while still allowing extensibility.

---

## 12. Testing Philosophy

### Layered Test Strategy

| Layer | Framework | Purpose |
|-------|-----------|---------|
| Smoke tests | Vitest | Core module discovery (commands load? tools load? context works?) |
| Unit tests | Vitest | Specific logic (utilities, components) |
| Component tests | Vitest + Testing Library | React component behavior (jsdom) |
| Integration tests | Vitest | Real API calls (opt-in via API key) |
| E2E tests | Playwright | Full browser automation (5 browser targets) |
| Visual regression | Playwright | Screenshot comparison (2% pixel tolerance) |

### CI Quality Gates

- Lint (Biome) -- required
- Type-check (TypeScript strict) -- required
- Bundle size gate -- < 150KB gzipped for web
- Security audit -- non-blocking baseline
- Coverage thresholds -- 80% statements, 75% branches, 80% functions, 80% lines

### Test Isolation Patterns

1. **Factory functions** with auto-incrementing IDs prevent test data collisions
2. **MSW (Mock Service Worker)** for API mocking with proper streaming simulation
3. **In-memory transports** for MCP client-server tests
4. **Fake timers** with flush-promises helpers for async testing
5. **Provider wrappers** (`renderWithProviders()`) for component isolation

**Transferable insight:** The smoke test layer is underrated. `tests/smoke/commands.test.ts` just verifies that commands load without errors. This catches import cycles, missing dependencies, and registration bugs before any behavioral testing. It is the cheapest test with the highest signal-to-noise ratio.

---

## 13. Feature Flag Architecture & Dead Code Elimination

### Build-Time Feature Flags

```typescript
import { feature } from 'bun:bundle'

if (feature('VOICE_MODE')) {
  // This code is COMPLETELY STRIPPED at build time if VOICE_MODE is off
  const voiceCommand = require('./commands/voice/index.js').default
}
```

### Active Feature Flags

| Flag | Feature |
|------|---------|
| `PROACTIVE` | Proactive agent mode (autonomous actions) |
| `KAIROS` / `KAIROS_BRIEF` | Kairos subsystem |
| `BRIDGE_MODE` | IDE bridge integration |
| `DAEMON` | Background daemon mode |
| `VOICE_MODE` | Voice input/output |
| `AGENT_TRIGGERS` | Triggered agent actions |
| `MONITOR_TOOL` | Monitoring tool |
| `COORDINATOR_MODE` | Multi-agent coordinator |
| `WORKFLOW_SCRIPTS` | Workflow automation |
| `FORK_SUBAGENT` | Fork-based subagent spawning |
| `TOKEN_BUDGET` | Token budget management |
| `VERIFICATION_AGENT` | Adversarial verification |
| `EXPERIMENTAL_SKILL_SEARCH` | Skill discovery |
| `CACHED_MICROCOMPACT` | Context compression optimization |
| `TRANSCRIPT_CLASSIFIER` | Auto-mode ML classifier |

### Runtime Feature Flags

GrowthBook provides A/B testing and gradual rollout:
```typescript
getFeatureValue_CACHED_MAY_BE_STALE('tengu_hive_evidence', false)
```

The `_CACHED_MAY_BE_STALE` suffix is another intentional API design choice -- it communicates that this value may not reflect the latest server state.

### Environment Gates

```typescript
if (process.env.USER_TYPE === 'ant') { /* Anthropic-internal features */ }
```

**Transferable insight:** The three-tier feature gating (build-time DCE, runtime GrowthBook, environment gates) serves different purposes. Build-time removes code entirely from the binary. Runtime allows gradual rollout and A/B testing. Environment gates separate internal from external builds. The naming conventions (`DANGEROUS_`, `_CACHED_MAY_BE_STALE`) encode operational semantics into the API surface.

---

## 14. Agent Operating Guides

### The Agent.md Convention

The repository includes an `agent.md` file that defines how automated agents should operate:

```markdown
## Core Rules
- Keep changes small, targeted, and easy to review.
- Preserve existing command behavior unless explicitly asked.
- Favor existing patterns in src/commands/, src/tools/.
- Avoid broad refactors while fixing localized issues.

## Workflow
1. Gather context from relevant files before editing.
2. Implement the smallest viable change.
3. Run focused validation (type checks/tests for changed areas).
4. Summarize what changed and any remaining risks.
```

### Multiple Agent Instruction Sets

The repo provides instructions through multiple channels for different AI tools:

| File | Target |
|------|--------|
| `agent.md` | Repository-level agent operating guide |
| `Skill.md` | Detailed development conventions for Claude Code |
| `.github/agents/agent.agent.md` | Claude Code Engineer persona |
| `.github/copilot-instructions.md` | GitHub Copilot / generic AI agents |

**Transferable insight:** Maintaining multiple agent instruction files for different AI tools is a pragmatic reality. Each AI tool reads its instructions from different locations. The content should be consistent but the format should match each tool's conventions. The `Skill.md` pattern (a comprehensive reference document) is particularly effective -- it gives the agent everything it needs to understand the codebase without requiring multiple file reads.

---

## 15. Output Style & Communication Design

### Two Communication Modes

The system has distinct output guidance for external users vs. Anthropic employees:

**External users:**
> "Go straight to the point. Try the simplest approach first. Be extra concise."
> "Lead with the answer or action, not the reasoning."
> "If you can say it in one sentence, don't use three."

**Internal (Anthropic) users:**
> "Write so they can pick back up cold: use complete, grammatically correct sentences without unexplained jargon."
> "Write user-facing text in flowing prose while eschewing fragments, excessive em dashes, symbols and notation."
> "Avoid semantic backtracking: structure each sentence so a person can read it linearly."

The internal guidance also includes numeric length anchors:
> "Keep text between tool calls to <=25 words. Keep final responses to <=100 words unless the task requires more detail."

**Transferable insight:** Output verbosity should be tuned to the user population. Power users (Anthropic employees eating their own dogfood) benefit from richer, more structured communication. External users want speed and concision. The numeric length anchors are particularly interesting -- research showed ~1.2% output token reduction vs. qualitative "be concise."

### Custom Output Styles

The system supports pluggable output styles:
- Bundled styles in source
- Plugin-provided styles
- User-selectable via settings
- Skills can override output style

The `keepCodingInstructions` flag on output styles determines whether the standard coding task instructions are included or replaced by the style's own instructions.

---

## 16. Verification & False-Claims Mitigation

### The Truthfulness Problem

Claude Code explicitly addresses false-claim risks in its system prompt:

> "Report outcomes faithfully: if tests fail, say so with the relevant output; if you did not run a verification step, say that rather than implying it succeeded."

> "Never claim 'all tests pass' when output shows failures, never suppress or simplify failing checks (tests, lints, type errors) to manufacture a green result."

> "Equally, when a check did pass or a task is complete, state it plainly -- do not hedge confirmed results with unnecessary disclaimers."

**Comment in source:**
```
// @[MODEL LAUNCH]: False-claims mitigation for Capybara v8 (29-30% FC rate vs v4's 16.7%)
```

This tells us: (1) false-claim rates are measured per model version; (2) specific prompt interventions are tied to specific model launches; (3) the interventions are A/B gated for measurement.

### The Verification Agent

For non-trivial implementations:
- Independent adversarial verification is mandatory
- The implementing agent CANNOT self-verify
- Verifier produces verdicts: PASS, FAIL, PARTIAL
- Main agent must spot-check PASS verdicts
- FAIL triggers fix-and-re-verify loop

**Transferable insight:** Measuring false-claim rates per model version and tying prompt mitigations to specific launches is sophisticated prompt engineering. The key insight is that the mitigation itself ("report truthfully") can create over-correction ("hedge everything"). The prompt explicitly addresses both failure modes.

---

## 17. Plugin & Marketplace Architecture

### Plugin Structure

```
my-plugin/
  plugin.json        # Manifest with metadata
  commands/           # Custom slash commands (.md files)
  agents/             # Custom AI agents (.md files)
  hooks/              # Hook configurations
  skills/             # Custom skills
  output-styles/      # Custom output formatters
```

### Plugin Capabilities

Plugins can contribute:
- Slash commands
- Custom agents
- Hooks (pre/post tool use, etc.)
- Skills
- Output styles
- MCP server configurations

### Plugin Trust Model

- Manifest validation
- Marketplace allowlist
- Enterprise can lock to specific marketplaces (`strictKnownMarketplaces`)
- Enterprise can block marketplaces (`blockedMarketplaces`)
- Enterprise can restrict all customization to plugins only (`strictPluginOnlyCustomization`)

### Dependency Automation

Renovate.json manages dependencies:
- Security fixes: auto-merge immediately
- Patch updates: auto-merge on weekends
- Minor updates: grouped, merged Mondays
- Major updates: require manual review
- React/Next.js and Radix UI grouped together

**Transferable insight:** The plugin system is the bridge between openness and control. Individuals can install any plugin. Enterprises can lock down to vetted marketplaces. The `strictPluginOnlyCustomization` flag is the kill switch that channels all extensibility through a single vetted path. This is the right abstraction for organizations that want customization without chaos.

---

## 18. Transferable Principles

### 1. Fail-Closed by Default
Every safety mechanism defaults to denial. Classifier unavailable? Deny. Permission check fails? Ask. Tool not in allowlist? Block. This is the single most important design principle for AI agent safety.

### 2. Layered Defense
Safety is not a single checkpoint. It is bash pattern matching AND permission rules AND protected path immunity AND denial tracking AND sandbox enforcement AND hook-based validation AND ML classification. Any single layer can be bypassed; the stack cannot.

### 3. Self-Describing Tools
Tools carry their own prompt contribution, permission model, concurrency declaration, and UI rendering. This eliminates the coordination problem where the tool registry and the system prompt drift out of sync.

### 4. Prompt Cache as Architecture
The static/dynamic split in the system prompt is not an optimization hack. It is an architectural boundary that constrains where conditionals can live and how features are gated. Treat prompt caching as a first-class design constraint.

### 5. Naming Encodes Intent
`DANGEROUS_uncachedSystemPromptSection()`, `_CACHED_MAY_BE_STALE`, `isDestructive()`, `bypass-immune`. These naming conventions prevent misuse by making cost and risk visible in the API surface.

### 6. Anti-Gold-Plating as Prompt Engineering
The most effective behavioral guardrails are proscriptive: "don't add features you weren't asked for", "don't create abstractions for one-time operations", "three similar lines is better than a premature abstraction." These address the specific failure mode of LLMs over-engineering.

### 7. Configuration Hierarchy with Hard Boundaries
Settings merge in priority order, but some boundaries (protected paths, managed-only hooks) are immune to override. The hierarchy enables customization; the hard boundaries prevent catastrophe.

### 8. Memory Has Semantic Types
Not all memories are equal. "User" memories (who am I talking to) serve different recall triggers than "feedback" memories (how should I work) or "project" memories (what is happening now). Typed memory enables smarter recall.

### 9. Verification Is a Separate Concern
The pattern of an independent adversarial verifier that the implementing agent cannot override is a strong engineering choice. It prevents the "I checked my own work and it's fine" failure mode.

### 10. Agent Instructions Are Living Documents
Agent operating guides (`agent.md`, `Skill.md`, copilot instructions) should be maintained alongside the code. They are part of the interface surface, not documentation.

---

## 19. Anti-Patterns Identified & Avoided

### What Claude Code Explicitly Avoids

1. **Monolithic system prompt** -- Avoided via section-based, cached, assembled prompts
2. **All-or-nothing permissions** -- Avoided via granular tool+pattern rules
3. **In-process plugins** -- Avoided via subprocess hooks with timeouts
4. **Flat memory** -- Avoided via typed, hierarchical memory with semantic recall
5. **Static tool lists** -- Avoided via deferred tool loading and discovery
6. **Unversioned config** -- Avoided via migrations directory
7. **Single-model prompts** -- Avoided via per-model-launch prompt adjustments with A/B gating
8. **Binary safe/unsafe** -- Avoided via a spectrum: allow, ask, deny, bypass-immune

### What the Code Comments Reveal

```
// @[MODEL LAUNCH]: Update the latest frontier model.
// @[MODEL LAUNCH]: capy v8 assertiveness counterweight (PR #24302)
// @[MODEL LAUNCH]: False-claims mitigation for Capybara v8
// @[MODEL LAUNCH]: Remove this section when we launch numbat.
```

These `@[MODEL LAUNCH]` markers reveal a systematic process: each model launch triggers a review of behavioral tuning in the system prompt. Prompt engineering is not a one-time activity -- it is tied to the model release cycle.

---

## 20. Actionable Takeaways

### For Building AI-Powered CLI Tools

1. **Use a tool factory pattern** that enforces permission checks, input validation, and UI rendering as non-optional parts of the tool interface.

2. **Implement the permission pipeline early.** Start with allow/deny/ask rules and protected path immunity. Add ML classification later.

3. **Split your system prompt at a cache boundary.** Static behavioral rules above, dynamic context below. Document why each section lives where it does.

4. **Name your dangerous APIs honestly.** `DANGEROUS_`, `_CACHED_MAY_BE_STALE`, `bypassPermissions` -- these prevent accidental misuse better than documentation.

5. **Maintain per-model-launch prompt tuning.** When you upgrade the underlying model, review and update behavioral guardrails. Gate new interventions behind A/B tests.

### For Building Agent Personas

1. **Define skills as markdown+frontmatter.** The `description + allowed-tools + when_to_use + prompt` format is the minimum viable skill definition.

2. **Skills are not just prompts.** They carry tool restrictions (security boundary), execution context (inline vs fork), and lifecycle hooks.

3. **Auto-discover skills per turn.** Surface relevant skills based on the current task without requiring the user to invoke them by name.

4. **Separate implementing and verifying agents.** The adversarial verifier pattern catches false-claim failures that self-verification misses.

### For Building Trusted AI Workflows

1. **Fail closed at every decision point.** If the classifier is down, deny. If the permission check fails, ask. Never default to allow.

2. **Track denial patterns.** After N denials, fall back to explicit prompting. This prevents the AI from being stuck in a denial loop.

3. **Use hooks for extensibility, not plugins.** Hooks run in subprocesses with timeouts. They cannot crash the host. They can be enterprise-locked.

4. **Make memory typed and scoped.** User preferences, workflow feedback, project context, and external references serve different purposes and have different freshness requirements.

5. **Enterprise lockdown is a first-class feature.** `strictPluginOnlyCustomization`, `allowManagedHooksOnly`, `allowManagedMcpServersOnly` -- these are not afterthoughts.

### For Prompt Engineering Practice

1. **Encode observed failure modes as explicit rules.** "Don't add features you weren't asked for" exists because models actually do this.

2. **Address both over-correction and under-correction.** "Report truthfully" can cause hedging. Add "state confirmed results plainly -- do not hedge."

3. **Use numeric anchors.** "Keep text between tool calls to <=25 words" is more effective than "be concise" (measured: ~1.2% token reduction).

4. **Gate prompt changes behind A/B tests.** Measure false-claim rates, verbosity, task completion, and user satisfaction per variant.

5. **Tie prompt reviews to model launches.** Each new model version may need different behavioral tuning. Use `@[MODEL LAUNCH]` markers to track what needs review.

---

## Appendix: Key File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/constants/prompts.ts` | Main system prompt construction | 912 |
| `src/constants/systemPromptSections.ts` | Cacheable section system | -- |
| `src/constants/cyberRiskInstruction.ts` | Security guardrails | -- |
| `src/Tool.ts` | Tool interface & factory | ~29K |
| `src/tools.ts` | Tool registry & filtering | -- |
| `src/utils/permissions/permissions.ts` | 7-step permission pipeline | -- |
| `src/utils/permissions/denialTracking.ts` | Denial counter logic | -- |
| `src/tools/BashTool/bashSecurity.ts` | Bash command security | 100+ checks |
| `src/services/mcp/config.ts` | MCP configuration | 51K |
| `src/services/mcp/client.ts` | MCP client | 119K |
| `src/memdir/memdir.ts` | Memory system | 150+ |
| `src/skills/bundledSkills.ts` | Skill registry | -- |
| `src/skills/loadSkillsDir.ts` | Skill loader | 500+ |
| `src/utils/settings/types.ts` | Complete settings schema | 1150 |
| `src/utils/hooks.ts` | Hook system | -- |
| `src/QueryEngine.ts` | Core LLM engine | ~46K |
| `agent.md` | Agent operating guide | 35 |
| `Skill.md` | Development conventions | 220 |
| `docs/architecture.md` | Architecture deep-dive | 225 |
| `docs/subsystems.md` | Subsystem documentation | 347 |
| `docs/tools.md` | Tool reference | 170 |
| `docs/exploration-guide.md` | Codebase navigation | 247 |

---

*This document was generated from analysis of the Claude Code CLI source code. It focuses on transferable engineering patterns, not implementation details. The source is a leaked build (2026-03-31) published for educational purposes.*
