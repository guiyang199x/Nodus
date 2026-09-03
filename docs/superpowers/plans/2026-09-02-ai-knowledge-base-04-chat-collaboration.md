# Chat and Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver permission-scoped private chat with verifiable citations, explicit team Q&A publishing, versioned collaborative summaries and notes, comments, and conflict-safe realtime updates.

**Architecture:** The web application owns conversation orchestration and streams server-sent events, while retrieval remains a single-workspace database operation and the AI package remains provider-neutral. Private conversations are protected by live workspace membership plus `owner_user_id`; citation rows retain only an authorized locator/display snapshot and become explicitly unavailable when their source is purged. Published Q&A is a separate searchable team asset, and collaborative summary/note saves append one immutable revision per successful compare-and-swap while summary edits reuse Plan 03's manual-provenance and evidence transaction.

**Tech Stack:** Node.js 24 LTS, pnpm workspaces, Next.js 16.2.11 App Router, React 19.2.8, TypeScript strict mode, Supabase Auth/Postgres/RLS/Realtime, OpenAI through `packages/ai`, Zod, Vitest 4.1.11, Testing Library, Playwright, Tailwind CSS 4, `@remixicon/react` 4.9.0.

**Spec:** `docs/superpowers/specs/2026-09-02-general-ai-knowledge-base-design.md`

## Global Constraints

- A conversation always has exactly one `workspace_id` and one `owner_user_id`; even an Owner or Admin cannot read another member's private conversation.
- Retrieval filters to the caller's current membership and the current `READY` revision before ranking; no cross-workspace input, cache key, citation, or model context is permitted.
- The default answer mode is grounded-only. When evidence is insufficient, return an explicit insufficient-evidence result instead of unsupported general knowledge.
- Provider-side optional persistence is disabled with `store: false` where supported; logs exclude question text, chunk text, answer text, and complete prompts.
- A published Q&A is an independent team asset created only by an explicit publish action; it never exposes its source conversation or sibling messages.
- Only `status = 'published'` Q&A with at least one valid source appears in default team discovery. Plan 04 exposes explicit source invalidation by document/revision; Plan 05 alone wires document trash and permanent purge to that operation.
- Only Owner, Admin, and Editor can publish Q&A or edit shared derived knowledge. Viewer writes are limited to the viewer's own private conversations and messages.
- Summary and note saves carry the version read by the client. A version mismatch returns a conflict and never silently overwrites the current value.
- A summary edit creates a new manual `derived_artifact`, preserves authoritative evidence, updates the summary projection, and appends exactly one `content_revisions` row in the same transaction. Direct summary projection updates are forbidden.
- Draft text that failed to save remains in the browser for at least 24 hours.
- Source authorization is checked again when a citation is rendered or opened. Deleted, superseded-expired, or inaccessible sources are not exposed; the stored citation changes to `unavailable` without retaining an excerpt. Document trash does not exist until Plan 05 and is not referenced by migration `0008`.
- At 360, 768, 1024, and 1440 px, login, chat, citation navigation, Q&A publishing, derived-content editing, and comments remain usable without unintended horizontal scrolling.
- Use only official Remix Icon components for functional icons; no emoji, character icons, or second icon library.
- Every task includes its own permission-negative test and must be committed separately after its focused tests pass.

---

## File and Responsibility Map

| File                                                          | Responsibility                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `supabase/migrations/0008_conversations_collaboration.sql`    | Conversation, message, citation, published Q&A, note, content revision, comment, and RLS definitions |
| `supabase/tests/0008_chat_collaboration_rls.test.sql`         | Database-level ownership, role, citation, and cross-workspace isolation matrix                       |
| `packages/domain/src/chat.ts`                                 | Grounded-chat schemas, event union, citation locator, and insufficient-evidence result               |
| `packages/domain/src/collaboration.ts`                        | Q&A publishing, versioned content, comment, and conflict contracts                                   |
| `packages/ai/src/chat-provider.ts`                            | Provider-neutral grounded chat interface and OpenAI streaming adapter                                |
| `apps/web/src/features/chat/retrieval.ts`                     | Minimal, permission-scoped context selection from hybrid search                                      |
| `apps/web/src/features/chat/membership-lease.ts`              | Revalidate membership during a live stream and abort on revocation                                   |
| `apps/web/src/features/chat/repository.ts`                    | Owned-conversation commands and atomic message/citation persistence                                  |
| `apps/web/src/features/chat/service.ts`                       | Persist user message, invoke retrieval/provider, validate citations, and persist assistant result    |
| `apps/web/src/features/chat/factory.ts`                       | Server-only assembly of Supabase, embedding, repository, provider, and chat service dependencies     |
| `apps/web/src/features/chat/conversations.ts`                 | Create and list the authenticated user's private conversations                                       |
| `apps/web/src/app/api/workspaces/[workspaceId]/chat/route.ts` | Authenticated SSE route and cancellation propagation                                                 |
| `apps/web/src/features/chat/components/*`                     | Private chat shell, composer, stream rendering, evidence drawer, and empty state                     |
| `apps/web/src/features/published-qa/service.ts`               | Publish, edit, withdraw, explicit source invalidation, and team-search rules                         |
| `apps/web/src/features/published-qa/components/*`             | Publish review dialog and shared Q&A page                                                            |
| `apps/web/src/features/content/service.ts`                    | Summary/note optimistic writes, append-only revisions, and conflict copies                           |
| `apps/web/src/features/content/draft-store.ts`                | User-scoped, workspace-scoped 24-hour local draft retention                                          |
| `apps/web/src/features/content/components/*`                  | Autosaving editor, conflict resolver, and revision history                                           |
| `apps/web/src/features/comments/service.ts`                   | Comment commands and permission checks                                                               |
| `apps/web/src/features/comments/use-comments-channel.ts`      | RLS-protected Realtime subscription lifecycle                                                        |
| `tests/e2e/chat-collaboration.spec.ts`                        | End-to-end privacy, grounded answer, publish, conflict, and revocation journey                       |

### Task 1: Private Conversation and Collaboration Schema

**Files:**

- Create: `supabase/migrations/0008_conversations_collaboration.sql`
- Create: `supabase/tests/0008_chat_collaboration_rls.test.sql`
- Create: `packages/domain/src/chat.ts`
- Create: `packages/domain/src/collaboration.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**

- Consumes: `WorkspaceRole`, `Capability`, and workspace-scoped composite keys from Plan 01; `SourceLocator` and current-revision `chunks` from Plan 02; `summaries(id, workspace_id, document_id, revision_id, artifact_id, body_json, version, needs_reconfirmation, updated_by)` from Plan 03.
- Produces: `ChatRequestSchema`, `ChatStreamEventSchema`, `CitationSchema`, `PublishQaInputSchema`, `SaveContentInputSchema`, `ContentConflict`, and the tables/RLS consumed by Tasks 2–7.

- [ ] **Step 1: Write the failing domain and RLS tests**

```ts
// packages/domain/src/chat.test.ts
import { describe, expect, it } from 'vitest';
import { ChatRequestSchema, ChatStreamEventSchema } from './chat';

describe('grounded chat contracts', () => {
  it('rejects a request containing a second workspace', () => {
    expect(() =>
      ChatRequestSchema.parse({
        workspaceId: crypto.randomUUID(),
        conversationId: crypto.randomUUID(),
        question: 'Compare both teams',
        additionalWorkspaceIds: [crypto.randomUUID()],
      })
    ).toThrow();
  });

  it('requires a source locator on citation events', () => {
    expect(() =>
      ChatStreamEventSchema.parse({
        type: 'citation',
        citation: { chunkId: crypto.randomUUID(), label: '[1]' },
      })
    ).toThrow();
  });
});
```

```sql
-- supabase/tests/0008_chat_collaboration_rls.test.sql
begin;
select plan(4);
select tests.authenticate_as('team_admin');
select is((select count(*) from conversations where owner_user_id = tests.id('editor_user')), 0::bigint,
  'admin cannot see editor private conversations');
select tests.authenticate_as('team_viewer');
select lives_ok($$insert into conversations(id, workspace_id, owner_user_id, title)
  values (tests.uuid('viewer_conversation'), tests.id('team_a'), auth.uid(), 'Mine')$$,
  'viewer may create own private conversation');
select throws_ok($$insert into notes(id, workspace_id, document_id, body_json, version, updated_by)
  values (gen_random_uuid(), tests.id('team_a'), tests.id('team_a_document'), '{}'::jsonb, 1, auth.uid())$$,
  '42501', null, 'viewer cannot edit team knowledge');
select throws_ok($$insert into message_citations(
    id, workspace_id, message_id, document_id, revision_id, chunk_id, locator, citation_snapshot, ordinal
  ) values (
    gen_random_uuid(), tests.id('team_a'), tests.id('viewer_message'), tests.id('team_a_document'),
    tests.id('team_a_revision'), tests.id('team_b_chunk'), '{}'::jsonb, '{"title":"foreign"}'::jsonb, 1
  )$$,
  '23503', null, 'cross-workspace citations fail at the foreign key');
select * from finish();
rollback;
```

The pgTAP preamble uses the Plan 01/02 fixture helpers to insert one Team A `viewer_message`, one Team A READY revision, and one Team B chunk before the assertions; it never invents a parent UUID. The citation insert therefore reaches the intended composite workspace/chunk foreign key rather than failing on a missing message.

- [ ] **Step 2: Run the tests and verify the contracts do not exist**

Run: `pnpm --filter @knowledge/domain test -- chat.test.ts && pnpm test:db`

Expected: FAIL because `./chat` and migration `0008_conversations_collaboration.sql` do not exist.

- [ ] **Step 3: Add exact domain schemas and workspace-owned tables**

```ts
// packages/domain/src/chat.ts
import { z } from 'zod';
import { SourceLocatorSchema } from './documents';

const Uuid = z.string().uuid();

