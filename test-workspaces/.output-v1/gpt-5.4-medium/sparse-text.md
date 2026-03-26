=== SPARSE ===

I’m treating this as a foundational architecture task. I’ll first load the required startup guidance and the architecture skill, then inspect the workspace for the feature context I need before proposing a data model and trust boundaries.

---

I’ve loaded the architecture stance. Next I’m locating the mandated router/init files and the workspace context so I can anchor the design to the actual feature rather than inventing assumptions.

---

The workspace itself is almost empty so far, which makes “this feature” ambiguous. I’m searching for any spec, README, or prompt file that could define the feature before I decide whether I can ground the model in repo facts or need a clarifying question.

---

## Selected Expert
`expert-architect-descartes`

## Reason
The request is for a `data model` and `trust boundaries`, which routes to foundational architecture.

## Confidence
Low. VERIFIED: the available workspace context does not include a feature spec, user story, schema draft, or API contract for the feature itself. HYPOTHESIS: “this feature” refers to context outside the current repo snapshot.

## Assumptions
- VERIFIED: I cannot safely name entities, ownership rules, or permission boundaries without knowing what the feature does.
- HYPOTHESIS: the feature has at least these architectural dimensions:
  - actors
  - protected resources
  - write paths
  - external integrations
  - tenancy/ownership rules
  - audit or retention requirements
- HYPOTHESIS: if this is a normal product feature, the minimum trustworthy model will need:
  - one primary business object
  - one actor/identity object
  - one authorization relation
  - one audit/event record
  - one idempotency or request-tracking mechanism for writes

## Failure Modes
- If I invent entities now, the design will likely encode false assumptions about ownership, lifecycle, or access control.
- If trust boundaries are guessed, the system can end up authorizing on client claims, crossing tenant boundaries, or persisting unvalidated third-party data.
- If the feature involves external inputs and we do not distinguish `asserted` from `verified` fields, downstream code will over-trust data that was never authenticated.

## Fallbacks
- Best fallback now: define the bedrock information I need to produce a concrete design.
- Send these six items and I can turn them into a real schema and boundary map:
  1. What the feature does in one sentence.
  2. Who can create/read/update/delete it.
  3. The main object or record the feature introduces.
  4. Whether it is single-tenant, workspace-scoped, or org-scoped.
  5. Any external systems, webhooks, uploads, or LLM/tool calls involved.
  6. Any compliance constraints: audit log, PII, retention, soft delete, approval flow.

## Foundation
Until the feature is specified, this is the safest generic foundation to design against.

- Identity boundary:
  - Treat `user_id`, `org_id`, roles, and entitlements as server-derived only.
  - Never trust client-submitted role, tenant, or ownership fields.

- Resource boundary:
  - Every feature record should carry:
    - `id`
    - `org_id` or `workspace_id`
    - `created_by`
    - `created_at`
    - `updated_at`
    - `status`
    - `version`
  - If ownership matters, add explicit `owner_user_id` or `owner_team_id`; do not infer it from UI state.

- Authorization boundary:
  - Authorization checks should be against:
    - authenticated principal
    - server-side membership/role mapping
    - resource scope
    - action type
  - Do not let the client choose the scope it is authorized for.

- Input trust tiers:
  - `trusted`: server-generated fields
  - `verified`: fields validated against a trusted source
  - `asserted`: raw user or third-party input
  - Persist these distinctions in code and schema; do not collapse them into one payload type.

- Write safety:
  - All mutating requests should support:
    - request id / idempotency key
    - optimistic concurrency via `version`
    - append-only audit event for sensitive changes

- Minimal schema shape:
```ts
type FeatureRecord = {
  id: string;
  orgId: string;
  status: "draft" | "active" | "archived";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;

  // business payload
  data: Record<string, unknown>;

  // provenance
  source: "user" | "system" | "integration";
  trustLevel: "asserted" | "verified" | "trusted";
};

type FeatureAccessGrant = {
  resourceId: string;
  principalType: "user" | "team" | "service";
  principalId: string;
  permission: "read" | "write" | "admin";
};

type FeatureAuditEvent = {
  id: string;
  resourceId: string;
  actorId: string;
  action: string;
  occurredAt: string;
  beforeVersion?: number;
  afterVersion?: number;
  requestId: string;
};
```

## Verification Flags
- Need the feature definition before I can verify:
  - core entities
  - lifecycle states
  - tenant boundary
  - caller types
  - external trust boundary crossings
  - exact authorization matrix
- Once you provide the feature summary, I can produce:
  - a concrete entity model
  - table/schema definitions
  - a trust-boundary diagram in prose
  - invariants for auth, tenancy, and auditability

Paste the feature description or spec, and I’ll turn this into the actual data model and trust boundaries instead of a safe generic foundation.
