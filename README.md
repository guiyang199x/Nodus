# AI Knowledge Base

Multi-user AI knowledge workspace: private personal spaces, team workspaces, document processing, hybrid search, and grounded chat.

This repository is a pnpm monorepo. [Plan 01 — Foundation](docs/superpowers/plans/2026-09-02-ai-knowledge-base-01-foundation.md) Tasks 1–2 are done: shared contracts are locked and the identity/workspace schema with its single-Owner invariant is migrated and covered by pgTAP. Task 3 (RLS and audited RPCs) is next.

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm 9+
- Docker (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## Repository layout

```text
apps/web/src             Next.js UI (app/, lib/supabase/ isolate @supabase/ssr)
apps/worker              Long-running document worker
packages/domain          Shared Zod contracts (roles, uploads, DB types)
packages/ai              Provider-neutral AI adapters (Plans 02–04)
packages/observability   Redacted logs, traces, metrics (Plan 05)
packages/test-fixtures   Synthetic test data only
supabase/                Local Auth, Postgres, Storage, migrations, pgTAP tests
tests/                   e2e, security, accessibility, AI evals
```

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm db:start
# Copy API URL, anon key, service role key, and DB URL from `supabase status` into .env.local
node scripts/verify-env.js
```

See [`.env.README.md`](.env.README.md) for every variable.

## Common commands

```bash
pnpm dev:web          # Next.js at http://localhost:3000
pnpm dev:worker       # Worker (Plan 02 implementation still pending)
pnpm lint
pnpm typecheck
pnpm test
pnpm verify           # lint + typecheck + unit tests
pnpm db:status
pnpm db:reset
```

## Shared contracts

`@knowledge/domain` currently exports:

- Workspace roles, capabilities, and `hasCapability(role, capability)`
- Upload batch parsing: 7 formats, 20 files per batch, 50 MB per file
- Generated database types via `pnpm db:types`, produced from migrations `0001`–`0002`

## Documentation

- [Project summary](docs/PROJECT-SUMMARY.md)
- [Implementation guide](docs/implementation-guide.md)
- [Daily execution](docs/daily-execution-guide.md)
- [Master plan](docs/superpowers/plans/2026-09-02-ai-knowledge-base-master.md)