export const CitationSchema = z.object({
  id: Uuid,
  chunkId: Uuid.nullable(),
  documentId: Uuid.nullable(),
  revisionId: Uuid.nullable(),
  label: z.string().regex(/^\[\d+\]$/),
  locator: SourceLocatorSchema,
  sourceStatus: z.enum(['valid', 'historical', 'unavailable']),
  citationSnapshot: z.object({ title: z.string().min(1), locator: SourceLocatorSchema }).strict(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ChatRequestSchema = z
  .object({
    workspaceId: Uuid,
    conversationId: Uuid,
    question: z.string().trim().min(1).max(8_000),
  })
  .strict();
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), phase: z.enum(['retrieving', 'answering', 'verifying']) }),
  z.object({ type: z.literal('delta'), text: z.string().min(1) }),
  z.object({ type: z.literal('citation'), citation: CitationSchema }),
  z.object({ type: z.literal('insufficient_evidence'), message: z.string().min(1) }),
  z.object({ type: z.literal('done'), messageId: Uuid }),
  z.object({
    type: z.literal('error'),
    code: z.enum(['FORBIDDEN', 'CANCELLED', 'PROVIDER_UNAVAILABLE', 'INVALID_CITATION']),
  }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
```

```ts
// packages/domain/src/collaboration.ts
import { z } from 'zod';
const Uuid = z.string().uuid();
export const PublishQaInputSchema = z.object({
  workspaceId: Uuid,
  conversationId: Uuid,
  messageId: Uuid,
  title: z.string().trim().min(1).max(180),
  answerJson: z.record(z.string(), z.unknown()),
  citationIds: z.array(Uuid).min(1).max(50),
});
export type PublishQaInput = z.infer<typeof PublishQaInputSchema>;

export const SaveContentInputSchema = z.object({
  workspaceId: Uuid,
  contentType: z.enum(['summary', 'note']),
  contentId: Uuid,
  expectedVersion: z.number().int().positive(),
  bodyJson: z.record(z.string(), z.unknown()),
});
export type SaveContentInput = z.infer<typeof SaveContentInputSchema>;
export type ContentConflict = {
  kind: 'version_conflict';
  expectedVersion: number;
  currentVersion: number;
  currentBodyJson: Record<string, unknown>;
};
export const PublishedQaImpactSchema = z
  .object({
    hiddenQaIds: z.array(Uuid),
    withdrawnQaIds: z.array(Uuid),
    remainingValidCitationCounts: z.record(Uuid, z.number().int().nonnegative()),
  })
  .strict();
export type PublishedQaImpact = z.infer<typeof PublishedQaImpactSchema>;
```

```sql
-- core excerpt for supabase/migrations/0008_conversations_collaboration.sql
create table conversations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  owner_user_id uuid not null references auth.users(id), title text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id, id), unique(workspace_id, id, owner_user_id),
  foreign key(workspace_id, owner_user_id) references memberships(workspace_id, user_id)
);
create table messages (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  conversation_id uuid not null, owner_user_id uuid not null references auth.users(id),
  role text not null check(role in ('user','assistant')), body_json jsonb not null,
  status text not null check(status in ('streaming','complete','failed','cancelled')),
  created_at timestamptz not null default now(), unique(workspace_id, id),
  foreign key(workspace_id, conversation_id, owner_user_id)
    references conversations(workspace_id, id, owner_user_id)
);
create table message_citations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, message_id uuid not null,
  document_id uuid, revision_id uuid, chunk_id uuid,
  locator jsonb not null, citation_snapshot jsonb not null,
  source_status text not null default 'valid' check(source_status in ('valid','historical','unavailable')),
  ordinal integer not null check(ordinal > 0),
  unique(workspace_id, id), unique(workspace_id, message_id, ordinal),
  foreign key(workspace_id, message_id) references messages(workspace_id, id) on delete cascade,
  foreign key(workspace_id, document_id, revision_id)
    references document_revisions(workspace_id, document_id, id) on delete restrict,
  foreign key(workspace_id, chunk_id) references chunks(workspace_id, id) on delete restrict,
  check((source_status = 'valid' and document_id is not null and revision_id is not null and chunk_id is not null) or source_status <> 'valid')
);
create table published_qas (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, author_user_id uuid,
  title text not null, answer_json jsonb not null, search_text text not null,
  status text not null check(status in ('published','hidden_source_invalid','withdrawn')) default 'published',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id, id)
);
create table published_qa_citations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, published_qa_id uuid not null,
  document_id uuid, revision_id uuid, chunk_id uuid,
  locator jsonb not null, citation_snapshot jsonb not null,
  source_status text not null default 'valid' check(source_status in ('valid','historical','unavailable')),
  ordinal integer not null check(ordinal > 0),
  unique(workspace_id, id),
  unique(workspace_id, published_qa_id, ordinal),
  foreign key(workspace_id, published_qa_id) references published_qas(workspace_id, id) on delete cascade,
  foreign key(workspace_id, document_id, revision_id)
    references document_revisions(workspace_id, document_id, id) on delete restrict,
  foreign key(workspace_id, chunk_id) references chunks(workspace_id, id) on delete restrict,
  check((source_status = 'valid' and document_id is not null and revision_id is not null and chunk_id is not null) or source_status <> 'valid')
);
create table notes (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, document_id uuid not null,
  body_json jsonb not null, version integer not null default 1, updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(), unique(workspace_id, id),
  foreign key(workspace_id, document_id) references documents(workspace_id, id)
);
create table content_revisions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  content_type text not null check(content_type in ('summary','note')),
  content_id uuid not null,
  version integer not null, body_json jsonb not null, authored_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(workspace_id, content_type, content_id, version)
);
create table comments (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, document_id uuid not null,
  author_user_id uuid not null references auth.users(id), body text not null check(char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(), edited_at timestamptz,
  unique(workspace_id, id), foreign key(workspace_id, document_id) references documents(workspace_id, id)
);
```

Add RLS policies that join live `memberships.status = 'active'`; conversation/message/citation policies additionally require the owning conversation's `owner_user_id = auth.uid()`. Published Q&A SELECT permits active members, mutations call `has_workspace_capability(workspace_id, 'qa.publish')`, and note/comment mutations call the corresponding capability. Revoke direct mutation of `content_revisions` and expose it only through the save RPC in Task 5. Add a deferred `assert_content_revision_target` trigger that checks `content_type='summary'` resolves `content_id` in `summaries(workspace_id,id)` or `content_type='note'` resolves it in `notes(workspace_id,id)`; the service and RPC use the same discriminator, so a revision cannot point at a row from another workspace. Add `published_qas_search_idx` on `to_tsvector('simple', search_text)` and expose only the `search_published_qa(workspace_id,query,limit)` RPC, which filters active members, `status='published'`, and at least one `source_status='valid'` citation before ranking.

The migration must also create these fixed signatures and grants: `publish_verified_qa(uuid,uuid,uuid,uuid,text,jsonb,uuid[]) returns uuid`, `update_published_qa(uuid,uuid,text,jsonb) returns void`, `withdraw_published_qa(uuid,uuid) returns void`, `search_published_qa(uuid,text,integer) returns table(id uuid,title text,answer_json jsonb,citation_count bigint,updated_at timestamptz)`, `invalidate_published_qa_sources(uuid,uuid,uuid) returns jsonb`, and `save_versioned_content(uuid,text,uuid,integer,jsonb) returns jsonb`. Revoke all of them from `public` and `anon`; grant only the authenticated functions to `authenticated`, and keep source invalidation callable by `knowledge_worker` plus `authenticated` users with `documents.trash`. The trigger and every RPC use `set search_path = pg_catalog, public`, and the search function never returns `answer_json` fields containing a source excerpt.

Use this trigger body so the single `content_id` discriminator remains database-validated even though Postgres cannot express a polymorphic foreign key:

```sql
create or replace function public.assert_content_revision_target()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if (new.content_type = 'summary' and not exists (
      select 1 from public.summaries s where s.workspace_id = new.workspace_id and s.id = new.content_id
    )) or (new.content_type = 'note' and not exists (
      select 1 from public.notes n where n.workspace_id = new.workspace_id and n.id = new.content_id
    )) then
    raise exception using errcode = '23503', message = 'content revision target is not in workspace';
  end if;
  return new;
end;
$$;
create constraint trigger content_revision_target_fk
after insert or update on public.content_revisions
deferrable initially deferred for each row
execute function public.assert_content_revision_target();
```

- [ ] **Step 4: Run domain and database tests**

Run: `pnpm --filter @knowledge/domain test -- chat.test.ts && pnpm db:reset && pnpm test:db`

Expected: PASS; the admin private-chat query returns zero, viewer private insert succeeds, and both unauthorized writes fail.

- [ ] **Step 5: Commit the schema boundary**

```bash
git add packages/domain/src/chat.ts packages/domain/src/chat.test.ts packages/domain/src/collaboration.ts packages/domain/src/index.ts supabase/migrations/0008_conversations_collaboration.sql supabase/tests/0008_chat_collaboration_rls.test.sql
git commit -m "feat: add private chat and collaboration schema"
```

### Task 2: Permission-Leased Grounded Chat Stream

**Files:**

- Create: `packages/ai/src/chat-provider.ts`
- Create: `packages/ai/src/chat-provider.test.ts`
- Create: `packages/ai/src/providers/openai-chat.ts`
- Create: `packages/ai/src/providers/openai-chat.test.ts`
- Modify: `packages/ai/src/index.ts`
- Create: `apps/web/src/features/chat/retrieval.ts`
- Create: `apps/web/src/features/chat/membership-lease.ts`
- Create: `apps/web/src/features/chat/repository.ts`
- Create: `apps/web/src/features/chat/repository.test.ts`
- Create: `apps/web/src/features/chat/factory.ts`
- Create: `apps/web/src/features/chat/conversations.ts`
- Create: `apps/web/src/features/chat/conversations.test.ts`
- Create: `apps/web/src/features/chat/service.ts`
- Create: `apps/web/src/features/chat/service.test.ts`
- Create: `apps/web/src/app/api/workspaces/[workspaceId]/chat/route.ts`
- Create: `apps/web/src/app/api/workspaces/[workspaceId]/chat/route.test.ts`
- Create: `apps/web/src/app/api/workspaces/[workspaceId]/conversations/route.ts`
- Create: `apps/web/src/app/api/workspaces/[workspaceId]/conversations/route.test.ts`

**Interfaces:**

- Consumes: `searchWorkspace(input): Promise<WorkspaceSearchResult[]>` and `WorkspaceSearchRequest` from Plan 02; `requireWorkspaceCapability(client, workspaceId, "documents.read"): Promise<WorkspaceContext>` from Plan 01; `CitationSchema` and `ChatStreamEvent` from Task 1.
- Produces: `GroundedChatProvider.stream(input: GroundedChatInput, signal: AbortSignal): AsyncIterable<ProviderChatEvent>`, `buildGroundedContext(input): Promise<GroundedContext>`, `createMembershipLease(input): MembershipLease`, `SupabaseChatRepository`, `createServerChatService()`, `createConversation()`, `listOwnConversations()`, `createChatService(dependencies): ChatService`, and `streamGroundedAnswer(input): AsyncIterable<ChatStreamEvent>`.

- [ ] **Step 1: Write failing service tests for grounding, citation rejection, and revocation**

```ts
// packages/ai/src/providers/openai-chat.test.ts
it('disables provider storage and exposes no tools', async () => {
  const responses = { stream: vi.fn().mockReturnValue(fakeResponsesStream()) };
  const provider = new OpenAiGroundedChatProvider(responses, 'configured-model-id');
  await collectEvents(provider.stream(fixtures.groundedInput, new AbortController().signal));
  expect(responses.stream).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'configured-model-id',
      store: false,
      tools: [],
    }),
    expect.anything()
  );
});
```

```ts
// apps/web/src/features/chat/service.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createChatService, type ChatServiceDependencies } from './service';
import { createMembershipLease } from './membership-lease';

