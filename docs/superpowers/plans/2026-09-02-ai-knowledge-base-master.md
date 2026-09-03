# General AI Knowledge Base Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coordinate five independently testable vertical plans into a secure, multi-user, personal-and-team AI knowledge base MVP that is ready for controlled production release.

**Architecture:** A pnpm monorepo contains a Next.js authenticated workspace, an independent long-running document worker, shared domain contracts, and provider-neutral AI adapters. Supabase supplies Auth, Postgres with RLS, Private Storage, Realtime, Queues, and pgvector; every read, derived artifact, graph edge, citation, cache key, and job remains inside one explicit workspace boundary.

**Tech Stack:** Node.js 24 LTS, pnpm workspaces, Next.js 16.3.4 App Router, React 19.2.8, TypeScript strict mode, Tailwind CSS 4, Supabase JS 2.112.4, isolated `@supabase/ssr`, Postgres/RLS/Private Storage/Realtime/Queues/pgvector, OpenAI behind adapters, Zod, Vitest 4.1.11, Testing Library, Playwright, pgTAP, `@remixicon/react` 4.9.0, `@xyflow/react`, OpenTelemetry, Pino, Lighthouse CI, k6, Docker, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-general-ai-knowledge-base-design.md`

## Global Constraints

- The product is a cross-industry, multi-user cloud service with one automatic private personal workspace per user and any number of team workspaces.
- Team roles are Owner, Admin, Editor, and Viewer. The database, Storage, and server enforce permissions; hidden controls are never the authorization boundary.
- A team always has exactly one Owner. Admin manages Editor/Viewer only; Owner alone manages Admin, transfers ownership, and deletes the team.
- Personal and team content never cross in search, embeddings, graph relations, AI prompts, caches, jobs, citations, or exports.
- Uploads accept JPG, PNG, WebP, PDF, DOCX, Markdown, and TXT; a batch has at most 20 files and each file is at most 50 MB.
- The browser uploads only to the random object path issued by a server-created upload session. Private objects have no permanent public URL.
- Only the current `READY` document revision participates in new search, graph, or chat. A failed replacement leaves the previous successful revision serving.
- Every workspace-scoped database relationship uses a composite key containing `workspace_id`; the database rejects cross-workspace and cross-revision references.
- Worker queue messages contain only `job_id` or `purge_id`. Restricted database functions derive all workspace/document/revision/object targets and reject caller-supplied ownership.
- AI output is structured, evidence-backed, traceable, editable, and subordinate to human revisions. Provider/model identifiers are runtime configuration, not business-logic constants.
- Private chat remains private from teammates and administrators. Publishing creates a separate team Q&A asset only after explicit review and citation validation.
- Original uploaded files are immutable. Shared summaries, notes, tags, relations, and comments are versioned derived knowledge with optimistic concurrency.
- The visual language is an original Notion-inspired document workspace using warm neutral tokens, approved original hand-drawn line art only in genuine empty states, and official Remix Icon components for all functional icons.
- Desktop, tablet, and mobile experiences are accepted at widths 360, 768, 1024, and 1440 px. MVP is light-mode only.
- Document trash and workspace deletion have 30-day restore windows; permanent active-copy purge completes within 24 hours. Vendor and backup retention are disclosed accurately.
- Logs and audit records never contain file/chunk/chat bodies, complete prompts, complete model output, secrets, cookies, or authorization headers.
- Each child plan ends in a green vertical-slice gate. Plan 05's signed release decision is the only condition that marks the whole MVP releasable.

---

## Plan Set and Execution Order

1. [Plan 01 — Foundation](2026-09-02-ai-knowledge-base-01-foundation.md)  
   Repository/tooling, design tokens and workspace shell, authentication, personal/team workspaces, invitation/member lifecycle, RBAC/RLS, private Storage, and fixed-path upload sessions.

2. [Plan 02 — Ingestion and Search](2026-09-02-ai-knowledge-base-02-ingestion-search.md)  
   Immutable document revisions, durable state machine, restricted worker, format validation/extraction/OCR, chunks and source locators, atomic current revision, hybrid search, retries, duplicate delivery, and orphan cleanup.

3. [Plan 03 — AI Analysis and Knowledge Graph](2026-09-02-ai-knowledge-base-03-ai-graph.md)  
   Provider-neutral structured analysis, prompt-injection boundary, derived artifacts/evidence, review and human precedence, revision remapping, entity merge, graph API/canvas/mobile list, and AI evaluation set.

4. [Plan 04 — Chat and Collaboration](2026-09-02-ai-knowledge-base-04-chat-collaboration.md)  
   Private grounded streaming chat, citation authorization, explicit team Q&A publishing, versioned summaries/notes, 24-hour local drafts, conflict resolution, comments, and RLS-protected Realtime.

5. [Plan 05 — Hardening and Release](2026-09-02-ai-knowledge-base-05-hardening-release.md)  
   Trash/deletion/retention, bounded purge, audit, file delivery, observability, limits, alerts, adversarial security, accessibility, performance, backup/restore, immutable builds, and release gates.

Execution is strictly ordered by plan because every later plan consumes contracts and migrations from earlier plans. Tasks inside a plan may be delegated only when their file lists do not overlap and their listed `Consumes` interfaces already exist on the integration branch.

## Repository Structure and Ownership

```text
.
├── apps/
│   ├── web/                    # Next.js UI, authenticated routes, SSE chat, upload coordination
│   └── worker/                 # Long-running queue consumer, extract/AI/index/purge stages
├── packages/
│   ├── domain/                 # Zod schemas, stable data types, policy/state-machine contracts
│   ├── ai/                     # Replaceable analysis, embedding, OCR, and grounded-chat adapters
│   ├── observability/          # Redacted logs, traces, metrics, correlation context
│   └── test-fixtures/          # Synthetic files/users/teams; no production-derived content
├── supabase/
│   ├── migrations/             # Ordered schema, RLS, Storage, queue, and restricted RPC definitions
│   ├── tests/                  # pgTAP permission and lifecycle matrix
│   └── seed.sql                # Deterministic local development identities and workspace data
├── tests/
│   ├── e2e/                    # Vertical journey gates
│   ├── ai-evals/               # Versioned annotated quality corpus and scorer
│   ├── security/               # Cross-tenant, prompt, cache, deletion, and secret tests
│   ├── accessibility/          # Axe, keyboard, screen-reader checklist, responsive widths
│   └── performance/            # Browser and service budgets against stated scale
├── scripts/                    # Backup, restore drill, release evidence, safe maintenance commands
├── ops/
│   ├── alerts/                 # Exact deployable alert expressions
│   └── runbooks/               # Incident, recovery, deletion, key rotation, deploy, rollback
└── docs/superpowers/           # Approved specification, plans, and approved visual assets
```

No child plan may create a second implementation of authentication, authorization, source locators, hybrid search, AI provider selection, audit writing, or lifecycle transitions. Stable contracts live in their owning package and are imported by consumers.

## Migration Ownership

| Migration                              | Owning plan | Schema responsibility                                                                |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `0001_extensions.sql`                  | 01          | Required extensions and fixed helper primitives                                      |
| `0002_identity_workspaces.sql`         | 01          | Profiles, workspaces, memberships, invitations, base audit events, Owner invariant   |
| `0003_workspace_access.sql`            | 01          | Capability helpers, table RLS, invitation/member RPCs                                |
| `0004_private_upload_sessions.sql`     | 01          | Private buckets/policies, documents, revisions, upload sessions                      |
| `0005_document_processing.sql`         | 02          | Processing state machine, job attempts, restricted worker functions, queues          |
| `0006_chunks_hybrid_search.sql`        | 02          | Extracted chunks, locators, full-text/trigram/vector indexes, RRF RPC                |
| `0007_ai_knowledge_graph.sql`          | 03          | Analysis runs, artifacts/evidence, summaries/classification/entities/relations       |
| `0008_conversations_collaboration.sql` | 04          | Private chat, citations, Q&A, notes/revisions/comments, collaboration RPCs           |
| `0009_deletion_audit_limits.sql`       | 05          | Trash/purge/retention, audit immutability/retention, usage, quotas, maintenance RPCs |

Every migration is forward-only, reproducible from an empty database, safe under a transaction where Postgres permits it, and paired with pgTAP tests. Any later plan that needs an earlier table uses `ALTER TABLE` only in its assigned migration and documents the compatibility reason.

## Cross-Plan Contract Ledger

These names are the integration boundary. During child-plan review, reconcile any draft spelling to this ledger before implementation begins.

```ts
// packages/domain/src/workspaces.ts — Plan 01
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@knowledge/domain';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type WorkspaceKind = 'personal' | 'team';
export type Capability =
  | 'documents.read'
  | 'documents.upload'
  | 'documents.trash'
  | 'documents.delete'
  | 'jobs.reprocess'
  | 'knowledge.write'
  | 'comments.write'
  | 'qa.publish'
  | 'members.manage_basic'
  | 'members.manage_admin'
  | 'workspace.delete';
