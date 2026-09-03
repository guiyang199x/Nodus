# @knowledge/domain

Shared Zod contracts for workspace roles, upload limits, and generated database types.

## Purpose

- Workspace roles, capabilities, and `hasCapability(role, capability)`
- Upload batch parsing: 7 formats, 20 files per batch, 50 MB per file
- Database types generated from Supabase (`pnpm db:types`)

## Usage

```typescript
import { hasCapability, parseUploadBatch } from '@knowledge/domain';
import type { Database } from '@knowledge/domain/database';

hasCapability('editor', 'documents.upload'); // true
parseUploadBatch({
  workspaceId: '11111111-1111-4111-8111-111111111111',
  files: [{ name: 'notes.md', size: 12, declaredMime: 'text/markdown' }],
});
```

## Structure

```
packages/domain/
├── src/
│   ├── index.ts            # Public exports
│   ├── workspaces.ts       # Roles, capabilities, action results
│   ├── uploads.ts          # Upload batch contract
│   └── database.types.ts   # Generated Supabase types
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Type Generation

Database types are generated from the local Supabase schema:

```bash
pnpm db:types
```

This runs: `supabase gen types typescript --local > packages/domain/src/database.types.ts`

## Development

```bash
pnpm --filter @knowledge/domain typecheck
pnpm --filter @knowledge/domain test
```