const source = {
  chunkId: '40000000-0000-4000-8000-000000000001',
  workspaceId: '10000000-0000-4000-8000-000000000001',
  documentId: '20000000-0000-4000-8000-000000000001',
  revisionId: '30000000-0000-4000-8000-000000000001',
  text: 'The launch decision was recorded.',
  locator: { page: 3 },
  score: 0.91,
};
async function collectEvents<T>(events: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}
function makeChatHarness(
  input: {
    searchHits?: Array<typeof source>;
    providerCitationChunkId?: string;
    membershipChecks?: boolean[];
  } = {}
) {
  const membershipChecks = [...(input.membershipChecks ?? [true, true, true])];
  const provider = {
    stream: vi.fn(async function* () {
      yield { type: 'delta' as const, text: 'The decision' };
      yield {
        type: 'citation' as const,
        chunkId: input.providerCitationChunkId ?? source.chunkId,
        claim: 'The decision',
      };
      yield { type: 'done' as const };
    }),
  };
  const dependencies: ChatServiceDependencies = {
    client: {} as never,
    provider,
    search: vi.fn().mockResolvedValue(
      (input.searchHits ?? [source]).map((hit) => ({
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        revisionId: hit.revisionId,
        title: 'Decision note',
        snippet: hit.text,
        locator: hit.locator,
        score: hit.score,
        matchedBy: ['semantic' as const],
      }))
    ),
    repository: {
      requireOwnedConversation: vi.fn().mockResolvedValue(undefined),
      appendUserMessage: vi.fn().mockResolvedValue('50000000-0000-4000-8000-000000000001'),
      persistAssistantResult: vi.fn().mockResolvedValue('50000000-0000-4000-8000-000000000002'),
      resolveAuthoritativeCitations: vi.fn().mockResolvedValue([
        {
          id: '51000000-0000-4000-8000-000000000001',
          chunkId: source.chunkId,
          documentId: source.documentId,
          revisionId: source.revisionId,
          label: '[1]',
          locator: source.locator,
          sourceStatus: 'valid',
          citationSnapshot: { title: 'Decision note', locator: source.locator },
        },
      ]),
      markAssistantInterrupted: vi.fn().mockResolvedValue(undefined),
      isMembershipActive: vi.fn().mockImplementation(async () => membershipChecks.shift() ?? false),
    },
    createMembershipLease: vi.fn(({ parentSignal }) =>
      createMembershipLease({
        revalidate: async () => membershipChecks.shift() ?? true,
        parentSignal,
        intervalMs: 0,
      })
    ),
    requestId: vi.fn().mockReturnValue('61000000-0000-4000-8000-000000000001'),
    now: vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(2_001).mockReturnValue(3_002),
  };
  return {
    service: createChatService(dependencies),
    provider,
    input: {
      request: {
        workspaceId: source.workspaceId,
        conversationId: '60000000-0000-4000-8000-000000000001',
        question: 'What was decided?',
      },
      signal: new AbortController().signal,
    },
  };
}

describe('streamGroundedAnswer', () => {
  it('does not call the provider when retrieval has no evidence', async () => {
    const h = makeChatHarness({ searchHits: [] });
    const events = await collectEvents(h.service.streamGroundedAnswer(h.input));
    expect(events).toContainEqual({
      type: 'insufficient_evidence',
      message: '当前工作区的资料不足以回答这个问题。',
    });
    expect(h.provider.stream).not.toHaveBeenCalled();
  });

  it('rejects a provider citation that is not in the retrieved allow-list', async () => {
    const h = makeChatHarness({ providerCitationChunkId: crypto.randomUUID() });
    await expect(collectEvents(h.service.streamGroundedAnswer(h.input))).resolves.toContainEqual({
      type: 'error',
      code: 'INVALID_CITATION',
    });
  });

  it('aborts before the next frame when membership is revoked', async () => {
    const h = makeChatHarness({ membershipChecks: [true, false] });
    await expect(collectEvents(h.service.streamGroundedAnswer(h.input))).resolves.toContainEqual({
      type: 'error',
      code: 'FORBIDDEN',
    });
  });
});
```

```ts
// apps/web/src/app/api/workspaces/[workspaceId]/chat/route.test.ts
it('returns validated SSE with private non-cacheable headers', async () => {
  vi.mocked(streamGroundedAnswer).mockImplementation(async function* () {
    yield { type: 'delta', text: 'Grounded' };
    yield { type: 'done', messageId: '50000000-0000-4000-8000-000000000002' };
  });
  const response = await POST(makeChatRequest(), {
    params: Promise.resolve({ workspaceId: '10000000-0000-4000-8000-000000000001' }),
  });
  expect(response.headers.get('content-type')).toBe('text/event-stream');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.text()).toContain('event: done');
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm --filter @knowledge/web test -- src/features/chat/service.test.ts src/app/api/workspaces/\[workspaceId\]/chat/route.test.ts`

Expected: FAIL because `streamGroundedAnswer`, the provider contract, and the SSE route are missing.

- [ ] **Step 3: Implement the provider contract, minimal context, lease, and SSE route**

```ts
// packages/ai/src/chat-provider.ts
import type { SourceLocator } from '@knowledge/domain';

export type GroundedContextItem = {
  chunkId: string;
  documentId: string;
  revisionId: string;
  text: string;
  locator: SourceLocator;
};
export type GroundedChatInput = {
  requestId: string;
  question: string;
  context: readonly GroundedContextItem[];
};
export type ProviderChatEvent =
  | { type: 'delta'; text: string }
  | { type: 'citation'; chunkId: string; claim: string }
  | { type: 'done' };
export interface GroundedChatProvider {
  stream(input: GroundedChatInput, signal: AbortSignal): AsyncIterable<ProviderChatEvent>;
}
```

`OpenAiGroundedChatProvider` in `packages/ai/src/providers/openai-chat.ts` accepts the already-created OpenAI Responses client and configured model ID in its constructor. It serializes context items under opaque labels `SOURCE_1…SOURCE_N`, uses the versioned grounded system instruction, passes `store: false`, `tools: []`, and the abort signal, then maps only text deltas and structured citation objects into `ProviderChatEvent`; any cited label outside the input list throws `INVALID_PROVIDER_CITATION`.

```ts
// apps/web/src/features/chat/membership-lease.ts
export type MembershipLease = {
  assertValid(now?: number): Promise<void>;
  abortSignal: AbortSignal;
  close(): void;
};

export function createMembershipLease(input: {
  revalidate: () => Promise<boolean>;
  intervalMs?: number;
  parentSignal: AbortSignal;
}): MembershipLease {
  const controller = new AbortController();
  const intervalMs = input.intervalMs ?? 1_000;
  let lastCheckedAt = 0;
  input.parentSignal.addEventListener('abort', () => controller.abort(input.parentSignal.reason), {
    once: true,
  });
  return {
    abortSignal: controller.signal,
    async assertValid(now = Date.now()) {
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (now - lastCheckedAt < intervalMs) return;
      lastCheckedAt = now;
      if (!(await input.revalidate())) {
        controller.abort('membership_revoked');
        throw new Error('FORBIDDEN');
      }
    },
    close() {
      controller.abort('stream_closed');
    },
  };
}
```

```ts
// apps/web/src/features/chat/retrieval.ts
export async function buildGroundedContext(input: {
  workspaceId: string;
  question: string;
  requestId: string;
  search: ChatSearch;
}): Promise<{ items: GroundedContextItem[]; allowedChunkIds: Set<string> }> {
  const hits = await input.search({
    requestId: input.requestId,
    request: { workspaceId: input.workspaceId, query: input.question, limit: 12, filters: {} },
  });
  const items = hits.slice(0, 8).map(({ chunkId, documentId, revisionId, snippet, locator }) => ({
    chunkId,
    documentId,
    revisionId,
    text: snippet.slice(0, 6_000),
    locator,
  }));
  return { items, allowedChunkIds: new Set(items.map((item) => item.chunkId)) };
}
```

```ts
// apps/web/src/features/chat/service.ts contract boundary
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ChatRequestSchema,
  type ChatStreamEvent,
  type Citation,
  type Database,
  type WorkspaceSearchRequest,
  type WorkspaceSearchResult,
} from '@knowledge/domain';

export type ChatRepository = {
  requireOwnedConversation(workspaceId: string, conversationId: string): Promise<void>;
  appendUserMessage(input: ChatRequest): Promise<string>;
  persistAssistantResult(input: {
    request: ChatRequest;
    userMessageId: string;
    body: string;
    citations: Citation[];
    requestId: string;
  }): Promise<string>;
  markAssistantInterrupted(input: {
    request: ChatRequest;
    userMessageId: string;
    status: 'failed' | 'cancelled';
  }): Promise<void>;
  resolveAuthoritativeCitations(input: {
    request: ChatRequest;
    chunkIds: string[];
  }): Promise<Citation[]>;
  isMembershipActive(workspaceId: string): Promise<boolean>;
};
export type ChatServiceDependencies = {
  client: SupabaseClient<Database>;
  provider: GroundedChatProvider;
  search: ChatSearch;
  repository: ChatRepository;
  createMembershipLease(input: { workspaceId: string; parentSignal: AbortSignal }): MembershipLease;
  requestId: () => string;
  now: () => number;
};
export type ChatSearch = (input: {
  request: WorkspaceSearchRequest;
  requestId: string;
}) => Promise<WorkspaceSearchResult[]>;
export type ChatService = {
  streamGroundedAnswer(input: {
    request: ChatRequest;
    signal: AbortSignal;
  }): AsyncIterable<ChatStreamEvent>;
};
export function createChatService(dependencies: ChatServiceDependencies): ChatService {
  return { streamGroundedAnswer: (input) => streamWithDependencies(dependencies, input) };
}