export type WorkspaceContext = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  kind: WorkspaceKind;
};
export function requireWorkspaceCapability(
  client: SupabaseClient<Database>,
  workspaceId: string,
  capability: Capability
): Promise<WorkspaceContext>;
```

```ts
// packages/domain/src/uploads.ts — Plan 01
export type UploadSession = {
  id: string;
  workspaceId: string;
  documentId: string;
  revisionId: string;
  objectPath: string;
  uploadToken: string;
  expiresAt: string;
};
// packages/domain/src/documents.ts — Plan 02
export type SourceLocator = {
  page?: number;
  paragraph?: number;
  charStart?: number;
  charEnd?: number;
  imageRegion?: { x: number; y: number; width: number; height: number };
};
export type ProcessingStage = 'VALIDATING' | 'EXTRACTING' | 'CHUNKING' | 'ANALYZING' | 'INDEXING';
```

```ts
// packages/domain/src/search.ts and apps/web/src/features/search/search-workspace.ts — Plan 02
export type WorkspaceSearchRequest = {
  workspaceId: string;
  query: string;
  limit: number;
  filters: {
    documentIds?: string[];
    mimeTypes?: string[];
    uploadedBy?: string[];
    updatedAfter?: string;
  };
};
export type WorkspaceSearchResult = {
  chunkId: string;
  documentId: string;
  revisionId: string;
  title: string;
  snippet: string;
  locator: SourceLocator;
  score: number;
  matchedBy: Array<'lexical' | 'trigram' | 'semantic'>;
};
export function searchWorkspace(input: {
  client: SupabaseClient<Database>;
  request: WorkspaceSearchRequest;
  requireCapability?: typeof requireWorkspaceCapability;
  embeddingProvider: EmbeddingProvider;
  requestId: string;
}): Promise<WorkspaceSearchResult[]>;
```

```ts
// packages/ai/src/contracts.ts — Plan 03
export interface KnowledgeAiProvider {
  readonly providerName: string;
  readonly modelId: string;
  analyze(input: AnalyzeKnowledgeInput, signal?: AbortSignal): Promise<KnowledgeAnalysis>;
}
export type KnowledgeGraphInput = {
  workspaceId: string;
  documentIds?: string[];
  statuses?: Array<'suggested' | 'accepted' | 'rejected' | 'needs_reconfirmation'>;
  limit?: number;
};
export function getKnowledgeGraph(
  client: SupabaseClient<Database>,
  input: KnowledgeGraphInput
): Promise<KnowledgeGraphResult>;
```

```ts
// packages/ai/src/chat-provider.ts and packages/domain/src/chat.ts — Plan 04
export interface GroundedChatProvider {
  stream(input: GroundedChatInput, signal: AbortSignal): AsyncIterable<ProviderChatEvent>;
}
export function streamGroundedAnswer(input: {
  request: ChatRequest;
  signal: AbortSignal;
}): AsyncIterable<ChatStreamEvent>;
```

```ts
// packages/domain/src/lifecycle.ts — Plan 05
export type DocumentLifecycle = 'active' | 'trashed' | 'deletion_requested' | 'purging' | 'purged';
export type WorkspaceLifecycle = 'ACTIVE' | 'DELETION_SCHEDULED' | 'PURGING' | 'PURGED';
export class PurgeConsumer {
  runOnce(signal: AbortSignal): Promise<PurgeRunResult>;
}
```

Database functions are the final tenant boundary. TypeScript services never treat a client-supplied `workspaceId`, object path, revision, chunk, citation, job, or purge target as authoritative.

## Root Command Contract

Plan 01 creates these root commands; later plans extend their included work without renaming them:

| Command                                      | Required result                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm lint`                                  | ESLint and static policy checks pass across all workspaces                 |
| `pnpm typecheck`                             | Every package compiles under strict TypeScript without emit                |
| `pnpm test`                                  | All Vitest unit/component/contract tests pass                              |
| `pnpm test:db`                               | All pgTAP tests pass against the started local Supabase stack              |
| `pnpm build`                                 | Production Web and Worker builds complete with no secret in browser output |
| `pnpm test:e2e`                              | All five vertical journeys pass against an isolated local test stack       |
| `pnpm test:security`                         | Cross-tenant, injection, cache, delete, URL, and secret gates pass         |
| `pnpm test:a11y`                             | Four-width axe and keyboard gates pass                                     |
| `pnpm test:ai-evals`                         | Versioned AI quality corpus meets all four thresholds                      |
| `pnpm test:recovery`                         | Backup manifest and coordinated restore validation pass                    |
| `pnpm release:gate -- --revision <full-sha>` | Current evidence is complete and returns `approved`                        |

