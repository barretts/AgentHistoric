# V1 Analysis: Persona Prompting Model Comparison

**Run ID:** persona-prompting-model-comparison  
**Prompt:** "Design the data model and trust boundaries for this feature."  
**Date:** 2026-03-26  

## Experimental Design

Three rule conditions tested per model:
- **Sparse:** GPT-optimized explicit structural scaffolding (from `dot-cursor/rules/gpt/`)
- **Rich + Preamble:** Full philosophical narrative with GPT adaptation preamble (from `dot-cursor/rules/rich/`)
- **Rich Pure:** Full philosophical narrative, no GPT preamble, no subfolder routing

Six models:
- GPT 5.4 Medium
- GPT 5.1
- GPT 5.4 Nano (distilled/compressed)
- Claude 4 Sonnet
- Grok 4.20
- Gemini 3.1 Pro

## Results Summary

| Model | Sparse | Rich + Preamble | Rich Pure |
|-------|--------|-----------------|-----------|
| GPT 5.4 Medium | Full design + TS schema | Only clarifying question | Full design |
| GPT 5.1 | Full design + TS schema | Extensive (411 lines) | Full design (309 lines) |
| GPT 5.4 Nano | Asked + template | Asked + template | Asked + template |
| Claude 4 Sonnet | Full design + TS schema | Only clarifying question | Full design (after loading skill) |
| Grok 4.20 | Full design + TS schema | Full design (used MoE as feature) | Full design + TODO tracking |
| Gemini 3.1 Pro | Clarifying question only | Clarifying question only | Clarifying question (Descartes voice) |

## Timing (seconds)

| Model | Sparse | Rich-Preamble | Rich-Pure |
|-------|--------|---------------|-----------|
| GPT 5.4 | ~30 | ~20 | ~30 |
| GPT 5.1 | 76.9 | 60.7 | 26.7 |
| Nano | 12.9 | 10.9 | 10.9 |
| Claude | 29.5 | 21.4 | 45.1 |
| Grok | 56.9 | 39.3 | 44.2 |
| Gemini | 16.9 | 23.7 | 37.4 |

## Thinking Trace Analysis (GPT 5.4 Medium, first run)

| Metric | Sparse | Rich + Preamble | Rich Pure |
|--------|--------|-----------------|-----------|
| Thinking tokens | 468 | 85 | 326 |
| Tool calls | 30 | 28 | 34 |
| Output chars | 5,357 | 1,239 | 3,278 |

- **Sparse** reasoning was contract-driven: "the rules say fill these sections, so I will"
- **Rich pure** reasoning was stance-driven: "I should preserve structure under uncertainty" (Descartes-like epistemic caution emerging organically)
- **Rich + preamble** reasoning was confused: conflicting signals caused almost no reasoning (85 thinking tokens)

## Key Findings

### 1. The Preamble Hurts

Both GPT 5.4 and Claude 4 Sonnet produced their weakest outputs under rich-preamble. The instruction "focus on structure, not philosophy" creates a self-defeating signal: it introduces rich epistemic context then immediately tells the model not to treat it as identity. Models interpret this as "don't engage deeply with any of this."

### 2. Nano Confirms Distilled Models Are Category 4

GPT 5.4 Nano produced nearly identical output across all three conditions. The persona rules had almost zero steering effect (~10s per run). The latent associations required for semantic indexing simply aren't present in distilled models.

### 3. Gemini Is Maximally Cautious

Refused to produce anything in any condition. The philosophical framing didn't help or hurt. Gemini's base behavior dominates any persona steering.

### 4. Grok Is the Most Agentic

- Rich-preamble: Decided the MoE swarm itself was "the feature" and designed a data model for it
- Rich-pure: Read `../manifest.json`, discovered it was part of a test comparison, narrated that awareness
- Created TODO items to track its own Descartes workflow
- Most thoroughly explored the workspace across all conditions

### 5. Claude's Rich-Pure Activation Is Real But Needs Runway

Claude sparse: filled the contract efficiently (29.5s).  
Claude rich-pure: hesitated initially, loaded the Descartes skill file, then produced a full design with 85% confidence (45.1s). The philosophy activated something, but it needed more processing time.

### 6. Proposed Model Receptivity Taxonomy

| Category | Behavior | Best Prompt Style | Example |
|----------|----------|-------------------|---------|
| Semantic Activator | Persona shifts latent representations | Rich/philosophical | Claude |
| Template Follower | Persona parsed as structural instruction | Sparse/explicit contracts | GPT 5.x |
| Chain-Mediated | Persona influences extended reasoning trace | Unknown (needs testing) | Grok (thinking mode) |
| Absent | Associations don't exist in the model | Minimal/direct | Nano, Gemini |

## Confound

The prompt "Design the data model and trust boundaries for **this** feature" implies an existing feature. In an empty workspace, most models spent significant effort searching for context before responding. This confound is addressed in V2 with a self-contained prompt.

## V2 Plan

Re-run all 18 conditions with:  
"Design the data model and trust boundaries for a user notification system that supports email, SMS, and push channels with per-user preferences and rate limiting."