async function* streamWithDependencies(
  dependencies: ChatServiceDependencies,
  input: { request: ChatRequest; signal: AbortSignal }
): AsyncIterable<ChatStreamEvent> {
  const request = ChatRequestSchema.parse(input.request);
  await dependencies.repository.requireOwnedConversation(
    request.workspaceId,
    request.conversationId
  );
  const userMessageId = await dependencies.repository.appendUserMessage(request);
  const context = await buildGroundedContext({
    workspaceId: request.workspaceId,
    question: request.question,
    requestId: dependencies.requestId(),
    search: dependencies.search,
  });
  if (context.items.length === 0) {
    yield { type: 'insufficient_evidence', message: '当前工作区的资料不足以回答这个问题。' };
    return;
  }
  const lease = dependencies.createMembershipLease({
    workspaceId: request.workspaceId,
    parentSignal: input.signal,
  });
  const deltas: string[] = [];
  const providerCitationIds: string[] = [];
  try {
    yield { type: 'status', phase: 'retrieving' };
    yield { type: 'status', phase: 'answering' };
    for await (const event of dependencies.provider.stream(
      {
        requestId: dependencies.requestId(),
        question: request.question,
        context: context.items,
      },
      lease.abortSignal
    )) {
      await lease.assertValid();
      if (event.type === 'delta') {
        deltas.push(event.text);
        yield event;
        continue;
      }
      providerCitationIds.push(event.chunkId);
    }
    await lease.assertValid();
    yield { type: 'status', phase: 'verifying' };
    if (providerCitationIds.some((id) => !context.allowedChunkIds.has(id))) {
      await dependencies.repository.markAssistantInterrupted({
        request,
        userMessageId,
        status: 'failed',
      });
      yield { type: 'error', code: 'INVALID_CITATION' };
      return;
    }
    const citations = await dependencies.repository.resolveAuthoritativeCitations({
      request,
      chunkIds: providerCitationIds,
    });
    const messageId = await dependencies.repository.persistAssistantResult({
      request,
      userMessageId,
      body: deltas.join(''),
      citations,
      requestId: dependencies.requestId(),
    });
    for (const citation of citations) yield { type: 'citation', citation };
    yield { type: 'done', messageId };
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 'cancelled' : 'failed';
    await dependencies.repository.markAssistantInterrupted({ request, userMessageId, status });
    yield { type: 'error', code: status === 'cancelled' ? 'CANCELLED' : 'PROVIDER_UNAVAILABLE' };
  } finally {
    lease.close();
  }
}
```

Implement `apps/web/src/features/chat/repository.ts` as `SupabaseChatRepository` over `SupabaseClient<Database>`. Its `requireOwnedConversation`, `appendUserMessage`, `resolveAuthoritativeCitations`, `persistAssistantResult`, `markAssistantInterrupted`, and `isMembershipActive` methods call only fixed RPCs: `assert_owned_conversation(workspace_id,conversation_id)`, `append_private_message(workspace_id,conversation_id,role,body_json)`, `resolve_chat_citations(workspace_id,conversation_id,chunk_ids)`, `persist_chat_result(workspace_id,conversation_id,user_message_id,body_json,citations,request_id)`, and `mark_chat_message_interrupted(workspace_id,conversation_id,user_message_id,status)`. `persist_chat_result` locks the conversation, rechecks its owner and active membership, validates every citation against the current authorized chunk/revision, inserts the assistant message and all citation rows with ordinals/snapshots in one transaction, and returns the assistant message ID. No repository method exposes a generic table query builder.

`apps/web/src/features/chat/factory.ts` must export `createServerChatService(): Promise<ChatService>`. It calls `createServerSupabaseClient()`, constructs the configured server-only embedding provider, binds `searchWorkspace({ client, embeddingProvider, request, requestId })` to the `ChatSearch` signature, constructs `SupabaseChatRepository`, constructs `OpenAiGroundedChatProvider` from deployment configuration, and injects `createMembershipLease` plus a cryptographic `requestId` factory. The route and Server Actions use this factory; they never call a global unbound `streamGroundedAnswer`.

`apps/web/src/features/chat/conversations.ts` must export `createConversation(client, input): Promise<ConversationSummary>` and `listOwnConversations(client, input): Promise<ConversationSummary[]>`. Both require an active membership, always filter `owner_user_id = auth.uid()`, and use `create_private_conversation(workspace_id,title)` / `list_private_conversations(workspace_id)` RPCs. Add `POST` and `GET` to `/api/workspaces/[workspaceId]/conversations/route.ts`; the POST returns `201` with the new conversation ID, the GET returns only the caller's conversations, and both reject a body/path workspace mismatch. Add route and repository tests for admin-versus-owner privacy and cross-workspace IDs.

`streamGroundedAnswer` must: parse `ChatRequestSchema`; require `documents.read`; verify the conversation is owned by `context.userId`; persist the user message; return `insufficient_evidence` without calling AI when no hit passes the retrieval threshold; start the membership lease; stream only validated provider frames; reject citations outside `allowedChunkIds`; look up the authoritative document/revision/locator rather than trusting provider text; persist the assistant message and citations in one transaction; and mark an interrupted message `cancelled` or `failed`. The OpenAI adapter sends only the selected text and opaque per-request labels, uses deployment-configured model IDs, and sets `store: false`.

```ts
// apps/web/src/app/api/workspaces/[workspaceId]/chat/route.ts
import { createServerChatService } from '@/features/chat/factory';
import { ChatRequestSchema } from '@knowledge/domain';

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params;
  const body = ChatRequestSchema.parse({ ...(await request.json()), workspaceId });
  const service = await createServerChatService();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of service.streamGroundedAnswer({
          request: body,
          signal: request.signal,
        })) {
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
          );
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' },
  });
}
```

- [ ] **Step 4: Run chat contract and route tests**

Run: `pnpm --filter @knowledge/ai test -- chat-provider.test.ts openai-chat.test.ts && pnpm --filter @knowledge/web test -- src/features/chat/service.test.ts src/app/api/workspaces/\[workspaceId\]/chat/route.test.ts`

Expected: PASS; empty retrieval bypasses AI, unreturned citations are rejected, stream revocation emits `FORBIDDEN`, and responses carry `Cache-Control: no-store`.

- [ ] **Step 5: Commit the grounded stream**

```bash
git add packages/ai/src/chat-provider.ts packages/ai/src/chat-provider.test.ts packages/ai/src/providers/openai-chat.ts packages/ai/src/providers/openai-chat.test.ts packages/ai/src/index.ts apps/web/src/features/chat apps/web/src/app/api/workspaces
git commit -m "feat: stream permission-scoped grounded chat"
```

### Task 3: Private Chat Workspace and Citation Navigation

**Files:**

- Create: `apps/web/src/app/(workspace)/w/[workspaceId]/chat/page.tsx`
- Create: `apps/web/src/app/(workspace)/w/[workspaceId]/chat/[conversationId]/page.tsx`
- Create: `apps/web/src/features/chat/components/chat-shell.tsx`
- Create: `apps/web/src/features/chat/components/chat-composer.tsx`
- Create: `apps/web/src/features/chat/components/chat-message.tsx`
- Create: `apps/web/src/features/chat/components/citation-drawer.tsx`
- Create: `apps/web/src/features/chat/components/chat-empty-state.tsx`
- Create: `apps/web/src/features/chat/components/chat-shell.test.tsx`
- Create: `apps/web/src/features/chat/actions.ts`
- Create: `apps/web/src/features/chat/actions.test.ts`
- Modify: `apps/web/src/components/shell/app-shell.tsx`
- Copy: `docs/superpowers/assets/illustration-grounded-chat.png` to `apps/web/public/illustrations/grounded-chat.png`

**Interfaces:**

- Consumes: `ChatStreamEvent`, authenticated SSE endpoint from Task 2, document preview route from Plan 02, `WorkspaceContext` and design primitives from Plan 01.
- Produces: `ChatShell`, `ChatComposer`, `CitationDrawer`, `retryAnswer()`, `startFollowUp()`, and `copyAnswer()` used by the private-chat routes and Task 4's publish action.

- [ ] **Step 1: Write a failing interaction test**

```tsx
// apps/web/src/features/chat/components/chat-shell.test.tsx
it('streams an answer, announces status, and opens an authorized citation', async () => {
  server.use(
    mockChatSse([
      { type: 'status', phase: 'retrieving' },
      { type: 'delta', text: 'The decision was recorded' },
      { type: 'citation', citation: fixtures.citation },
      { type: 'done', messageId: fixtures.assistantMessageId },
    ])
  );
  render(<ChatShell workspace={fixtures.workspace} conversation={fixtures.conversation} />);
  await userEvent.type(screen.getByRole('textbox', { name: '向资料提问' }), 'What was decided?');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(await screen.findByText('The decision was recorded')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: '打开引用 [1]' }));
  expect(await screen.findByRole('dialog', { name: '引用来源' })).toHaveTextContent('第 3 页');
});
```

- [ ] **Step 2: Run the interaction test and verify it fails**

Run: `pnpm --filter @knowledge/web test -- src/features/chat/components/chat-shell.test.tsx`

Expected: FAIL because the chat components are absent.

- [ ] **Step 3: Implement the Notion-like chat surface**

```tsx
// apps/web/src/features/chat/components/chat-composer.tsx
import { RiSendPlane2Line, RiStopCircleLine } from '@remixicon/react';

export function ChatComposer(props: {
  value: string;
  busy: boolean;
  onChange(value: string): void;
  onSend(): void;
  onCancel(): void;
}) {
  return (
    <div className="border-border bg-canvas sticky bottom-0 border-t py-3">
      <label className="sr-only" htmlFor="chat-question">
        向资料提问
      </label>
      <textarea
        id="chat-question"
        value={props.value}
        disabled={props.busy}
        onChange={(event) => props.onChange(event.target.value)}
        aria-describedby="chat-question-guidance"
        className="min-h-24 w-full resize-y rounded-md border px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary"
      />
      <p id="chat-question-guidance" className="mt-1 text-sm text-secondary">
        只根据当前空间中你有权访问的资料回答
      </p>
      <button
        type="button"
        aria-label={props.busy ? '停止生成' : '发送'}
        onClick={props.busy ? props.onCancel : props.onSend}
        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-3 text-white"
      >
        {props.busy ? (
          <RiStopCircleLine aria-hidden size={20} />
        ) : (
          <RiSendPlane2Line aria-hidden size={20} />
        )}
        {props.busy ? '停止' : '发送'}
      </button>
    </div>
  );
}
```

`ChatShell` parses SSE frames with `ChatStreamEventSchema`, renders deltas into one assistant message, exposes a live region for `retrieving/answering/verifying`, shows persistent processing copy after 10 seconds without first content, and aborts its fetch when the route changes or Stop is pressed. `ChatEmptyState` uses `/illustrations/grounded-chat.png`, the approved meaningful Chinese alt text, a title, explanation, and focusable composer. `CitationDrawer` fetches the authenticated preview only after opening and renders `FORBIDDEN`, `HISTORICAL`, and `UNAVAILABLE` states without cached source text.

Implement `apps/web/src/features/chat/actions.ts` with server-only `retryAnswer({ workspaceId, conversationId, failedMessageId })`, `startFollowUp({ workspaceId, conversationId, question })`, and `copyAnswer({ workspaceId, messageId })`. Each action rechecks the caller-owned conversation, never accepts a message body or citation list from the browser for an existing answer, and either starts a new private stream or copies only the already-authorized rendered text to the clipboard response. Add tests for retry, follow-up, copy, and an Admin attempting to reuse another member's message ID.

The conversation list page calls the Task 2 GET endpoint, creates a new conversation with the POST endpoint, and routes to `/w/{workspaceId}/chat/{conversationId}`. The detail page never server-renders another user's conversation; a `403/404` becomes the explicit “你无权查看此私密对话” state.

- [ ] **Step 4: Run component tests, accessibility smoke test, and production build**

Run: `pnpm --filter @knowledge/web test -- src/features/chat/components/chat-shell.test.tsx && pnpm --filter @knowledge/web build`

Expected: PASS; build has no server/client boundary error, all icon-only controls have names, and the citation opens at its locator.

- [ ] **Step 5: Commit the private chat UI**

```bash
git add apps/web/src/app apps/web/src/features/chat/components apps/web/src/components/shell/app-shell.tsx apps/web/public/illustrations/grounded-chat.png
git commit -m "feat: add private grounded chat workspace"
```

### Task 4: Explicit Team Q&A Publishing and Source Lifecycle

**Files:**

- Create: `apps/web/src/features/published-qa/service.ts`
- Create: `apps/web/src/features/published-qa/service.test.ts`
- Create: `apps/web/src/features/published-qa/components/publish-qa-dialog.tsx`
- Create: `apps/web/src/features/published-qa/components/published-qa-list.tsx`
- Create: `apps/web/src/features/published-qa/components/publish-qa-dialog.test.tsx`
- Create: `apps/web/src/app/(workspace)/w/[workspaceId]/qa/page.tsx`
- Create: `apps/web/src/features/published-qa/search.test.ts`
- Create: `supabase/tests/0008_published_qa_lifecycle.test.sql`

**Interfaces:**

- Consumes: `PublishQaInput`, private message ownership from Task 1, capability `qa.publish` from Plan 01, and authoritative citation validation from Task 2.
- Produces: `publishQa(input: PublishQaInput): Promise<{ publishedQaId: string }>`, `updatePublishedQa(input): Promise<void>`, `withdrawPublishedQa(input): Promise<void>`, `searchPublishedQa(input): Promise<PublishedQaSummary[]>`, and `invalidatePublishedQaSources(input): Promise<PublishedQaImpact>`.

- [ ] **Step 1: Write failing publish and invalidation tests**

```ts
// apps/web/src/features/published-qa/service.test.ts
it('copies only selected verified citations and never exposes conversation ids', async () => {
  const result = await service.publishQa(fixtures.validPublishInput);
  const qa = await fixtures.adminClient
    .from('published_qas')
    .select('*')
    .eq('id', result.publishedQaId)
    .single();
  const citations = await fixtures.adminClient
    .from('published_qa_citations')
    .select('*')
    .eq('published_qa_id', result.publishedQaId);
  expect(qa.data).not.toHaveProperty('conversation_id');
  expect(citations.data).toHaveLength(fixtures.validPublishInput.citationIds.length);
});