The lockfile is committed. CI uses `pnpm install --frozen-lockfile`, Node 24, an empty disposable Supabase database, synthetic fixtures, and deployment-configured AI model identifiers. `@supabase/ssr` remains behind `apps/web/src/lib/supabase/*` because its public API can change independently of the rest of the application.

## Vertical Checkpoints

### Checkpoint 1: Identity and Security Foundation

- [ ] Complete every checkbox in Plan 01 and review each task commit.
- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:e2e:foundation`.
- [ ] Verify new-user personal workspace, team invite acceptance, four-role denial matrix, Owner invariant, private bucket policies, and fixed-path upload session.
- [ ] Tag the accepted commit `mvp-slice-01-foundation`.

Expected: all checks pass and an authenticated user can safely reach a personal/team workspace and upload one private object, without processing it.

### Checkpoint 2: Ingestion and Search

- [ ] Complete every checkbox in Plan 02 against the accepted Slice 01 commit.
- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:e2e:ingestion-search`.
- [ ] Verify all seven formats, magic-byte mismatch, password/encrypted rejection, duplicate delivery, retry exhaustion, stale heartbeat, previous-ready-version continuity, CJK/Latin/vector retrieval, and workspace-first ranking.
- [ ] Tag the accepted commit `mvp-slice-02-ingestion-search`.

