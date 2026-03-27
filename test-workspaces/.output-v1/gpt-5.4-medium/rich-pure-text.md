=== RICH-PURE ===

Interpreting this as a foundational architecture request. I’m loading the startup guidance and architecture skill first, then I’ll inspect the workspace for the feature context so I can define the data model and trust boundaries against the actual code.

---

I’ve loaded the architecture stance, but the feature itself is still unspecified from the workspace surface. I’m checking the project structure and the required GPT rule files next so I can tell whether there’s local feature context to anchor the design, otherwise I’ll stop and ask for the missing scope.

---

The workspace is effectively just the rule set right now, so I’m not seeing any local feature spec, code, or schemas to anchor the design. I’m doing one broader pass for docs and then, if that still comes up empty, I’ll ask for the missing feature description rather than inventing contracts in a vacuum.

---

## Selected Expert
`expert-architect-descartes`

## Reason
This is a foundational architecture request about `data model` and `trust boundaries`, which routes to bedrock design rather than implementation.

## Confidence
VERIFIED that the current workspace does not contain a feature spec, code, schema, or API surface for me to anchor the design to. ~95% confidence the missing input is the feature definition itself.

## Assumptions
HYPOTHESIS: “this feature” refers to a feature described outside the current workspace context.
VERIFIED: the workspace currently contains only local rule files under `.cursor/rules/`.
HYPOTHESIS: you want a concrete model tied to your actual actors, inputs, storage, and integration points, not a generic template.

## Failure Modes
If I design now without the feature description, I will likely invent the wrong actors, the wrong source of truth, and the wrong trust boundaries.
That would produce a misleading schema, incorrect ownership boundaries, and possibly unsafe assumptions about authentication, authorization, or external systems.

## Fallbacks
Provide the minimum feature brief below and I can turn around a concrete design quickly:

- User goal: what the feature does
- Actors: end user, admin, background job, external system, LLM, webhook, etc.
- Inputs: form/API/file/event
- Outputs: UI state, DB writes, notifications, side effects
- Persistence: existing tables/collections or new storage
- External dependencies: third-party APIs, auth provider, queue, object store
- Constraints: privacy, multi-tenant, audit, latency, retention

## Foundation
Once you share the feature, I’ll produce:

- Core entities and relations
- Canonical IDs and ownership rules
- Write paths vs read models
- Trust zones: client, app server, worker, database, third-party, admin surface
- Validation boundaries: what is untrusted, revalidated, signed, or derived
- Authn/authz model and tenant isolation
- Failure-mode fallbacks for each boundary

## Verification Flags
Paste the feature description, or point me to the relevant spec/file, and I’ll respond with the actual data model and trust-boundary design in one pass. If helpful, use this fill-in format:

```text
Feature:
Primary actor:
Other actors/systems:
User inputs:
System side effects:
Data to store:
Who can read/update/delete:
External services:
Security/privacy constraints:
```