it('rejects a viewer and a citation outside the publishing workspace', async () => {
  await expect(viewerService.publishQa(fixtures.validPublishInput)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(editorService.publishQa(fixtures.crossWorkspaceCitationInput)).rejects.toMatchObject(
    { code: 'INVALID_CITATION' }
  );
});

it('hides a Q&A immediately when its last valid source is unavailable', async () => {
  await service.invalidatePublishedQaSources({
    workspaceId: fixtures.teamAId,
    documentId: fixtures.documentId,
    revisionId: fixtures.revisionId,
  });
  await expect(
    service.searchPublishedQa({ workspaceId: fixtures.teamAId, query: 'decision' })
  ).resolves.toEqual([]);
});
```

- [ ] **Step 2: Run the service test and verify it fails**

Run: `pnpm --filter @knowledge/web test -- src/features/published-qa/service.test.ts`

Expected: FAIL because `publishQa` is missing.

- [ ] **Step 3: Implement transactional publishing and source invalidation**

```ts
// apps/web/src/features/published-qa/service.ts
import {
  PublishedQaImpactSchema,
  PublishQaInputSchema,
  type PublishQaInput,
} from '@knowledge/domain';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireWorkspaceCapability } from '@/lib/workspaces/access';

export type PublishedQaImpact = {
  hiddenQaIds: string[];
  withdrawnQaIds: string[];
  remainingValidCitationCounts: Record<string, number>;
};

export type PublishedQaSummary = {
  id: string;
  title: string;
  answerJson: Record<string, unknown>;
  citationCount: number;
  updatedAt: string;
};

export async function publishQa(raw: PublishQaInput): Promise<{ publishedQaId: string }> {
  const input = PublishQaInputSchema.parse(raw);
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceCapability(client, input.workspaceId, 'qa.publish');
  const { data, error } = await client.rpc('publish_verified_qa', {
    p_workspace_id: context.workspaceId,
    p_owner_user_id: context.userId,
    p_conversation_id: input.conversationId,
    p_message_id: input.messageId,
    p_title: input.title,
    p_answer_json: input.answerJson,
    p_citation_ids: input.citationIds,
  });
  if (error) throw mapDatabaseError(error);
  return { publishedQaId: data };
}

export async function updatePublishedQa(input: {
  workspaceId: string;
  publishedQaId: string;
  title: string;
  answerJson: Record<string, unknown>;
}): Promise<void> {
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceCapability(client, input.workspaceId, 'qa.publish');
  const { error } = await client.rpc('update_published_qa', {
    p_workspace_id: context.workspaceId,
    p_published_qa_id: input.publishedQaId,
    p_title: input.title,
    p_answer_json: input.answerJson,
  });
  if (error) throw mapDatabaseError(error);
}

export async function withdrawPublishedQa(input: {
  workspaceId: string;
  publishedQaId: string;
}): Promise<void> {
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceCapability(client, input.workspaceId, 'qa.publish');
  const { error } = await client.rpc('withdraw_published_qa', {
    p_workspace_id: context.workspaceId,
    p_published_qa_id: input.publishedQaId,
  });
  if (error) throw mapDatabaseError(error);
}

export async function searchPublishedQa(input: {
  workspaceId: string;
  query: string;
  limit?: number;
}): Promise<PublishedQaSummary[]> {
  const client = await createServerSupabaseClient();
  await requireWorkspaceCapability(client, input.workspaceId, 'documents.read');
  const { data, error } = await client.rpc('search_published_qa', {
    p_workspace_id: input.workspaceId,
    p_query: input.query.trim(),
    p_limit: input.limit ?? 20,
  });
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    answerJson: row.answer_json,
    citationCount: row.citation_count,
    updatedAt: row.updated_at,
  }));
}

export async function invalidatePublishedQaSources(input: {
  workspaceId: string;
  documentId: string;
  revisionId: string;
}): Promise<PublishedQaImpact> {
  const client = await createServerSupabaseClient();
  await requireWorkspaceCapability(client, input.workspaceId, 'documents.trash');
  const { data, error } = await client.rpc('invalidate_published_qa_sources', {
    p_workspace_id: input.workspaceId,
    p_document_id: input.documentId,
    p_revision_id: input.revisionId,
  });
  if (error) throw mapDatabaseError(error);
  return PublishedQaImpactSchema.parse(data);
}
```

The `publish_verified_qa` security-definer RPC must fix `search_path`, revoke execution from `public`, verify active membership and role, verify the private conversation/message owner equals `auth.uid()`, verify every citation joins a current team-visible chunk in the same workspace, copy only the edited title/answer and citation snapshot, assign contiguous ordinals, set `search_text`, append an audit event, and never copy a conversation identifier into `published_qas`. Define `update_published_qa`, `withdraw_published_qa`, `search_published_qa`, and `invalidate_published_qa_sources` with the same fixed path and grants. Search returns only active-member rows with `status='published'` and at least one `source_status='valid'` citation. Source invalidation marks Q&A `hidden_source_invalid` immediately when any source is trashed or superseded; it sets affected citation `source_status='unavailable'`, nulls `chunk_id`, clears any excerpt-like fields, and retains only `{title,locator}` snapshots. Zero remaining valid citations changes status to `withdrawn`. Author edit/withdraw is allowed while membership is active; Owner/Admin can manage every Q&A. Plan 05 calls this operation before permanent source purge, so the citation FK never blocks bounded cleanup.

- [ ] **Step 4: Run service, SQL lifecycle, and dialog tests**

Run: `pnpm --filter @knowledge/web test -- src/features/published-qa && pnpm test:db`

Expected: PASS; publish copies only verified citations, private chat remains unreadable, trashed sources hide Q&A, and zero evidence withdraws it.

- [ ] **Step 5: Commit Q&A publishing**

```bash
git add apps/web/src/features/published-qa apps/web/src/app/\(workspace\) supabase/migrations/0008_conversations_collaboration.sql supabase/tests/0008_published_qa_lifecycle.test.sql
git commit -m "feat: publish verified team questions and answers"
```

### Task 5: Optimistic Summary and Note Editing

**Files:**

- Create: `apps/web/src/features/content/service.ts`
- Create: `apps/web/src/features/content/service.test.ts`
- Create: `apps/web/src/features/content/draft-store.ts`
- Create: `apps/web/src/features/content/draft-store.test.ts`
- Create: `apps/web/src/features/content/components/derived-content-editor.tsx`
- Create: `apps/web/src/features/content/components/conflict-resolver.tsx`
- Create: `apps/web/src/features/content/components/revision-history.tsx`
- Create: `apps/web/src/features/content/components/derived-content-editor.test.tsx`
- Modify: `supabase/migrations/0008_conversations_collaboration.sql`

**Interfaces:**

- Consumes: `SaveContentInput`, `ContentConflict`, `knowledge.write`, the Plan 03 summary record, and Task 1 note/content-revision tables.
- Produces: `saveContent(input): Promise<SaveContentResult>`, `saveConflictCopy(input): Promise<{ noteId: string }>`, and `createDraftStore(storage): DraftStore`.

- [ ] **Step 1: Write failing concurrency and retention tests**

```ts
// apps/web/src/features/content/service.test.ts
it('returns both versions instead of overwriting a newer edit', async () => {
  const first = await service.saveContent({
    ...fixtures.noteSave,
    expectedVersion: 1,
    bodyJson: { text: 'A' },
  });
  expect(first).toMatchObject({ kind: 'saved', version: 2 });
  const stale = await service.saveContent({
    ...fixtures.noteSave,
    expectedVersion: 1,
    bodyJson: { text: 'B' },
  });
  expect(stale).toEqual({
    kind: 'version_conflict',
    expectedVersion: 1,
    currentVersion: 2,
    currentBodyJson: { text: 'A' },
  });
});