Expected: an authorized upload reaches `READY`, keeps clickable source locators, and appears only in the uploader's current workspace search.

### Checkpoint 3: AI Knowledge and Graph

- [ ] Complete every checkbox in Plan 03 against the accepted Slice 02 commit.
- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:ai-evals && pnpm test:e2e:ai-graph`.
- [ ] Verify every artifact has evidence, rejected suggestions disappear from defaults, human changes survive reprocessing, unmapped evidence needs reconfirmation, entity merge remains intra-workspace, and mobile graph list is equivalent.
- [ ] Tag the accepted commit `mvp-slice-03-ai-graph`.

Expected: processed sources become reviewable summaries/classifications/entities/relations and an evidence-navigable graph, with measured quality above the release floors.

### Checkpoint 4: Private Chat and Collaboration

- [ ] Complete every checkbox in Plan 04 against the accepted Slice 03 commit.
- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:e2e:chat-collaboration`.
- [ ] Verify evidence refusal, citation allow-list, mid-stream revocation, Admin/private-chat denial, explicit Q&A copy, source invalidation, two-second autosave, 24-hour draft retention, optimistic conflict, comments, and Realtime unsubscribe.
- [ ] Tag the accepted commit `mvp-slice-04-chat-collaboration`.

Expected: every role can privately ask grounded questions, permitted roles can explicitly publish verified team Q&A, and shared derived knowledge collaborates without silent overwrite.

### Checkpoint 5: Release Hardening