// apps/web/src/features/content/draft-store.test.ts
it('retains a scoped failed draft for 24 hours and expires it afterwards', () => {
  const clock = fakeClock('2026-09-02T00:00:00Z');
  const store = createDraftStore(memoryStorage(), clock.now);
  store.put({ userId: 'u1', workspaceId: 'w1', contentId: 'n1', bodyJson: { text: 'offline' } });
  clock.advance({ hours: 23, minutes: 59 });
  expect(store.get({ userId: 'u1', workspaceId: 'w1', contentId: 'n1' })).toBeTruthy();
  clock.advance({ minutes: 2 });
  expect(store.get({ userId: 'u1', workspaceId: 'w1', contentId: 'n1' })).toBeNull();
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm --filter @knowledge/web test -- src/features/content/service.test.ts src/features/content/draft-store.test.ts src/features/content/components/derived-content-editor.test.tsx`

Expected: FAIL because the content service, draft store, and editor do not exist.

- [ ] **Step 3: Implement compare-and-swap saves and two-second autosave**

```ts
// apps/web/src/features/content/service.ts
export type SaveContentResult =
  { kind: 'saved'; version: number; updatedAt: string } | ContentConflict;

export async function saveContent(raw: SaveContentInput): Promise<SaveContentResult> {
  const input = SaveContentInputSchema.parse(raw);
  const client = await createServerSupabaseClient();
  await requireWorkspaceCapability(client, input.workspaceId, 'knowledge.write');
  const { data, error } = await client.rpc('save_versioned_content', {
    p_workspace_id: input.workspaceId,
    p_content_type: input.contentType,
    p_content_id: input.contentId,
    p_expected_version: input.expectedVersion,
    p_body_json: input.bodyJson,
  });
  if (error) throw mapDatabaseError(error);
  return data as SaveContentResult;
}

export async function saveConflictCopy(input: SaveContentInput): Promise<{ noteId: string }> {
  const parsed = SaveContentInputSchema.parse(input);
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceCapability(client, parsed.workspaceId, 'knowledge.write');
  const { data, error } = await client.rpc('create_conflict_copy', {
    p_workspace_id: context.workspaceId,
    p_source_content_type: parsed.contentType,
    p_source_content_id: parsed.contentId,
    p_body_json: parsed.bodyJson,
  });
  if (error) throw mapDatabaseError(error);
  return { noteId: data };
}
```

```ts
// apps/web/src/features/content/draft-store.ts
const RETENTION_MS = 24 * 60 * 60 * 1_000;
const keyOf = (k: { userId: string; workspaceId: string; contentId: string }) =>
  `knowledge-draft:${k.userId}:${k.workspaceId}:${k.contentId}`;
export function createDraftStore(storage: Storage, now = Date.now) {
  return {
    put(input: {
      userId: string;
      workspaceId: string;
      contentId: string;
      bodyJson: Record<string, unknown>;
    }) {
      storage.setItem(
        keyOf(input),
        JSON.stringify({ bodyJson: input.bodyJson, expiresAt: now() + RETENTION_MS })
      );
    },
    get(key: { userId: string; workspaceId: string; contentId: string }) {
      const raw = storage.getItem(keyOf(key));
      if (!raw) return null;
      const draft = JSON.parse(raw) as { bodyJson: Record<string, unknown>; expiresAt: number };
      if (draft.expiresAt <= now()) {
        storage.removeItem(keyOf(key));
        return null;
      }
      return draft.bodyJson;
    },
    remove(key: { userId: string; workspaceId: string; contentId: string }) {
      storage.removeItem(keyOf(key));
    },
  };
}
```

Implement `save_versioned_content` as a fixed-search-path RPC that locks the target row, validates the target table from the two-value enum, compares `version`, and, for `content_type='summary'`, first calls Plan 03's `review_derived_artifact` logic inside the same transaction to create a manual artifact with preserved authoritative evidence and update the summary projection. It then inserts the previous and new bodies into `content_revisions` using `(workspace_id,content_type,content_id,version)`, increments the target version, records `updated_by`, and returns a structured conflict without mutation when versions differ. `create_conflict_copy` creates a new note labeled as a conflict copy and never mutates the contested summary/note. The editor debounces for 2,000 ms after input stops; announces “保存中 / 已保存 / 保存失败”; writes the scoped draft before the request; clears it only after success; and on conflict offers exactly Refresh, Compare, and Keep as copy. Add a database test that a summary save has both a manual `derived_artifact` and a matching `content_revisions` row, while a stale summary save creates neither.

- [ ] **Step 4: Run service, component, and database concurrency tests**

Run: `pnpm --filter @knowledge/web test -- src/features/content && pnpm test:db`

Expected: PASS; simultaneous saves yield one version 2 and one conflict, revision history is append-only, viewer writes fail, and failed drafts survive reload.

- [ ] **Step 5: Commit versioned collaborative content**

```bash
git add apps/web/src/features/content supabase/migrations/0008_conversations_collaboration.sql supabase/tests/0008_chat_collaboration_rls.test.sql
git commit -m "feat: add conflict-safe collaborative content"
```

### Task 6: Comments and RLS-Protected Realtime Updates

**Files:**

- Create: `apps/web/src/features/comments/service.ts`
- Create: `apps/web/src/features/comments/service.test.ts`
- Create: `apps/web/src/features/comments/use-comments-channel.ts`
- Create: `apps/web/src/features/comments/use-comments-channel.test.tsx`
- Create: `apps/web/src/features/comments/components/comment-thread.tsx`
- Create: `apps/web/src/features/comments/components/comment-thread.test.tsx`
- Modify: `apps/web/src/features/documents/components/document-detail.tsx`
- Modify: `supabase/migrations/0008_conversations_collaboration.sql`

**Interfaces:**

- Consumes: `comments` table from Task 1, `comments.write`, active membership, document detail from Plan 02, and the isolated Supabase browser client from Plan 01.
- Produces: `listComments(input): Promise<Comment[]>`, `createComment(input): Promise<Comment>`, `editOwnComment(input): Promise<Comment>`, and `useCommentsChannel(input): CommentChannelState`.

- [ ] **Step 1: Write failing permission and subscription-cleanup tests**

```tsx
// apps/web/src/features/comments/use-comments-channel.test.tsx
it('removes cached comments and unsubscribes when membership is revoked', async () => {
  const realtime = createFakeRealtime();
  const { result, unmount } = renderHook(() =>
    useCommentsChannel({
      workspaceId: 'w1',
      documentId: 'd1',
      initialComments: [fixtures.comment],
      realtime,
    })
  );
  act(() => realtime.emitMembershipRevoked('w1'));
  expect(result.current.comments).toEqual([]);
  expect(result.current.status).toBe('forbidden');
  unmount();
  expect(realtime.removeChannel).toHaveBeenCalledTimes(2);
});
```

```ts
// apps/web/src/features/comments/service.test.ts
it('allows editors but denies viewers and cross-workspace document ids', async () => {
  await expect(editorService.createComment(fixtures.teamAComment)).resolves.toMatchObject({
    body: 'Clear evidence',
  });
  await expect(viewerService.createComment(fixtures.teamAComment)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(editorService.createComment(fixtures.teamBTarget)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  await expect(
    editorService.editOwnComment({
      ...fixtures.teamAComment,
      commentId: fixtures.comment.id,
      body: 'Updated evidence',
    })
  ).resolves.toMatchObject({ body: 'Updated evidence' });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm --filter @knowledge/web test -- src/features/comments`

Expected: FAIL because comment commands and the channel hook are missing.

- [ ] **Step 3: Implement comment commands and membership-aware subscriptions**

```ts
// apps/web/src/features/comments/service.ts
export async function createComment(input: {
  workspaceId: string;
  documentId: string;
  body: string;
}): Promise<Comment> {
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceCapability(client, input.workspaceId, 'comments.write');
  const body = z.string().trim().min(1).max(4_000).parse(input.body);
  const { data, error } = await client
    .from('comments')
    .insert({
      workspace_id: context.workspaceId,
      document_id: input.documentId,
      author_user_id: context.userId,
      body,
    })
    .select()
    .single();
  if (error) throw mapDatabaseError(error);
  return mapComment(data);
}

export async function listComments(input: {
  workspaceId: string;
  documentId: string;
}): Promise<Comment[]> {
  const client = await createServerSupabaseClient();
  await requireWorkspaceCapability(client, input.workspaceId, 'documents.read');
  const { data, error } = await client
    .from('comments')
    .select('*')
    .eq('workspace_id', input.workspaceId)
    .eq('document_id', input.documentId)
    .order('created_at');
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapComment);
}

export async function editOwnComment(input: {
  workspaceId: string;
  commentId: string;
  body: string;
}): Promise<Comment> {
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceCapability(client, input.workspaceId, 'comments.write');
  const body = z.string().trim().min(1).max(4_000).parse(input.body);
  const { data, error } = await client
    .from('comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('workspace_id', context.workspaceId)
    .eq('id', input.commentId)
    .eq('author_user_id', context.userId)
    .select()
    .single();
  if (error) throw mapDatabaseError(error);
  return mapComment(data);
}
```

`useCommentsChannel` opens one filtered `postgres_changes` channel for `workspace_id` and `document_id`, plus one membership channel for the current user. It applies insert/update/delete events only after validating both identifiers, clears local comment state and closes both channels on membership loss, and always removes channels on unmount. The document detail renders comments as a normal content section; Viewer sees comments but no composer, while permission errors replace stale content with an access-changed state.

- [ ] **Step 4: Run component tests and RLS tests**

Run: `pnpm --filter @knowledge/web test -- src/features/comments && pnpm test:db`

Expected: PASS; Editor comments propagate, Viewer and team B writes are denied, and a revoked member receives no further local updates.

- [ ] **Step 5: Commit comments and realtime behavior**

```bash
git add apps/web/src/features/comments apps/web/src/features/documents/components/document-detail.tsx supabase/migrations/0008_conversations_collaboration.sql
git commit -m "feat: add permission-aware comments and realtime updates"
```

### Task 7: Cross-Role Chat and Collaboration End-to-End Gate

**Files:**

- Create: `tests/e2e/chat-collaboration.spec.ts`
- Create: `tests/e2e/fixtures/chat-collaboration.ts`
- Create: `tests/e2e/helpers/sse.ts`
- Modify: `tests/e2e/global-setup.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: authenticated role fixtures from Plan 01; READY searchable documents from Plan 02; reviewed graph knowledge from Plan 03; all Tasks 1–6 in this plan.
- Produces: `pnpm test:e2e:chat-collaboration`, the acceptance gate required before Plan 05.

- [ ] **Step 1: Write the failing end-to-end journey**

```ts
// tests/e2e/chat-collaboration.spec.ts
test.describe('chat and collaboration security gate', () => {
  test('private grounded chat stays private and publishes only an edited team asset', async ({
    browser,
  }) => {
    const editor = await loginAs(browser, 'teamAEditor');
    await editor.goto(`/w/${fixtures.teamAId}/chat`);
    await editor.getByRole('textbox', { name: '向资料提问' }).fill(fixtures.groundedQuestion);
    await editor.getByRole('button', { name: '发送' }).click();
    await expect(editor.getByRole('button', { name: /打开引用 \[1\]/ })).toBeVisible();
    await editor.getByRole('button', { name: '发布为团队问答' }).click();
    await editor.getByLabel('标题').fill('已确认的项目决定');
    await editor.getByRole('button', { name: '确认发布' }).click();

    const admin = await loginAs(browser, 'teamAAdmin');
    await admin.goto(`/w/${fixtures.teamAId}/chat/${fixtures.editorConversationId}`);
    await expect(admin.getByText('你无权查看此私密对话')).toBeVisible();
    await admin.goto(`/w/${fixtures.teamAId}/qa`);
    await expect(admin.getByText('已确认的项目决定')).toBeVisible();
    await expect(admin.getByText(fixtures.privateSiblingMessage)).toHaveCount(0);
  });

  test('revocation stops a stream and conflict never overwrites', async ({ browser }) => {
    const editor = await loginAs(browser, 'teamAEditor');
    await startSlowAnswer(editor);
    await removeMemberViaAdmin(browser, 'teamAEditor');
    await expect(editor.getByText('权限已变更')).toBeVisible();
    await expect(editor.getByText(fixtures.postRevocationSecret)).toHaveCount(0);
    await assertConcurrentNoteConflict(browser);
  });
});
```

- [ ] **Step 2: Run the journey and verify it fails before fixture wiring**

Run: `pnpm exec playwright test tests/e2e/chat-collaboration.spec.ts --project=chromium`

Expected: FAIL because the deterministic SSE and role/data fixtures are not registered.

- [ ] **Step 3: Add deterministic fixtures and the dedicated command**

```json
// package.json scripts excerpt
{
  "scripts": {
    "test:e2e:chat-collaboration": "playwright test tests/e2e/chat-collaboration.spec.ts --project=chromium"
  }
}
```

The seed creates four users and two unrelated teams, one READY document and one malicious-instruction document per team, and fixed citation locators. The SSE helper delays provider frames so removal can occur mid-answer. Add assertions for: Viewer can create a private chat but cannot publish/edit/comment; Admin cannot read member chat; team B cannot guess team A message or citation IDs; insufficient evidence returns the grounded refusal; a trashed citation hides Q&A; reconnect after permission removal fetches no stale response; autosave conflict offers all three recovery choices; keyboard-only composer, citation drawer, publish dialog, and conflict dialog flows complete.

- [ ] **Step 4: Run the vertical-slice gate**

Run: `pnpm test && pnpm test:db && pnpm test:e2e:chat-collaboration`

Expected: PASS with zero unauthorized rows or source excerpts visible; all unit, database, and chat/collaboration end-to-end tests are green.

- [ ] **Step 5: Commit the acceptance gate**

```bash
git add tests/e2e/chat-collaboration.spec.ts tests/e2e/fixtures/chat-collaboration.ts tests/e2e/helpers/sse.ts tests/e2e/global-setup.ts package.json
git commit -m "test: gate private chat and collaboration flows"
```

---

## Detailed Acceptance Testing Matrix

Before proceeding to Plan 05, verify all private chat, grounded responses, citation authorization, team Q&A publishing, collaboration features, and permission enforcement through this comprehensive test matrix:

| Test Category                 | Test Case                       | Acceptance Criteria                                |
| ----------------------------- | ------------------------------- | -------------------------------------------------- |
| **Private Chat Privacy**      | User creates private chat       | Conversation visible only to creator               |
|                               | Admin cannot access             | Admin API/UI request returns 403                   |
|                               | Owner cannot access             | Owner API/UI request returns 403 (unless creator)  |
|                               | Team member list privacy        | Cannot enumerate other members' private chats      |
|                               | Cross-workspace isolation       | Team B cannot guess Team A conversation IDs        |
| **Grounded Chat Correctness** | Sufficient evidence             | Returns answer with valid citations                |
|                               | Insufficient evidence           | Returns refusal message, no hallucination          |
|                               | Citation formatting             | [1], [2] format, clickable, opens drawer           |
|                               | Citation workspace match        | All cited chunks belong to same workspace          |
|                               | Citation authorization          | Real-time permission check before showing source   |
| **Citation Authorization**    | Active member access            | Can view cited source text and location            |
|                               | Removed member access           | Citation shows "unavailable", no source text       |
|                               | Trashed document citation       | Citation marked historical/unavailable             |
|                               | Superseded revision citation    | Shows warning, links to current version            |
|                               | Cross-workspace citation        | Never returned (filtered before ranking)           |
| **Streaming & Revocation**    | Mid-stream revocation           | Stream stops immediately, no later frames          |
|                               | Revocation UI feedback          | "权限已变更" message displayed                     |
|                               | Post-revocation content hidden  | Secret content after revocation not visible        |
|                               | Realtime unsubscribe            | Channel unsubscribed on permission loss            |
| **Team Q&A Publishing**       | Editor publishes                | Creates team-visible Q&A asset                     |
|                               | Viewer cannot publish           | Publish button hidden, API returns 403             |
|                               | Source chat remains private     | Original conversation still private                |
|                               | Only edited content copied      | User edits preserved, system prompts excluded      |
|                               | Valid evidence only             | Invalid citations removed before publish           |
|                               | Title required                  | Cannot publish without user-provided title         |
| **Q&A Source Invalidation**   | Document trashed                | Q&A marked as "evidence unavailable"               |
|                               | Document deleted                | Q&A flagged, source links removed                  |
|                               | Revision superseded             | Q&A shows "outdated evidence" warning              |
|                               | Member removed                  | Q&A remains, creator name anonymized               |
| **Versioned Summaries**       | Create summary                  | Version 1 saved with created_by                    |
|                               | Edit summary                    | Version increments, updated_by recorded            |
|                               | Concurrent edit protection      | Version conflict detected                          |
|                               | Version history access          | Can view prior versions (Owner/Admin/Editor)       |
| **Versioned Notes**           | Create note                     | Linked to document/revision, version 1             |
|                               | Edit note                       | Version increments with timestamp                  |
|                               | Concurrent conflict             | Offers merge/overwrite/keep both                   |
|                               | 24-hour draft retention         | Failed save recoverable for 24 hours               |
| **Comments**                  | Create comment                  | Thread attached to document                        |
|                               | Reply to comment                | Nested thread structure                            |
|                               | Edit own comment                | Only creator can edit                              |
|                               | Delete own comment              | Only creator can delete                            |
|                               | Viewer cannot comment           | Comment form hidden, API returns 403               |
| **Collaboration Realtime**    | Summary update broadcast        | Other users see live updates                       |
|                               | Note update broadcast           | Changes streamed to active viewers                 |
|                               | Comment notification            | New comments appear without refresh                |
|                               | Membership change               | Realtime unsubscribe on removal                    |
|                               | Channel isolation               | Team A updates not sent to Team B                  |
| **Autosave & Draft Recovery** | 2-second autosave               | Content saved after 2s inactivity                  |
|                               | Failed save draft               | Stored locally for 24 hours                        |
|                               | Draft recovery UI               | Prompts user to recover on next visit              |
|                               | Network failure resilience      | Retries failed saves with backoff                  |
| **Conflict Resolution**       | Concurrent summary edit         | Conflict dialog with 3 choices                     |
|                               | Keep local                      | Discards remote, increments version                |
|                               | Keep remote                     | Discards local, stays on remote version            |
|                               | Keep both                       | Creates separate copy with suffix                  |
|                               | Conflict audit                  | All conflict resolutions logged                    |
| **Permission Enforcement**    | Owner chat & collab             | Full access to all features                        |
|                               | Admin chat & collab             | Full access to all features                        |
|                               | Editor chat & collab            | Full access except user management                 |
|                               | Viewer private chat             | Can create private chat only                       |
|                               | Viewer shared content           | Cannot publish Q&A, edit summaries/notes, comment  |
|                               | Viewer API enforcement          | Server-side rejection of write operations          |
| **Database Security**         | RLS on conversations            | Row-level security enforced                        |
|                               | RLS on messages                 | Only creator or authorized can read                |
|                               | RLS on citations                | Workspace + permission filtered                    |
|                               | RLS on qa_posts                 | Team-scoped, respects member status                |
|                               | RLS on summaries/notes/comments | Workspace + role filtered                          |
|                               | Cross-workspace rejection       | Foreign workspace refs rejected by FK              |
| **Citation Deep-linking**     | Click citation [1]              | Opens drawer with source excerpt                   |
|                               | Jump to source                  | Navigates to exact page/paragraph/char             |
|                               | Locator validation              | All locators conform to SourceLocatorSchema        |
|                               | Historical citation UI          | Greyed out, shows "version superseded"             |
| **Q&A Management**            | List team Q&A                   | Shows all published Q&A in workspace               |
|                               | Filter by author                | Can filter by published_by user                    |
|                               | Filter by date                  | Can filter by created date range                   |
|                               | Search Q&A                      | Full-text search on title and content              |
|                               | Edit Q&A (Owner/Admin)          | Can update title/content, increments version       |
|                               | Withdraw Q&A (Owner/Admin)      | Hides from team, marks withdrawn                   |
| **AI Provider Privacy**       | Chat requests minimal data      | Only relevant chunk text sent                      |
|                               | No sensitive IDs                | workspace_id/member email/paths not sent           |
|                               | store: false                    | All OpenAI chat requests disable storage           |
|                               | Prompt injection defense        | User messages in untrusted data boundary           |
|                               | Citation provenance             | Logs record chunk IDs, not full text               |
| **Local Draft Management**    | IndexedDB storage               | Drafts stored in browser local storage             |
|                               | 24-hour retention               | Drafts auto-expire after 24 hours                  |
|                               | Draft recovery prompt           | Shows on next visit if draft exists                |
|                               | Draft cleanup                   | Expired drafts removed automatically               |
| **End-to-End Integration**    | Full chat flow                  | Question → grounded answer → citation → source     |
|                               | Full Q&A flow                   | Private chat → edit → publish → team visible       |
|                               | Full collab flow                | Create note → concurrent edit → conflict → resolve |
|                               | All four roles                  | Owner, Admin, Editor, Viewer workflows             |
|                               | Two unrelated teams             | Team A content invisible to Team B                 |
|                               | Mid-stream revocation           | Member removed → stream stops → no secrets         |
| **Accessibility**             | Keyboard navigation             | All chat/collab UI keyboard accessible             |
|                               | Screen reader                   | Proper ARIA for messages, citations, conflicts     |
|                               | Focus management                | Logical tab order, visible focus                   |
|                               | Live regions                    | Status updates announced (new message, conflict)   |
|                               | Touch targets                   | Mobile buttons ≥ 44×44px                           |
| **Type Safety & Linting**     | TypeScript strict               | Zero type errors                                   |
|                               | ESLint rules                    | Zero violations                                    |
|                               | Zod validation                  | All chat/collab schemas validate                   |
|                               | Database types                  | Supabase types synchronized                        |

---

## Chat & Collaboration Operations Runbook

### Private Chat Architecture

**Conversation ownership:**

- Each conversation has exactly one `creator_user_id`
- Only creator can read/write their private conversation
- Admin/Owner **cannot** access other members' private chats
- RLS enforces creator_user_id = auth.uid() for SELECT/UPDATE

**Grounded chat flow:**

1. User submits question in private conversation
2. System queries workspace-filtered hybrid search
3. If evidence sufficient → generate answer with citations
4. If evidence insufficient → return refusal message
5. Stream answer with [N] citation markers
6. Store message with citation references (chunk_id, locator)

**Citation authorization:**

- Real-time check: does current user have documents.read on cited document?
- If yes → show source excerpt and location link
- If no (removed/trashed) → show "unavailable" placeholder
- Never expose source text without fresh permission check

### Team Q&A Publishing

**Publishing workflow:**

1. User reviews private chat conversation
2. Edits/refines answer content (removes system prompts, user errors)
3. Provides team-facing title
4. System validates all cited chunks still accessible
5. Invalid citations removed automatically
6. Creates qa_posts record with workspace-scoped visibility
7. Original private conversation remains private

**Q&A visibility:**

- All active workspace members can view published Q&A
- RLS: workspace_id + active membership
- Viewer can read but not create Q&A
- Owner/Admin can edit/withdraw any team Q&A
- Editor can edit own Q&A

### Versioned Content Management

**Summaries:**

```sql
-- Schema
summaries (
  id, workspace_id, document_id, revision_id,
  body_json, version, needs_reconfirmation,
  created_by, updated_by, created_at, updated_at
)
```

- Version starts at 1, increments on each edit
- Concurrent edit detection via expected_version parameter
- needs_reconfirmation flag set when source revision superseded

**Notes:**

```sql
-- Schema
notes (
  id, workspace_id, document_id, revision_id,
  content, version,
  created_by, updated_by, created_at, updated_at
)
```

- Similar versioning to summaries
- 24-hour local draft if save fails
- Conflict resolution: merge/overwrite/keep-both

**Comments:**

```sql
-- Schema
comments (
  id, workspace_id, document_id, parent_comment_id,
  content, created_by, updated_by, created_at, updated_at
)
```

- Threaded: parent_comment_id for replies
- Only creator can edit/delete own comments
- RLS enforces workspace membership

### Realtime Updates

**Channel structure:**

```typescript
// Workspace-scoped channel for collaboration
supabase
  .channel(`workspace:${workspaceId}:collaboration`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'summaries',
      filter: `workspace_id=eq.${workspaceId}`,
    },
    handleSummaryChange
  )
  .subscribe();
```

**Unsubscribe triggers:**

- User explicitly leaves page
- Membership status changed (removed from workspace)
- Workspace deleted/suspended
- Session expired

### Autosave & Draft Recovery

**Autosave timing:**

- 2-second debounce after last keystroke
- Visual indicator: "保存中..." → "已保存" → "" (fade)
- Network failure: retry with exponential backoff (2s, 4s, 8s)

**Local draft storage:**

```typescript
interface LocalDraft {
  workspaceId: string;
  documentId: string;
  contentType: 'summary' | 'note' | 'comment';
  content: string;
  savedAt: number; // timestamp
  expiresAt: number; // savedAt + 24 hours
}
```

**Recovery flow:**

1. On page load, check IndexedDB for drafts
2. If draft exists and not expired → show recovery banner
3. User chooses: "恢复草稿" or "丢弃"
4. Auto-cleanup expired drafts on page load

### Conflict Resolution

**Conflict detection:**

```sql
UPDATE summaries
SET body_json = $1,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now()
WHERE workspace_id = $2
  AND document_id = $3
  AND version = $4  -- expected version from client
RETURNING *;
-- If affected rows = 0 → version conflict
```

**Resolution options:**

1. **Keep Local**: Discard remote, force save with new version
2. **Keep Remote**: Discard local, reload from server
3. **Keep Both**: Save local as "文档标题 (副本)", preserve both versions

**Conflict audit:**

- All resolutions logged to audit_events
- Records: user_id, document_id, resolution_choice, both versions

### Diagnostic Queries

**Check private chat isolation:**

```sql
-- Should return empty (no cross-user access)
SELECT c.id, c.creator_user_id, m.user_id as accessing_user
FROM conversations c
CROSS JOIN memberships m
WHERE c.workspace_id = m.workspace_id
  AND c.creator_user_id <> m.user_id
  AND EXISTS (
    SELECT 1 FROM information_schema.table_privileges tp
    WHERE tp.table_name = 'conversations'
      AND tp.grantee = m.user_id::text
      AND tp.privilege_type = 'SELECT'
  );
-- Should be 0 rows (enforced by RLS)
```

**Find citations to trashed documents:**

```sql
SELECT msg.id as message_id,
       c.conversation_id,
       d.title as cited_document,
       d.lifecycle_state
FROM message_citations mc
JOIN messages msg ON msg.id = mc.message_id
JOIN conversations c ON c.id = msg.conversation_id
JOIN documents d ON d.id = mc.document_id
WHERE mc.workspace_id = '<workspace_id>'
  AND d.lifecycle_state = 'trashed';
-- These citations should show "unavailable" in UI
```

**Find Q&A with invalidated evidence:**

```sql
SELECT qa.id, qa.title,
       (SELECT COUNT(*) FROM qa_citations qac
        JOIN documents d ON d.id = qac.document_id
        WHERE qac.qa_post_id = qa.id
          AND (d.lifecycle_state = 'trashed'
               OR d.current_revision_id <> qac.revision_id)) as invalid_count
FROM qa_posts qa
WHERE qa.workspace_id = '<workspace_id>'
  AND EXISTS (
    SELECT 1 FROM qa_citations qac
    JOIN documents d ON d.id = qac.document_id
    WHERE qac.qa_post_id = qa.id
      AND (d.lifecycle_state = 'trashed'
           OR d.current_revision_id <> qac.revision_id)
  );
-- These Q&A need "outdated evidence" warnings
```

**Check concurrent edit conflicts:**

```sql
SELECT s1.id, s1.document_id, s1.version,
       s1.updated_by, s1.updated_at,
       COUNT(s2.id) as concurrent_versions
FROM summaries s1
LEFT JOIN summaries s2
  ON s2.workspace_id = s1.workspace_id
  AND s2.document_id = s1.document_id
  AND s2.updated_at BETWEEN s1.updated_at - interval '5 seconds'
                        AND s1.updated_at + interval '5 seconds'
  AND s2.id <> s1.id
WHERE s1.workspace_id = '<workspace_id>'
  AND s1.updated_at > now() - interval '1 hour'
GROUP BY s1.id, s1.document_id, s1.version,
         s1.updated_by, s1.updated_at
HAVING COUNT(s2.id) > 0;
-- Shows potential concurrent conflicts
```

### Privacy & Compliance

**Operators MUST:**

- Diagnose using: conversation_id, message_id, qa_post_id, citation_id, workspace_id
- Query metadata: conversations, messages (exclude content), qa_posts (exclude body)

**Operators MUST NOT:**

- Read private conversation message content
- Read chat prompts or AI responses
- Access citation source text without permission
- Copy member questions/answers to tickets/logs

**Log redaction:**

- Logs MAY: conversation_id, user_id, workspace_id, error codes, citation_id
- Logs MUST NOT: message.content, qa_post.body, chunk.text, member emails

### Performance Monitoring

**Key metrics:**

- Chat Time-To-First-Chunk (TTFC): p50 < 3s, p95 < 8s
- Autosave latency: p95 < 500ms
- Realtime message latency: p95 < 1s
- Conflict detection time: < 100ms
- Draft recovery load: < 200ms

**Alert thresholds:**

- TTFC p95 > 8 seconds
- Autosave failure rate > 1%
- Realtime disconnect rate > 5%
- Concurrent conflict rate > 2%

---

## Plan Completion Gate

Do not begin Plan 05 until all of these statements are demonstrated by automated tests or runbook exercise:

**Private Chat Privacy**

- [ ] User private conversations visible only to creator
- [ ] Admin/Owner cannot access other members' private chats (403 via API/UI)
- [ ] Cannot enumerate other members' conversation IDs
- [ ] Cross-workspace conversation IDs cannot be guessed or accessed
- [ ] RLS enforces creator_user_id = auth.uid() for all conversation reads
- [ ] Browser bundle contains no privileged credentials or AI provider keys

**Grounded Chat Correctness**

- [ ] Sufficient evidence → answer with valid [N] citations
- [ ] Insufficient evidence → refusal message, no hallucination
- [ ] Citations formatted as clickable [1], [2] markers
- [ ] All cited chunks belong to same workspace
- [ ] Citation source text requires fresh permission check
- [ ] Empty/invalid citations never generate answers

**Citation Authorization & Invalidation**

- [ ] Active member can view cited source and location
- [ ] Removed member sees "unavailable", no source text
- [ ] Trashed document citation marked historical/unavailable
- [ ] Superseded revision citation shows warning, links current
- [ ] Cross-workspace citations never returned (filtered pre-ranking)
- [ ] Real-time auth check before showing each citation source

**Streaming & Mid-Stream Revocation**

- [ ] Member removal stops stream immediately
- [ ] No post-revocation secret frames rendered
- [ ] "权限已变更" message displayed on revocation
- [ ] Realtime channel unsubscribed before later private frames
- [ ] Stream cancellation token propagates to provider

**Team Q&A Publishing**

- [ ] Editor can publish edited private chat as team Q&A
- [ ] Viewer publish button hidden, API returns 403
- [ ] Original source conversation remains private after publish
- [ ] Only user-edited content copied (no system prompts)
- [ ] Invalid citations automatically removed before publish
- [ ] Title required, cannot publish without user input
- [ ] Published Q&A visible to all active workspace members

**Q&A Source Invalidation**

- [ ] Trashed document → Q&A marked "evidence unavailable"
- [ ] Deleted document → Q&A flagged, source links removed
- [ ] Superseded revision → Q&A shows "outdated evidence" warning
- [ ] Member removed → Q&A remains, creator name anonymized

**Versioned Summaries**

- [ ] Create summary: version 1, created_by recorded
- [ ] Edit summary: version increments, updated_by recorded
- [ ] Concurrent edit: version conflict detected via expected_version
- [ ] Version history: can view prior versions (Editor+)
- [ ] needs_reconfirmation flag set when revision superseded

**Versioned Notes**

- [ ] Create note: linked to document/revision, version 1
- [ ] Edit note: version increments with timestamp
- [ ] Concurrent conflict: offers merge/overwrite/keep-both options
- [ ] 24-hour draft retention: failed save recoverable locally
- [ ] Draft recovery prompt shown on next visit

**Comments**

- [ ] Create comment: thread attached to document
- [ ] Reply to comment: nested thread structure maintained
- [ ] Edit own comment: only creator can edit
- [ ] Delete own comment: only creator can delete
- [ ] Viewer comment form hidden, API returns 403

**Collaboration Realtime**

- [ ] Summary updates broadcast to active viewers
- [ ] Note updates streamed to concurrent editors
- [ ] New comments appear without manual refresh
- [ ] Membership change triggers Realtime unsubscribe
- [ ] Team A updates not sent to Team B channels

**Autosave & Draft Recovery**

- [ ] 2-second debounce autosave after inactivity
- [ ] Visual indicator: "保存中..." → "已保存" (fade)
- [ ] Network failure: exponential backoff retry (2s, 4s, 8s)
- [ ] Local draft stored in IndexedDB for 24 hours
- [ ] Recovery banner prompts user on next visit
- [ ] Expired drafts auto-cleaned on page load

**Conflict Resolution**

- [ ] Concurrent summary edit detected via version mismatch
- [ ] Conflict dialog offers 3 choices: local/remote/both
- [ ] Keep local: discards remote, increments version
- [ ] Keep remote: discards local, reloads from server
- [ ] Keep both: creates separate copy with suffix
- [ ] All conflict resolutions logged to audit_events

**Permission Enforcement**

- [ ] Owner: full access to all chat & collaboration features
- [ ] Admin: full access to all chat & collaboration features
- [ ] Editor: full access except cannot manage members
- [ ] Viewer: private chat only, no publish/edit summaries/notes/comments
- [ ] Viewer write attempts rejected server-side with 403
- [ ] Database RLS enforces role-based access on all tables

**Database Security**

- [ ] RLS enabled on conversations, messages, citations, qa_posts, summaries, notes, comments
- [ ] conversations RLS: creator_user_id = auth.uid() for private
- [ ] messages RLS: via conversation ownership
- [ ] qa_posts RLS: workspace + active membership
- [ ] summaries/notes/comments RLS: workspace + role
- [ ] Cross-workspace foreign key violations rejected
- [ ] Direct SQL mutations blocked by RLS for non-members

**Citation Deep-linking**

- [ ] Click [1] opens drawer with source excerpt
- [ ] "Jump to source" navigates to exact locator
- [ ] All locators conform to SourceLocatorSchema
- [ ] Historical citations greyed out with "version superseded"
- [ ] Unavailable citations show placeholder, no text

**Q&A Management**

- [ ] List all team Q&A in workspace
- [ ] Filter by author (published_by)
- [ ] Filter by date range
- [ ] Full-text search on title and content
- [ ] Owner/Admin can edit/update Q&A (version increments)
- [ ] Owner/Admin can withdraw Q&A (hides from team)

**AI Provider Privacy**

- [ ] Chat requests send only relevant chunk text
- [ ] No workspace_id, member email, or object paths sent
- [ ] OpenAI chat requests use `store: false`
- [ ] User messages in untrusted data boundary (not system prompt)
- [ ] Citation provenance logs chunk IDs, not full text

**Local Draft Management**

- [ ] Drafts stored in browser IndexedDB
- [ ] 24-hour retention policy enforced
- [ ] Recovery prompt on next visit if draft exists
- [ ] Expired drafts removed automatically
- [ ] Draft sync across browser tabs (same user)

**End-to-End Integration**

- [ ] Full chat flow: question → grounded answer → citation → source jump
- [ ] Full Q&A flow: private chat → edit → publish → team visible
- [ ] Full collaboration flow: create note → concurrent edit → conflict → resolve
- [ ] All four roles: Owner, Admin, Editor, Viewer workflows tested
- [ ] Two unrelated teams: Team A content invisible to Team B
- [ ] Mid-stream revocation: remove member → stream stops → no secrets exposed

**Database Test Coverage (pgTAP)**

- [ ] RLS tests: private chat isolation, cross-user denial, cross-workspace rejection
- [ ] Permission tests: Viewer write rejection, Editor publish success
- [ ] Citation authorization tests: trashed/superseded document handling
- [ ] Versioning tests: concurrent conflict detection, version increment
- [ ] Realtime tests: channel isolation, unsubscribe on removal

**Unit & Integration Test Coverage**

- [ ] Grounded chat provider tests (sufficient/insufficient evidence)
- [ ] Citation extraction tests (chunk ID resolution, locator validation)
- [ ] Q&A publishing tests (privacy preservation, invalid citation removal)
- [ ] Autosave tests (debounce, retry, draft storage)
- [ ] Conflict resolution tests (merge/overwrite/keep-both logic)
- [ ] Realtime event tests (broadcast, filtering, unsubscribe)

**Accessibility**

- [ ] Keyboard navigation: all chat/collab UI keyboard accessible
- [ ] Screen reader: ARIA for messages, citations, conflicts
- [ ] Focus management: logical tab order, visible indicators
- [ ] Live regions: status updates announced ("new message", "conflict detected")
- [ ] Touch targets: mobile buttons ≥ 44×44px
- [ ] Reduced motion: respects prefers-reduced-motion

**Type Safety & Linting**

- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero violations
- [ ] All Zod schemas validate chat/collab input/output
- [ ] Database types synchronized via `pnpm db:types`
- [ ] No `any` types in chat/collaboration code paths

**Operational Readiness**

- [ ] Runbook documents private chat isolation verification
- [ ] Citation authorization diagnostic queries provided
- [ ] Q&A invalidation monitoring queries documented
- [ ] Conflict resolution audit trail queries provided
- [ ] Autosave failure detection and recovery documented
- [ ] Realtime disconnect monitoring configured
- [ ] Privacy compliance: log redaction rules enforced