- [ ] Complete every checkbox in Plan 05 against the accepted Slice 04 commit.
- [ ] Run the complete clean-checkout command sequence in Plan 05 Task 8.
- [ ] Inspect the signed evidence bundle for security, AI quality, accessibility, performance, deletion, observability, backup, and recovery.
- [ ] Confirm the privacy disclosure names the selected AI/OCR/embedding suppliers, sent data categories, processing region, training use, monitoring retention, deletion control, and backup expiry.
- [ ] Tag the immutable approved commit `mvp-release-candidate-1` only after `release:gate` returns `approved`.

Expected: no P0/P1 defect exists, all numeric thresholds pass, active deletion is verified, the latest restore drill meets RPO/RTO, and immutable Web/Worker artifacts are ready for controlled production rollout.

## Specification Coverage Matrix

| Specification area                                                 | Primary plan | Required proof                                                         |
| ------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------- |
| Product scope, default landing, navigation, visual system          | 01           | Responsive authenticated workspace E2E and visual/a11y component tests |
| Auth, personal/team space, invitations, roles, Owner rule          | 01           | pgTAP four-role/two-team matrix plus invite E2E                        |
| Private Storage, explicit upload target, batch/size/type limits    | 01–02        | Storage policy tests plus upload/validation E2E                        |
| State machine, retries, restricted worker, atomic current revision | 02           | Worker contract/replay tests and failure-continuity E2E                |
| Format extraction, OCR, source locations, hybrid search            | 02           | Seven-format corpus, locator navigation, Latin/CJK/vector/RRF tests    |
| AI artifacts, evidence, human precedence, version remapping        | 03           | Schema/RLS/worker tests and fixed AI evaluation corpus                 |
| Entity merge, relation review, full/filtered graph, mobile list    | 03           | Graph API isolation tests and 300-node responsive E2E                  |
| Private grounded chat and citations                                | 04           | Empty-evidence refusal, citation allow-list, privacy/revocation E2E    |
| Team Q&A publish/edit/withdraw/source invalidation                 | 04           | Transaction/RLS tests proving no private-message exposure              |
| Shared summaries, notes, comments, conflict, drafts, Realtime      | 04           | Concurrency, retention, permission, and unsubscribe tests              |
| Trash, permanent deletion, workspace lifecycle, member retention   | 05           | Immediate-cutoff matrix, replayable purge, 30-day lifecycle tests      |
| Audit, downloads/previews, signed URL, logs, quotas, alerts        | 05           | Mutation denial, stream-outcome audit, redaction, threshold tests      |
| Security, accessibility, performance, backup/restore, release      | 05           | Signed release evidence bound to an immutable full revision            |

## Change-Control Rules

- A contract change updates this ledger and every consuming plan before its implementation commit is accepted.
- A schema change belongs to exactly one numbered migration; never edit a migration already applied outside local development. Add the next migration during execution if a reviewed correction is required.
- A new browser dependency must justify why native Web/React/approved packages cannot meet the requirement, must be pinned in the lockfile, and must pass license and bundle review.
- A new AI provider or model changes only adapter/configuration and evaluation evidence; it cannot change tenant, evidence, citation, or persistence rules.
- A scope addition from Section 3.2 or Section 20 of the specification requires a new approved specification and implementation plan, not an opportunistic task in these five plans.
- Test fixtures are synthetic and must never be copied from user or production content.

## Implementation Deviations from the Written Pins

Recorded during Plan 01 execution; every later plan follows this table, not the
original pins.

| Written in the plans                                                         | Actually used                                                                               | Reason                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.2.11                                                              | **16.3.4**                                                                                  | `16.2.11` was never verified against the registry; `16.3.4` is the current `latest` and still provides the Next 16 `proxy.ts` entry Plan 01 Task 4 depends on.                                                                                                                                                                                                                                                          |
| zod 4.5.4                                                                    | **3.25.76**                                                                                 | zod 4.5.4 is not published; the newest published line is 4.1.x. 3.25.x already ships the v4 core under `zod/v4`, and the Task 1 contracts pass on it. Revisit only if a later task needs a v4-only API.                                                                                                                                                                                                                 |
| pnpm 10.15.1                                                                 | **9.x**                                                                                     | No plan step depends on pnpm 10/11 semantics; the committed lockfile installs clean and green on 9.                                                                                                                                                                                                                                                                                                                     |
| `vitest.workspace.ts` with `defineWorkspace`                                 | **`vitest.config.ts` with `test.projects`**                                                 | Vitest 4 removed the workspace file and `defineWorkspace`. `test.projects` is the supported equivalent and aggregates the same package configs.                                                                                                                                                                                                                                                                         |
| `tsconfig.base.json` as the only base                                        | **`tsconfig.base.json`, extended by root `tsconfig.json`**                                  | The base carries exactly the strictness the plans specify; the root adds path aliases and emit flags so package tsconfigs keep extending one file.                                                                                                                                                                                                                                                                      |
| pnpm root package named `knowledge-workspace`                                | **`ai-knowledge-base`**                                                                     | Cosmetic; the workspace protocol and `@knowledge/*` package names, which the plans actually reference, are unchanged.                                                                                                                                                                                                                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                              | **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`**                                                  | Plan 01 Task 4 reads the publishable key, which is what `supabase status` now reports. Plan 02's `SUPABASE_ANON_KEY` snippet must be reconciled to this name before that plan runs.                                                                                                                                                                                                                                     |
| `requireWorkspaceCapability` in `packages/domain/src/workspaces.ts` (ledger) | **`apps/web/src/lib/workspaces/access.ts`**                                                 | Plan 01's file map, task steps, and test path all place it in the web app, and it needs a Supabase client, which `packages/domain` deliberately has no runtime dependency on. It remains the single implementation; no other plan may add a second one.                                                                                                                                                                 |
| `next.config.ts` with no `env` block                                         | **`env` block declaring the two public Supabase vars and `APP_URL`**                        | The workspace keeps one `.env.local` at the repository root, and Next's proxy runtime does not inherit `process.env` writes made while evaluating the config. Without the declaration every request 500s inside the proxy. Only non-secret configuration is listed.                                                                                                                                                     |
| Plan 01 Task 4's inline login page markup                                    | **The approved login page spec** (`docs/superpowers/specs/2026-09-02-login-page-design.md`) | Task 4's snippet is a bare unstyled form that contradicts an already approved design spec: wrong copy, no brand mark, no two-column layout, no knowledge scene, no motion system, and only two of the five form states. The spec is the authority for this page; the task snippet is scaffolding.                                                                                                                       |
| `next.config.ts` without `allowedDevOrigins`                                 | **`allowedDevOrigins: ['127.0.0.1']`**                                                      | `APP_URL` and `supabase/config.toml` both use `127.0.0.1`, which Next 16 dev treats as a foreign origin: it refuses to serve dev resources, the client never hydrates, and every interactive form state silently degrades to a full page POST. Development only.                                                                                                                                                        |
| Custom CSS written unlayered in `globals.css`                                | **Wrapped in `@layer base` / `@layer components`**                                          | Tailwind v4 puts its utilities in `@layer utilities`, and unlayered CSS beats every layered rule regardless of specificity. Unlayered `.icon-button { display: inline-grid }` silently overrode `md:hidden`, and would have overridden every future display, spacing or colour utility on those elements.                                                                                                               |
| The callback route redirecting with `new URL(next, request.url)`             | **A relative `Location` header**                                                            | Both `request.url` and `request.nextUrl` report the server's own origin, which in dev is `localhost` even for a request to `127.0.0.1`. The absolute redirect moved the browser to a host that could not see the session cookie just written, so sign-in silently bounced back to the login page. A relative Location also avoids rebuilding an absolute URL from a client-supplied Host header.                        |
| `listAccessibleWorkspaces` selecting memberships without a user filter       | **Filtered by the current user id**                                                         | RLS lets a member read every membership row in a workspace they belong to, teammates' rows included, so a five person team would list the same workspace five times in the switcher.                                                                                                                                                                                                                                    |
| `<a href="../library">` on the graph empty state                             | **`/w/<workspaceId>/library` built from route params**                                      | From `/w/<id>/graph` a `../library` href resolves to `/w/library`, which is not a route.                                                                                                                                                                                                                                                                                                                                |
| `createInvitationMailer` always constructing a Resend client                 | **Resend when `RESEND_API_KEY` is set, otherwise the local mail catcher over SMTP**         | Local development has no Resend key, so every invitation would fail delivery and immediately revoke itself, making the whole feature unverifiable. Logging the accept URL instead was rejected: the token is a one-time credential and logs must not carry credentials. `supabase/config.toml` now publishes the mail catcher's SMTP port. The `InvitationMailer` interface is unchanged, so the vendor boundary holds. |
| Role names rendered as raw enum values in the member UI                      | **Chinese labels from `role-labels.ts`, with explicit `value` on each option**              | The interface is Chinese throughout; `admin` / `editor` / `viewer` were the only English strings on screen. The option `value` is now set explicitly, because relabelling without it would have submitted the Chinese text as the role.                                                                                                                                                                                 |
| `getMemberSettings` fetching invitations that nothing rendered               | **Pending invitations listed, with a revoke control**                                       | The page is called 成员与邀请 and the query already returned them. A `revokeInvitationAction` was added to make the list actionable.                                                                                                                                                                                                                                                                                    |
| Ownership transfer as a plain button                                         | **Confirmed before it runs**                                                                | Transfer is one way: it demotes the acting owner to admin and cannot be undone without the new owner's cooperation.                                                                                                                                                                                                                                                                                                     |

### Corrections applied to the written SQL

Plan 01 Tasks 2-3 shipped SQL that does not run as written. These four
corrections are in the migrations and tests on the integration branch; later
plans must not reintroduce the original spellings.

| Defect                                                                                                                                                                                             | Where                                                                                                                              | Correction                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `case when ... then 'members.manage_admin' else 'members.manage_basic' end` resolves to `text`, so it never matches the `app_capability` overload                                                  | `0003`: the `invitations_read_manager` policy plus `create_invitation`, `revoke_invitation`, `change_member_role`, `remove_member` | Cast both branches to `public.app_capability`. Only the policy failed at migration time; the four RPCs would have failed at first call.                                                                                  |
| `revoke all on all functions in schema private` strips `execute` from `authenticated`, but three RLS policies call `private.*` helpers directly, and a policy expression runs as the querying role | `0003` final section                                                                                                               | Grant `execute` on `private.is_workspace_member` and `private.shares_workspace` to `authenticated`. `usage` on schema `private` stays revoked, so PostgREST still cannot reach them by name.                             |
| `max(user_id)` on a `uuid` column - Postgres has no `max(uuid)` aggregate, so the single-Owner guard raised `42883` on every commit that touched workspaces or memberships                         | `0002`: `private.assert_single_workspace_owner`                                                                                    | Use `(array_agg(user_id) filter (where role = 'owner'))[1]`.                                                                                                                                                             |
| `extensions.not_ok(...)` is not a pgTAP function                                                                                                                                                   | `supabase/tests/0003_workspace_access.test.sql`                                                                                    | Use `extensions.ok(not ...)`, which asserts the same thing.                                                                                                                                                              |
| The `workspace.created` audit assertion counts audit events across the whole database                                                                                                              | `supabase/tests/0002_identity_workspaces.test.sql`                                                                                 | Scope the count to the fixture's own workspace. The global count only holds on a pristine database and starts failing the moment anyone signs in locally, because `handle_new_user` writes a real, persistent audit row. |

The third defect survived because both owner guards are `deferrable initially
deferred` and the written tests end in `rollback`, so the triggers never fired.
`supabase/tests/0002_identity_workspaces.test.sql` now carries two extra
assertions that force them with `set constraints all immediate`; keep that
technique for every deferred constraint added later.

## Master Completion Gate

- [ ] All five child plan completion gates are checked against their actual commits.
- [ ] The migration chain builds an empty environment and upgrades the latest staging snapshot without data loss.
- [ ] Cross-plan contract names and types match this ledger with no duplicate authorization, locator, search, or lifecycle implementation.
- [ ] Every row/object/queue operation can be traced to an authenticated user or audited system initiator without logging content.
- [ ] The release evidence maps every Section 18 requirement to a current automated or named manual result.
- [ ] A signed `approved` decision references the same full git revision as the Web image, Worker image, database migration set, SBOMs, and deployment manifest.
