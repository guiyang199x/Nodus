# AI Knowledge Base 01 — Identity and Security Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可独立验收的身份与安全底座：用户可通过邮箱验证码或 Google 登录，自动拥有私密个人空间，可创建和加入团队空间，并在数据库、服务端与 Private Storage 三层执行一致的角色权限和定向上传会话。

**Architecture:** 使用 pnpm monorepo 承载 Next.js Web 与共享领域契约；Supabase Auth 负责身份，Postgres/RLS 是工作区成员关系和权限事实来源，所有成员变更经受审计的 RPC 完成。浏览器只拿到固定对象路径的短时上传令牌，服务端先持久化 Document、Revision 与 UploadSession，再用仅服务端可见的 Storage 管理凭据为已验证路径签名。

**Tech Stack:** Node.js 24 LTS、pnpm、Next.js 16.3.4 App Router、React 19.2.8、TypeScript strict、Tailwind CSS 4、Vitest 4.1.11、Testing Library、Playwright、Supabase Auth/Postgres/RLS/Private Storage、Zod、Resend、官方 `@remixicon/react` 4.9.0。

**Spec:** `docs/superpowers/specs/2026-09-02-general-ai-knowledge-base-design.md`

## Global Constraints

- 新用户默认进入只有本人可见的个人空间；任何资料都不得自动跨工作区移动、复制、检索或缓存复用。
- `WorkspaceRole` 固定为 `"owner" | "admin" | "editor" | "viewer"`；Membership 的数据库实时状态优先于 JWT 中的旧声明。
- `Capability` 至少覆盖 `documents.read`、`documents.upload`、`documents.trash`、`documents.delete`、`jobs.reprocess`、`knowledge.write`、`comments.write`、`qa.publish`、`members.manage_basic`、`members.manage_admin`、`workspace.delete`。
- Viewer 除本人私密会话与消息外不能写入团队内容；本计划只交付查看权限，不提前创建聊天表。
- 团队始终恰有一个 Owner；Admin 不能修改 Owner、其他 Admin 或自己；个人空间不能邀请成员。
- 所有业务记录除 `profiles` 外直接携带 `workspace_id`；工作区实体必须有 `(workspace_id, id)` 唯一约束，子表以同一对字段建立复合外键。
- 匿名用户默认无业务表权限；前端隐藏按钮只用于体验，授权结论必须来自 RLS 或服务端 RPC。
- 原件、缩略图和预览文件使用 Private Bucket；不得生成永久公共 URL，浏览器不得接收服务端高权限密钥。
- 首期允许 JPG、PNG、WebP、PDF、DOCX、Markdown、TXT；单批最多 20 个文件，单文件最大 50 MB。
- 上传会话必须先创建数据库记录和固定随机对象路径，再签发只允许写入该路径的令牌；对象路径不能作为授权依据。
- `@supabase/ssr` 仍作为不稳定边界封装在 `apps/web/src/lib/supabase/`，其 API 不泄露进功能模块。
- Next.js 私密页面、Route Handler 与数据请求使用动态渲染或 `no-store`，不得跨用户或工作区复用响应。
- UI 使用暖白 `#FFFEFC`、暖灰 `#F7F7F5`、主文字 `#37352F`、次文字 `#6B6A66`、分隔线 `#E9E9E7`、悬停 `#EFEFED`、强调色 `#2869D8`；不实现深色模式。
- 功能图标只使用官方 `@remixicon/react`：默认 Line，尺寸仅为 16/18/20 px，颜色继承 `currentColor`，纯图标按钮必须有可访问名称和提示。
- 响应式验收宽度固定为 360、768、1024、1440 px；768 px 以下侧栏变抽屉，交互热区至少 44 × 44 px，并尊重 `prefers-reduced-motion`。
- 本计划只占用迁移序号 `0001` 至 `0004`；数据库类型文件由迁移生成，禁止手工维护另一份结构定义。
- `.env.example` 只能列变量名和安全的本地示例；真实 Supabase、Storage、Resend 凭据不得进入版本库、浏览器包、日志或队列载荷。
- 每个任务先建立失败证据，再写最小实现；单元测试、数据库/RLS 测试或端到端测试通过后才提交。

## File and Responsibility Map

### Repository and shared contracts

- `.nvmrc` — 固定本地 Node 主版本 24。
- `.npmrc` — 固定 pnpm 严格依赖与引擎行为。
- `package.json` — 根脚本、包管理器和统一开发依赖。
- `pnpm-workspace.yaml` — 声明 `apps/*` 与 `packages/*` 工作区。
- `tsconfig.base.json` — 全仓 TypeScript strict 基线。
- `vitest.workspace.ts` — 聚合包级单元测试。
- `playwright.config.ts` — Web 端到端配置与四种验收宽度。
- `.env.example` — 本地、测试、生产共同变量契约。
- `packages/domain/src/workspaces.ts` — 角色、能力矩阵、工作区上下文与动作返回类型。
- `packages/domain/src/uploads.ts` — 上传输入、格式限制和跨计划 `UploadSession` 契约。
- `packages/domain/src/index.ts` — 共享领域包唯一出口。

### Database and authorization

- `supabase/config.toml` — 本地 Auth、邮件与数据库配置。
- `supabase/migrations/0001_extensions.sql` — `pgcrypto`、`citext`、`pg_trgm`、`vector`、`pgmq` 与私有函数 schema。
- `supabase/migrations/0002_identity_workspaces.sql` — Profile、Workspace、Membership、Invitation、Audit 表，个人空间触发器与唯一 Owner 约束。
- `supabase/migrations/0003_workspace_access.sql` — 能力判定、RLS、工作区/邀请/成员/所有权 RPC 和授权收口。
- `supabase/migrations/0004_private_upload_sessions.sql` — Document、Revision、UploadSession、Private Bucket 与上传 RPC。
- `supabase/tests/0002_identity_workspaces.test.sql` — 个人空间、Owner 与复合租户外键测试。
- `supabase/tests/0003_workspace_access.test.sql` — 四角色、跨租户、邀请与实时降权测试。
- `supabase/tests/0004_private_upload_sessions.test.sql` — 上传角色、批量限制、固定路径、完成校验与 Storage 直访测试。
- `packages/domain/src/database.types.ts` — 由 Supabase CLI 从上述迁移生成并由所有服务共享的数据库 TypeScript 类型。

### Web authentication and workspace experience

- `apps/web/src/lib/supabase/client.ts` — 唯一浏览器 Supabase 客户端工厂。
- `apps/web/src/lib/supabase/server.ts` — 唯一 Cookie 感知服务端客户端工厂。
- `apps/web/src/lib/supabase/admin.ts` — `server-only` 的受控 Storage 管理客户端。
- `apps/web/src/lib/supabase/proxy.ts` — Session Cookie 刷新逻辑。
- `apps/web/src/proxy.ts` — Next.js 16 Proxy 入口与受保护路由匹配。
- `apps/web/src/lib/workspaces/access.ts` — 跨计划权限门 `requireWorkspaceCapability(...)`。
- `apps/web/src/features/auth/service.ts` — 可单测的邮箱 OTP、Google OAuth 与回调交换逻辑。
- `apps/web/src/features/auth/actions.ts` — 登录 Server Actions。
- `apps/web/src/features/workspaces/queries.ts` — 工作区列表、落点和成员读取。
- `apps/web/src/features/workspaces/actions.ts` — 创建团队、切换、邀请、角色、移除、转移所有权动作。
- `apps/web/src/features/workspaces/invitation-mailer.ts` — Resend 邀请邮件适配器；功能层不依赖厂商 SDK。
- `apps/web/src/components/shell/app-shell.tsx` — Notion 式工作台壳与响应式抽屉。
- `apps/web/src/components/shell/workspace-switcher.tsx` — 当前工作区与切换入口。
- `apps/web/src/components/ui/app-icon.tsx` — Remix Icon 尺寸和无障碍规则入口。
- `apps/web/src/components/ui/empty-state.tsx` — 三张获批线稿的统一空状态结构。
- `apps/web/src/features/uploads/service.ts` — 授权后批量创建会话、固定路径签名与完成核验。
- `apps/web/src/features/uploads/upload-dialog.tsx` — 目标空间明确、团队可见警示、浏览器直传和进度 UI。
- `apps/web/src/app/api/uploads/sessions/route.ts` — 创建上传会话 API。
- `apps/web/src/app/api/uploads/sessions/[sessionId]/complete/route.ts` — 上传完成确认 API。

### Acceptance tests

- `tests/e2e/support/identities.ts` — 本地 Supabase 四角色、两个团队和登录链接夹具。
- `tests/e2e/auth-workspaces.spec.ts` — 邮箱登录、个人空间、工作区落点与邀请旅程。
- `tests/e2e/members-uploads.spec.ts` — 角色矩阵、团队提示、上传与即时降权旅程。

---

### Task 1: Bootstrap the Monorepo and Lock Cross-Plan Domain Contracts

**Files:**

- Create: `.nvmrc`
- Create: `.npmrc`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/vitest.config.ts`
- Create: `packages/domain/src/workspaces.ts`
- Create: `packages/domain/src/uploads.ts`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/workspaces.test.ts`
- Test: `packages/domain/src/uploads.test.ts`

**Interfaces:**

- Consumes: 无；这是全仓首个可执行边界。
- Produces: `WorkspaceRole`、`WorkspaceKind`、`Capability`、`WorkspaceContext`、`ActionResult<T>`、`hasCapability(role, capability): boolean`、`UploadFileInput`、`CreateUploadSessionsInput`、`UploadSession`、`parseUploadBatch(input): CreateUploadSessionsInput`。

- [x] **Step 1: 建立工具链文件和会失败的领域测试**

```json
// package.json
{
  "name": "knowledge-workspace",
  "private": true,
  "packageManager": "pnpm@10.15.1",
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "dev": "pnpm --filter @knowledge/web dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "vitest run --workspace vitest.workspace.ts",
    "test:db": "supabase test db",
    "test:e2e": "playwright test",
    "db:start": "supabase start",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > packages/domain/src/database.types.ts"
  },
  "devDependencies": {
    "@playwright/test": "1.62.1",
    "supabase": "2.116.0",
    "typescript": "5.9.3",
    "vitest": "4.1.11"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
```

```text
# .nvmrc
24
```

```ini
# .npmrc
engine-strict=true
auto-install-peers=false
save-exact=true
```

```json
// packages/domain/package.json
{
  "name": "@knowledge/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit",
    "build": "tsc --noEmit"
  },
  "dependencies": { "zod": "4.5.4" },
  "devDependencies": { "typescript": "5.9.3", "vitest": "4.1.11" }
}
```

```ts
// packages/domain/src/workspaces.test.ts
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, hasCapability } from './workspaces';

describe('workspace capability matrix', () => {
  it('gives owner every capability and viewer read only', () => {
    expect(CAPABILITIES.every((capability) => hasCapability('owner', capability))).toBe(true);
    expect(hasCapability('viewer', 'documents.read')).toBe(true);
    expect(hasCapability('viewer', 'documents.upload')).toBe(false);
    expect(hasCapability('admin', 'members.manage_admin')).toBe(false);
    expect(hasCapability('editor', 'documents.trash')).toBe(true);
    expect(hasCapability('editor', 'documents.delete')).toBe(false);
  });
});
```

```ts
// packages/domain/src/uploads.test.ts
import { describe, expect, it } from 'vitest';
import { parseUploadBatch } from './uploads';

describe('upload contract', () => {
  it('accepts a supported batch and rejects masqueraded or oversized input', () => {
    expect(
      parseUploadBatch({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        files: [{ name: 'notes.md', size: 12, declaredMime: 'text/markdown' }],
      }).files
    ).toHaveLength(1);
    expect(() =>
      parseUploadBatch({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        files: [{ name: 'payload.exe', size: 12, declaredMime: 'text/plain' }],
      })
    ).toThrow('不支持此文件格式');
    expect(() =>
      parseUploadBatch({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        files: [{ name: 'large.pdf', size: 52_428_801, declaredMime: 'application/pdf' }],
      })
    ).toThrow('单文件不能超过 50 MB');
  });
});
```

- [x] **Step 2: 运行测试并确认领域入口尚不存在**

Run: `corepack enable && pnpm install && pnpm --filter @knowledge/domain test`

Expected: FAIL，Vitest 报告无法解析 `./workspaces` 与 `./uploads`。

- [x] **Step 3: 写入最小而完整的共享领域契约**

```ts
// packages/domain/src/workspaces.ts
import { z } from 'zod';

export const WorkspaceRoleSchema = z.enum(['owner', 'admin', 'editor', 'viewer']);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const WorkspaceKindSchema = z.enum(['personal', 'team']);
export type WorkspaceKind = z.infer<typeof WorkspaceKindSchema>;

export const CapabilitySchema = z.enum([
  'documents.read',
  'documents.upload',
  'documents.trash',
  'documents.delete',
  'jobs.reprocess',
  'knowledge.write',
  'comments.write',
  'qa.publish',
  'members.manage_basic',
  'members.manage_admin',
  'workspace.delete',
]);
export type Capability = z.infer<typeof CapabilitySchema>;
export const CAPABILITIES = CapabilitySchema.options;

const read: Capability[] = ['documents.read'];
const edit: Capability[] = [
  ...read,
  'documents.upload',
  'documents.trash',
  'knowledge.write',
  'comments.write',
  'qa.publish',
];

export const ROLE_CAPABILITIES: Readonly<Record<WorkspaceRole, readonly Capability[]>> = {
  viewer: read,
  editor: edit,
  admin: [...edit, 'documents.delete', 'jobs.reprocess', 'members.manage_basic'],
  owner: [...CAPABILITIES],
};

export function hasCapability(role: WorkspaceRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export const WorkspaceContextSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: WorkspaceRoleSchema,
  kind: WorkspaceKindSchema,
});
export type WorkspaceContext = z.infer<typeof WorkspaceContextSchema>;

export type ActionError = {
  code:
    | 'AUTH_REQUIRED'
    | 'FORBIDDEN'
    | 'INVALID_INPUT'
    | 'CONFLICT'
    | 'NOT_FOUND'
    | 'DEPENDENCY_FAILED';
  message: string;
};
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };
```

```ts
// packages/domain/src/uploads.ts
import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_BATCH = 20;
export const DOCUMENT_ORIGINALS_BUCKET = 'originals';
export const ALLOWED_UPLOADS = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.md': ['text/markdown', 'text/plain'],
  '.txt': ['text/plain'],
} as const;

export const UploadFileInputSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES, '单文件不能超过 50 MB'),
    declaredMime: z.string().trim().min(1),
  })
  .superRefine((file, context) => {
    const suffix = file.name
      .slice(file.name.lastIndexOf('.'))
      .toLowerCase() as keyof typeof ALLOWED_UPLOADS;
    const allowed = ALLOWED_UPLOADS[suffix] as readonly string[] | undefined;
    if (!allowed?.includes(file.declaredMime)) {
      context.addIssue({ code: 'custom', message: '不支持此文件格式' });
    }
  });
export type UploadFileInput = z.infer<typeof UploadFileInputSchema>;

export const CreateUploadSessionsInputSchema = z.object({
  workspaceId: z.string().uuid(),
  files: z.array(UploadFileInputSchema).min(1).max(MAX_UPLOAD_BATCH, '单批最多上传 20 个文件'),
});
export type CreateUploadSessionsInput = z.infer<typeof CreateUploadSessionsInputSchema>;

export const UploadSessionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  documentId: z.string().uuid(),
  revisionId: z.string().uuid(),
  objectPath: z.string().min(1),
  uploadToken: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type UploadSession = z.infer<typeof UploadSessionSchema>;

export function parseUploadBatch(input: unknown): CreateUploadSessionsInput {
  return CreateUploadSessionsInputSchema.parse(input);
}
```

```ts
// packages/domain/src/index.ts
export * from './workspaces';
export * from './uploads';
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

```ts
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';
export default defineWorkspace(['packages/*/vitest.config.ts', 'apps/*/vitest.config.ts']);
```

```json
// packages/domain/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["vitest/globals"] },
  "include": ["src/**/*.ts"]
}
```

```ts
// packages/domain/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```

- [x] **Step 4: 运行领域测试和类型检查**

Run: `pnpm --filter @knowledge/domain test && pnpm --filter @knowledge/domain typecheck`

Expected: PASS；角色矩阵和上传批量/格式/大小规则全部通过。

- [x] **Step 5: 提交共享契约**

```bash
git add .nvmrc .npmrc package.json pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts packages/domain pnpm-lock.yaml
git commit -m "chore: bootstrap knowledge workspace contracts"
```

### Task 2: Create Identity, Workspace, and Single-Owner Database Invariants

**Files:**

- Create: `supabase/config.toml`
- Create: `supabase/migrations/0001_extensions.sql`
- Create: `supabase/migrations/0002_identity_workspaces.sql`
- Test: `supabase/tests/0002_identity_workspaces.test.sql`

**Interfaces:**

- Consumes: `WorkspaceRole` and `WorkspaceKind` string values from Task 1.
- Produces: tables `profiles`, `workspaces`, `memberships`, `invitations`, `audit_events`; enums `workspace_role`, `workspace_kind`, `workspace_state`, `membership_status`; trigger `private.handle_new_user()`; invariant function `private.assert_single_workspace_owner(uuid)`.

- [x] **Step 1: 初始化本地 Supabase 配置并写会失败的身份不变量测试**

Run: `pnpm exec supabase init`

Then set Auth local URLs in `supabase/config.toml`:

```toml
[auth]
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["http://127.0.0.1:3000/auth/callback"]
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false
```

```sql
-- supabase/tests/0002_identity_workspaces.test.sql
begin;
select extensions.plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'owner-a@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"Owner A"}', now(), now()
);

select extensions.is(
  (select count(*)::integer from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  1,
  'a profile is created for an auth user'
);
select extensions.is(
  (select count(*)::integer from public.workspaces where owner_user_id = '10000000-0000-4000-8000-000000000001' and kind = 'personal'),
  1,
  'a private personal workspace is created'
);
select extensions.is(
  (select count(*)::integer from public.memberships where user_id = '10000000-0000-4000-8000-000000000001' and role = 'owner' and status = 'active'),
  1,
  'the user is the sole active owner'
);
select extensions.ok(
  (select last_workspace_id is not null from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'the personal workspace is the initial landing workspace'
);
select extensions.throws_ok(
  $$insert into public.memberships (workspace_id, user_id, role, status, joined_at)
    select id, '10000000-0000-4000-8000-000000000002', 'viewer', 'active', now()
    from public.workspaces where owner_user_id = '10000000-0000-4000-8000-000000000001'$$,
  '23503', null,
  'membership requires an existing auth user'
);
select extensions.is(
  (select count(*)::integer from public.audit_events where action = 'workspace.created'),
  1,
  'personal workspace creation is audited without content'
);
select extensions.ok(
  (select bool_and(workspace_id is not null) from public.audit_events),
  'workspace business rows carry workspace_id'
);

select * from extensions.finish();
rollback;
```

- [x] **Step 2: 启动本地依赖并确认数据库对象不存在**

Run: `pnpm db:start && pnpm db:reset && pnpm exec supabase test db supabase/tests/0002_identity_workspaces.test.sql`

Expected: FAIL，首个断言前报告 `relation "public.profiles" does not exist`。

- [x] **Step 3: 创建扩展、身份表和所有权约束**

```sql
-- supabase/migrations/0001_extensions.sql
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgmq;
```

```sql
-- supabase/migrations/0002_identity_workspaces.sql
create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.workspace_kind as enum ('personal', 'team');
create type public.workspace_state as enum ('ACTIVE', 'DELETION_SCHEDULED', 'PURGING', 'PURGED');
create type public.membership_status as enum ('active', 'removed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  last_workspace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  kind public.workspace_kind not null,
  state public.workspace_state not null default 'ACTIVE',
  name text not null check (char_length(name) between 1 and 80),
  slug extensions.citext not null unique check (slug::text ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  owner_user_id uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, kind)
);

alter table public.profiles
  add constraint profiles_last_workspace_fk
  foreign key (last_workspace_id) references public.workspaces(id) on delete set null;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null,
  status public.membership_status not null default 'active',
  joined_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, user_id),
  check ((status = 'active' and joined_at is not null and removed_at is null)
      or (status = 'removed' and removed_at is not null))
);

create unique index memberships_one_active_owner
  on public.memberships(workspace_id)
  where role = 'owner' and status = 'active';

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email extensions.citext not null,
  role public.workspace_role not null check (role <> 'owner'),
  token_hash bytea not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (expires_at <= created_at + interval '7 days'),
  check (not (accepted_at is not null and revoked_at is not null))
);

create unique index invitations_one_open_per_email
  on public.invitations(workspace_id, email)
  where accepted_at is null and revoked_at is null;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_kind text not null check (actor_kind in ('user', 'system')),
  initiator_user_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid,
  action text not null,
  result text not null check (result in ('succeeded', 'denied', 'failed')),
  request_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create or replace function private.assert_single_workspace_owner(target_workspace_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.workspaces%rowtype;
  active_count integer;
  owner_count integer;
  active_owner uuid;
begin
  select * into target from public.workspaces where id = target_workspace_id;
  if not found or target.state <> 'ACTIVE' then return; end if;

  select count(*), count(*) filter (where role = 'owner'),
         max(user_id) filter (where role = 'owner')
    into active_count, owner_count, active_owner
    from public.memberships
   where workspace_id = target_workspace_id and status = 'active';

  if owner_count <> 1 or active_owner <> target.owner_user_id then
    raise exception using errcode = '23514', message = 'workspace must have exactly one matching owner';
  end if;
  if target.kind = 'personal' and active_count <> 1 then
    raise exception using errcode = '23514', message = 'personal workspace must contain only its owner';
  end if;
end;
$$;

create or replace function private.check_owner_from_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.assert_single_workspace_owner(coalesce(new.id, old.id)); return null; end;
$$;

create or replace function private.check_owner_from_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.assert_single_workspace_owner(coalesce(new.workspace_id, old.workspace_id)); return null; end;
$$;

create constraint trigger workspace_owner_guard
after insert or update of owner_user_id, kind, state on public.workspaces
deferrable initially deferred for each row execute function private.check_owner_from_workspace();

create constraint trigger membership_owner_guard
after insert or update or delete on public.memberships
deferrable initially deferred for each row execute function private.check_owner_from_membership();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare personal_workspace_id uuid := gen_random_uuid();
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), '新用户'));
  insert into public.workspaces (id, kind, name, slug, owner_user_id, created_by)
  values (personal_workspace_id, 'personal', '我的空间',
          'personal-' || replace(new.id::text, '-', ''), new.id, new.id);
  insert into public.memberships (workspace_id, user_id, role, status, joined_at)
  values (personal_workspace_id, new.id, 'owner', 'active', now());
  update public.profiles set last_workspace_id = personal_workspace_id where id = new.id;
  insert into public.audit_events (
    workspace_id, actor_user_id, actor_kind, initiator_user_id,
    target_type, target_id, action, result, request_id
  ) values (
    personal_workspace_id, new.id, 'system', new.id,
    'workspace', personal_workspace_id, 'workspace.created', 'succeeded', gen_random_uuid()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function private.handle_new_user();
```

- [x] **Step 4: 重建数据库并验证触发器与约束**

Run: `pnpm db:reset && pnpm exec supabase test db supabase/tests/0002_identity_workspaces.test.sql`

Expected: PASS，7 个断言通过；新用户只有一个个人空间和一个 Owner Membership。

- [x] **Step 5: 提交身份数据模型**

```bash
git add supabase/config.toml supabase/migrations/0001_extensions.sql supabase/migrations/0002_identity_workspaces.sql supabase/tests/0002_identity_workspaces.test.sql
git commit -m "feat: add workspace identity invariants"
```

### Task 3: Enforce the Four-Role Matrix with RLS and Audited RPCs

**Files:**

- Create: `supabase/migrations/0003_workspace_access.sql`
- Create: `supabase/tests/0003_workspace_access.test.sql`
- Create: `packages/domain/src/database.types.ts` (generated)
- Modify: `packages/domain/src/index.ts`

**Interfaces:**

- Consumes: tables and enums from Task 2; `Capability` string values from `@knowledge/domain`.
- Produces: `public.has_workspace_capability(uuid, app_capability): boolean`; `public.assert_workspace_capability(uuid, app_capability)` returning `workspace_id, user_id, role, kind`; `public.resolve_entry_workspace(): uuid`; RPCs `create_team_workspace`, `set_last_workspace`, `create_invitation`, `accept_invitation`, `revoke_invitation`, `change_member_role`, `remove_member`, `leave_workspace`, `transfer_workspace_ownership`.

- [x] **Step 1: 写四角色、跨租户和成员变更的失败测试**

```sql
-- supabase/tests/0003_workspace_access.test.sql
begin;
select extensions.plan(17);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('20000000-0000-4000-8000-000000000001'::uuid, 'owner@example.test'),
  ('20000000-0000-4000-8000-000000000002'::uuid, 'admin@example.test'),
  ('20000000-0000-4000-8000-000000000003'::uuid, 'editor@example.test'),
  ('20000000-0000-4000-8000-000000000004'::uuid, 'viewer@example.test'),
  ('20000000-0000-4000-8000-000000000005'::uuid, 'outsider@example.test')
) as fixture(id, email);

insert into public.workspaces (id, kind, name, slug, owner_user_id, created_by) values
  ('21000000-0000-4000-8000-000000000001', 'team', 'Team One', 'team-one', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000002', 'team', 'Team Two', 'team-two', '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005');
insert into public.memberships (workspace_id, user_id, role, status, joined_at) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'owner', 'active', now()),
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'admin', 'active', now()),
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'editor', 'active', now()),
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'viewer', 'active', now()),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.workspaces where id = '21000000-0000-4000-8000-000000000001'), 1, 'viewer sees own team');
select extensions.is((select count(*)::integer from public.workspaces where id = '21000000-0000-4000-8000-000000000002'), 0, 'viewer cannot see another team');
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.read'), 'viewer can read');
select extensions.not_ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.upload'), 'viewer cannot upload');
select extensions.throws_ok(
  $$select * from public.assert_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.upload')$$,
  '42501', null, 'viewer upload is rejected by the database'
);

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.upload'), 'editor can upload');
select extensions.not_ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.delete'), 'editor cannot permanently delete');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'members.manage_basic'), 'admin manages basic roles');
select extensions.not_ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'members.manage_admin'), 'admin cannot manage admins');
select extensions.throws_ok(
  $$select public.change_member_role('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'editor', gen_random_uuid())$$,
  '42501', null, 'admin cannot change their own role'
);

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'members.manage_admin'), 'owner manages admins');
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'workspace.delete'), 'owner can delete workspace');
select extensions.throws_ok(
  $$select public.remove_member('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', gen_random_uuid())$$,
  '23514', null, 'owner cannot remove the last owner'
);

select public.remove_member('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', gen_random_uuid());
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.workspaces where id = '21000000-0000-4000-8000-000000000001'), 0, 'removed member loses access on the next query');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select * from public.create_invitation('21000000-0000-4000-8000-000000000001', 'new@example.test', 'owner', gen_random_uuid())$$,
  '23514', null, 'owner role cannot be invited'
);
select extensions.is(
  (select count(*)::integer from public.audit_events where workspace_id = '21000000-0000-4000-8000-000000000001' and action = 'member.removed'),
  1,
  'member removal is audited'
);
select public.set_last_workspace('21000000-0000-4000-8000-000000000001');
select extensions.is(public.resolve_entry_workspace(), '21000000-0000-4000-8000-000000000001'::uuid, 'entry resolver returns the last accessible workspace');

select * from extensions.finish();
rollback;
```

- [x] **Step 2: 运行权限测试并确认能力类型与 RPC 尚不存在**

Run: `pnpm db:reset && pnpm exec supabase test db supabase/tests/0003_workspace_access.test.sql`

Expected: FAIL，报告 `type public.app_capability does not exist` 或 `function public.has_workspace_capability(...) does not exist`。

- [x] **Step 3: 实现数据库能力矩阵、无递归 RLS 帮助函数与审计写入**

```sql
-- supabase/migrations/0003_workspace_access.sql (first section)
create type public.app_capability as enum (
  'documents.read', 'documents.upload', 'documents.trash', 'documents.delete',
  'jobs.reprocess', 'knowledge.write', 'comments.write', 'qa.publish',
  'members.manage_basic', 'members.manage_admin', 'workspace.delete'
);

create or replace function private.workspace_role_for(target_workspace_id uuid, target_user_id uuid)
returns public.workspace_role language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m
  join public.workspaces w on w.id = m.workspace_id and w.state = 'ACTIVE'
   where m.workspace_id = target_workspace_id and m.user_id = target_user_id and m.status = 'active'
$$;

create or replace function private.is_workspace_member(target_workspace_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.workspace_role_for(target_workspace_id, target_user_id) is not null
$$;

create or replace function private.shares_workspace(left_user_id uuid, right_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships a join public.memberships b using (workspace_id)
     where a.user_id = left_user_id and b.user_id = right_user_id
       and a.status = 'active' and b.status = 'active'
  )
$$;

create or replace function public.has_workspace_capability(
  target_workspace_id uuid,
  requested_capability public.app_capability
) returns boolean language sql stable security definer set search_path = '' as $$
  select case private.workspace_role_for(target_workspace_id, auth.uid())
    when 'owner' then true
    when 'admin' then requested_capability = any(array[
      'documents.read', 'documents.upload', 'documents.trash', 'documents.delete',
      'jobs.reprocess', 'knowledge.write', 'comments.write', 'qa.publish',
      'members.manage_basic'
    ]::public.app_capability[])
    when 'editor' then requested_capability = any(array[
      'documents.read', 'documents.upload', 'documents.trash',
      'knowledge.write', 'comments.write', 'qa.publish'
    ]::public.app_capability[])
    when 'viewer' then requested_capability = 'documents.read'
    else false
  end
$$;

create or replace function public.assert_workspace_capability(
  target_workspace_id uuid,
  requested_capability public.app_capability
) returns table (workspace_id uuid, user_id uuid, role public.workspace_role, kind public.workspace_kind)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_workspace_capability(target_workspace_id, requested_capability) then
    raise exception using errcode = '42501', message = 'workspace capability denied';
  end if;
  return query
    select w.id, auth.uid(), private.workspace_role_for(w.id, auth.uid()), w.kind
      from public.workspaces w
     where w.id = target_workspace_id and w.state = 'ACTIVE';
  if not found then raise exception using errcode = '42501', message = 'workspace unavailable'; end if;
end;
$$;

create or replace function private.write_audit(
  target_workspace_id uuid, target_kind text, target_uuid uuid,
  event_action text, event_result text, correlation_id uuid, event_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (
    workspace_id, actor_user_id, actor_kind, initiator_user_id,
    target_type, target_id, action, result, request_id, metadata
  ) values (
    target_workspace_id, auth.uid(), 'user', auth.uid(),
    target_kind, target_uuid, event_action, event_result, correlation_id, event_metadata
  );
end;
$$;
```

- [x] **Step 4: 实现工作区、邀请和成员的事务型 RPC**

```sql
-- supabase/migrations/0003_workspace_access.sql (second section)
create or replace function public.resolve_entry_workspace()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare resolved uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select p.last_workspace_id into resolved
    from public.profiles p join public.workspaces w on w.id = p.last_workspace_id
   where p.id = auth.uid() and w.state = 'ACTIVE'
     and private.is_workspace_member(w.id, auth.uid());
  if resolved is null then
    select w.id into resolved from public.workspaces w
     where w.kind = 'personal' and w.owner_user_id = auth.uid() and w.state = 'ACTIVE';
  end if;
  return resolved;
end;
$$;

create or replace function public.set_last_workspace(target_workspace_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform * from public.assert_workspace_capability(target_workspace_id, 'documents.read');
  update public.profiles set last_workspace_id = target_workspace_id, updated_at = now() where id = auth.uid();
end;
$$;

create or replace function public.create_team_workspace(
  workspace_name text, workspace_slug text, correlation_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare created_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  if char_length(trim(workspace_name)) not between 1 and 80
     or lower(workspace_slug) !~ '^[a-z0-9][a-z0-9-]{2,62}$' then
    raise exception using errcode = '22023', message = 'invalid workspace name or slug';
  end if;
  insert into public.workspaces (id, kind, name, slug, owner_user_id, created_by)
  values (created_id, 'team', trim(workspace_name), lower(workspace_slug), auth.uid(), auth.uid());
  insert into public.memberships (workspace_id, user_id, role, status, joined_at)
  values (created_id, auth.uid(), 'owner', 'active', now());
  update public.profiles set last_workspace_id = created_id, updated_at = now() where id = auth.uid();
  perform private.write_audit(created_id, 'workspace', created_id, 'workspace.created', 'succeeded', correlation_id);
  return created_id;
end;
$$;

create or replace function public.create_invitation(
  target_workspace_id uuid, target_email text, target_role public.workspace_role, correlation_id uuid
) returns table (invitation_id uuid, raw_token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare caller_role public.workspace_role; generated_token text := encode(extensions.gen_random_bytes(32), 'hex'); created_id uuid;
begin
  select role into caller_role from public.assert_workspace_capability(
    target_workspace_id,
    case when target_role = 'admin' then 'members.manage_admin' else 'members.manage_basic' end
  );
  if (select kind from public.workspaces where id = target_workspace_id) <> 'team' or target_role = 'owner' then
    raise exception using errcode = '23514', message = 'invitation role or workspace is invalid';
  end if;
  insert into public.invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
  values (target_workspace_id, lower(trim(target_email)), target_role,
          extensions.digest(convert_to(generated_token, 'utf8'), 'sha256'), auth.uid(), now() + interval '7 days')
  returning id, invitations.expires_at into created_id, expires_at;
  perform private.write_audit(target_workspace_id, 'invitation', created_id, 'invitation.created', 'succeeded', correlation_id,
                              jsonb_build_object('role', target_role));
  invitation_id := created_id; raw_token := generated_token; return next;
end;
$$;

create or replace function public.accept_invitation(raw_token text, correlation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite public.invitations%rowtype; account_email text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select * into invite from public.invitations
   where token_hash = extensions.digest(convert_to(raw_token, 'utf8'), 'sha256') for update;
  select lower(email) into account_email from auth.users where id = auth.uid();
  if invite.id is null then raise exception using errcode = 'P0002', message = 'invitation not found'; end if;
  if invite.accepted_at is not null or invite.revoked_at is not null or invite.expires_at <= now() then
    raise exception using errcode = '23514', message = 'invitation is no longer valid';
  end if;
  if lower(invite.email::text) <> account_email then
    raise exception using errcode = '42501', message = 'invitation email does not match';
  end if;
  insert into public.memberships (workspace_id, user_id, role, status, joined_at)
  values (invite.workspace_id, auth.uid(), invite.role, 'active', now())
  on conflict (workspace_id, user_id) do update
    set role = excluded.role, status = 'active', joined_at = now(), removed_at = null, updated_at = now()
    where memberships.status = 'removed';
  if not found then raise exception using errcode = '23505', message = 'user is already a member'; end if;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = invite.id;
  update public.profiles set last_workspace_id = invite.workspace_id, updated_at = now() where id = auth.uid();
  perform private.write_audit(invite.workspace_id, 'invitation', invite.id, 'invitation.accepted', 'succeeded', correlation_id);
  return invite.workspace_id;
end;
$$;

create or replace function public.revoke_invitation(
  target_workspace_id uuid, target_invitation_id uuid, correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare invite_role public.workspace_role;
begin
  select role into invite_role from public.invitations
   where workspace_id = target_workspace_id and id = target_invitation_id and accepted_at is null and revoked_at is null;
  if invite_role is null then raise exception using errcode = 'P0002', message = 'active invitation not found'; end if;
  perform * from public.assert_workspace_capability(
    target_workspace_id,
    case when invite_role = 'admin' then 'members.manage_admin' else 'members.manage_basic' end
  );
  update public.invitations set revoked_at = now() where workspace_id = target_workspace_id and id = target_invitation_id;
  perform private.write_audit(target_workspace_id, 'invitation', target_invitation_id, 'invitation.revoked', 'succeeded', correlation_id);
end;
$$;

create or replace function public.change_member_role(
  target_workspace_id uuid, target_user_id uuid, new_role public.workspace_role, correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare caller_role public.workspace_role := private.workspace_role_for(target_workspace_id, auth.uid()); old_role public.workspace_role;
begin
  select role into old_role from public.memberships
   where workspace_id = target_workspace_id and user_id = target_user_id and status = 'active' for update;
  if old_role is null then raise exception using errcode = 'P0002', message = 'active member not found'; end if;
  if old_role = 'owner' or new_role = 'owner' then raise exception using errcode = '23514', message = 'use ownership transfer'; end if;
  if caller_role = 'admin' and (target_user_id = auth.uid() or old_role = 'admin' or new_role = 'admin') then
    raise exception using errcode = '42501', message = 'admin cannot modify this membership';
  end if;
  perform * from public.assert_workspace_capability(
    target_workspace_id,
    case when old_role = 'admin' or new_role = 'admin' then 'members.manage_admin' else 'members.manage_basic' end
  );
  update public.memberships set role = new_role, updated_at = now()
   where workspace_id = target_workspace_id and user_id = target_user_id;
  perform private.write_audit(target_workspace_id, 'membership', null, 'membership.role_changed', 'succeeded', correlation_id,
                              jsonb_build_object('user_id', target_user_id, 'from', old_role, 'to', new_role));
end;
$$;

create or replace function public.remove_member(
  target_workspace_id uuid, target_user_id uuid, correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare caller_role public.workspace_role := private.workspace_role_for(target_workspace_id, auth.uid()); target_role public.workspace_role;
begin
  select role into target_role from public.memberships
   where workspace_id = target_workspace_id and user_id = target_user_id and status = 'active' for update;
  if target_role is null then raise exception using errcode = 'P0002', message = 'active member not found'; end if;
  if target_role = 'owner' then raise exception using errcode = '23514', message = 'last owner cannot be removed'; end if;
  if caller_role = 'admin' and (target_role = 'admin' or target_user_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'admin cannot remove this member';
  end if;
  perform * from public.assert_workspace_capability(
    target_workspace_id,
    case when target_role = 'admin' then 'members.manage_admin' else 'members.manage_basic' end
  );
  update public.memberships set status = 'removed', removed_at = now(), updated_at = now()
   where workspace_id = target_workspace_id and user_id = target_user_id;
  perform private.write_audit(target_workspace_id, 'membership', null, 'member.removed', 'succeeded', correlation_id,
                              jsonb_build_object('user_id', target_user_id, 'role', target_role));
end;
$$;

create or replace function public.leave_workspace(target_workspace_id uuid, correlation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare own_role public.workspace_role := private.workspace_role_for(target_workspace_id, auth.uid());
begin
  if own_role is null then raise exception using errcode = 'P0002', message = 'active membership not found'; end if;
  if own_role = 'owner' then raise exception using errcode = '23514', message = 'owner must transfer or delete the workspace'; end if;
  update public.memberships set status = 'removed', removed_at = now(), updated_at = now()
   where workspace_id = target_workspace_id and user_id = auth.uid();
  perform private.write_audit(target_workspace_id, 'membership', null, 'member.left', 'succeeded', correlation_id);
end;
$$;

create or replace function public.transfer_workspace_ownership(
  target_workspace_id uuid, new_owner_user_id uuid, correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform * from public.assert_workspace_capability(target_workspace_id, 'members.manage_admin');
  if (select kind from public.workspaces where id = target_workspace_id) <> 'team'
     or (select owner_user_id from public.workspaces where id = target_workspace_id) <> auth.uid() then
    raise exception using errcode = '42501', message = 'only the team owner can transfer ownership';
  end if;
  if not private.is_workspace_member(target_workspace_id, new_owner_user_id) then
    raise exception using errcode = 'P0002', message = 'new owner must be an active member';
  end if;
  update public.memberships set role = 'admin', updated_at = now()
   where workspace_id = target_workspace_id and user_id = auth.uid() and role = 'owner';
  update public.memberships set role = 'owner', updated_at = now()
   where workspace_id = target_workspace_id and user_id = new_owner_user_id and status = 'active';
  update public.workspaces set owner_user_id = new_owner_user_id, updated_at = now() where id = target_workspace_id;
  perform private.write_audit(target_workspace_id, 'workspace', target_workspace_id, 'workspace.ownership_transferred', 'succeeded', correlation_id,
                              jsonb_build_object('previous_owner', auth.uid(), 'new_owner', new_owner_user_id));
end;
$$;
```

- [x] **Step 5: 启用 RLS、移除直接写权限并只开放必要 RPC**

```sql
-- supabase/migrations/0003_workspace_access.sql (final section)
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_self_or_teammate on public.profiles for select to authenticated
using (id = auth.uid() or private.shares_workspace(id, auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
create policy workspaces_read_member on public.workspaces for select to authenticated
using (state = 'ACTIVE' and private.is_workspace_member(id, auth.uid()));
create policy memberships_read_member on public.memberships for select to authenticated
using (private.is_workspace_member(workspace_id, auth.uid()));
create policy invitations_read_manager on public.invitations for select to authenticated
using (public.has_workspace_capability(
  workspace_id,
  case when role = 'admin' then 'members.manage_admin' else 'members.manage_basic' end
));
create policy audits_read_manager on public.audit_events for select to authenticated
using (public.has_workspace_capability(workspace_id, 'members.manage_basic'));

revoke all on public.profiles, public.workspaces, public.memberships, public.invitations, public.audit_events from anon, authenticated;
grant select on public.profiles, public.workspaces, public.memberships to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.invitations, public.audit_events to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.has_workspace_capability(uuid, public.app_capability) from public, anon;
revoke all on function public.assert_workspace_capability(uuid, public.app_capability) from public, anon;
grant execute on function public.has_workspace_capability(uuid, public.app_capability) to authenticated;
grant execute on function public.assert_workspace_capability(uuid, public.app_capability) to authenticated;
grant execute on function public.resolve_entry_workspace() to authenticated;
grant execute on function public.set_last_workspace(uuid) to authenticated;
grant execute on function public.create_team_workspace(text, text, uuid) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.workspace_role, uuid) to authenticated;
grant execute on function public.accept_invitation(text, uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid, uuid, uuid) to authenticated;
grant execute on function public.change_member_role(uuid, uuid, public.workspace_role, uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid, uuid) to authenticated;
grant execute on function public.leave_workspace(uuid, uuid) to authenticated;
grant execute on function public.transfer_workspace_ownership(uuid, uuid, uuid) to authenticated;
```

After type generation, append the shared type-only export so Web and Worker use one schema contract:

```ts
// packages/domain/src/index.ts
export type { Database } from './database.types';
```

- [x] **Step 6: 重建数据库、运行全部数据库测试并生成类型**

Run: `pnpm db:reset && pnpm test:db && pnpm db:types`

Expected: PASS，Task 2 和 Task 3 的 24 个断言全部通过；`packages/domain/src/database.types.ts` 包含 `app_capability` 与所有 RPC 签名，`packages/domain/src/index.ts` 导出 `Database`。

- [x] **Step 7: 提交权限底座**

```bash
git add supabase/migrations/0003_workspace_access.sql supabase/tests/0003_workspace_access.test.sql packages/domain/src/database.types.ts packages/domain/src/index.ts
git commit -m "feat: enforce workspace rbac and rls"
```

### Task 4: Add SSR Authentication, Login Entry, and the Shared Permission Gate

**Files:**

- Create: `.env.example`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/lib/env.ts`
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `apps/web/src/lib/supabase/proxy.ts`
- Create: `apps/web/src/proxy.ts`
- Create: `apps/web/src/lib/workspaces/access.ts`
- Create: `apps/web/src/features/auth/service.ts`
- Create: `apps/web/src/features/auth/actions.ts`
- Create: `apps/web/src/features/auth/login-form.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/auth/callback/route.ts`
- Create: `apps/web/src/app/page.tsx`
- Test: `apps/web/src/features/auth/service.test.ts`
- Test: `apps/web/src/lib/workspaces/access.test.ts`

**Interfaces:**

- Consumes: `ActionResult<T>`, `Capability`, `WorkspaceContext`, `WorkspaceContextSchema`; generated `Database`; RPCs `assert_workspace_capability` and `resolve_entry_workspace`.
- Produces: `createBrowserSupabaseClient(): SupabaseClient<Database>`; `createServerSupabaseClient(): Promise<SupabaseClient<Database>>`; `requireWorkspaceCapability(client: SupabaseClient<Database>, workspaceId: string, capability: Capability): Promise<WorkspaceContext>`; `requestEmailOtp(auth, input): Promise<ActionResult<undefined>>`; `beginGoogleSignIn(auth, input): Promise<ActionResult<{ url: string }>>`.

- [x] **Step 1: 创建 Web 清单、测试环境和会失败的认证/权限门测试**

```json
// apps/web/package.json
{
  "name": "@knowledge/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@knowledge/domain": "workspace:*",
    "@remixicon/react": "4.9.0",
    "@supabase/ssr": "0.12.5",
    "@supabase/supabase-js": "2.112.4",
    "next": "16.2.11",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "server-only": "0.0.1",
    "zod": "4.5.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.3",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@types/node": "24.13.3",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.5",
    "jsdom": "30.0.1",
    "tailwindcss": "4.3.3",
    "typescript": "5.9.3",
    "vitest": "4.1.11"
  }
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] },
    "types": ["node", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```ts
// apps/web/next.config.ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = { reactStrictMode: true, poweredByHeader: false };
export default nextConfig;
```

```js
// apps/web/postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```ts
// apps/web/vitest.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

```ts
// apps/web/src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

```ts
// apps/web/src/lib/env.ts
import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});
const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  INVITATION_EMAIL_FROM: z.string().min(3),
});

export function getPublicEnv() {
  return publicSchema.parse(process.env);
}
export function getServerEnv() {
  return serverSchema.parse(process.env);
}
```

```ts
// apps/web/src/features/auth/service.test.ts
import { describe, expect, it, vi } from 'vitest';
import { beginGoogleSignIn, requestEmailOtp, type AuthGateway } from './service';

describe('auth service', () => {
  it('sends email OTP to the callback and starts Google without persisting provider state', async () => {
    const auth: AuthGateway = {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi
        .fn()
        .mockResolvedValue({ data: { url: 'https://accounts.google.test/oauth' }, error: null }),
      exchangeCodeForSession: vi.fn(),
    };
    await expect(
      requestEmailOtp(auth, {
        email: 'person@example.test',
        callbackUrl: 'https://app.example.test/auth/callback',
      })
    ).resolves.toEqual({ ok: true, data: undefined });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'person@example.test',
      options: { emailRedirectTo: 'https://app.example.test/auth/callback' },
    });
    await expect(
      beginGoogleSignIn(auth, {
        callbackUrl: 'https://app.example.test/auth/callback',
      })
    ).resolves.toEqual({ ok: true, data: { url: 'https://accounts.google.test/oauth' } });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.example.test/auth/callback' },
    });
  });
});
```

```ts
// apps/web/src/lib/workspaces/access.test.ts
import { describe, expect, it, vi } from 'vitest';
import { requireWorkspaceCapability } from './access';

describe('requireWorkspaceCapability', () => {
  it('maps the database assertion to the stable cross-plan context', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        workspace_id: '21000000-0000-4000-8000-000000000001',
        user_id: '20000000-0000-4000-8000-000000000003',
        role: 'editor',
        kind: 'team',
      },
      error: null,
    });
    const client = { rpc: vi.fn().mockReturnValue({ single }) };
    await expect(
      requireWorkspaceCapability(
        client as never,
        '21000000-0000-4000-8000-000000000001',
        'documents.upload'
      )
    ).resolves.toEqual({
      workspaceId: '21000000-0000-4000-8000-000000000001',
      userId: '20000000-0000-4000-8000-000000000003',
      role: 'editor',
      kind: 'team',
    });
  });

  it('does not replace a database denial with a client-side role guess', async () => {
    const client = {
      rpc: vi.fn().mockReturnValue({
        single: vi
          .fn()
          .mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } }),
      }),
    };
    await expect(
      requireWorkspaceCapability(
        client as never,
        '21000000-0000-4000-8000-000000000001',
        'documents.upload'
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
```

- [x] **Step 2: 安装 Web 依赖并确认实现入口不存在**

Run: `pnpm install && pnpm --filter @knowledge/web test -- src/features/auth/service.test.ts src/lib/workspaces/access.test.ts`

Expected: FAIL，报告无法解析 `./service` 与 `./access`。

- [x] **Step 3: 封装环境和 Supabase SSR 边界**

```dotenv
# .env.example
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=http://127.0.0.1:3000
RESEND_API_KEY=
INVITATION_EMAIL_FROM=
```

```ts
// apps/web/src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@knowledge/domain';

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

```ts
// apps/web/src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@knowledge/domain';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // React Server Components cannot write cookies; Proxy performs refresh.
          }
        },
      },
    }
  );
}
```

```ts
// apps/web/src/lib/supabase/proxy.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@knowledge/domain';

export async function refreshAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const {
    data: { user },
  } = await client.auth.getUser();
  const protectedPath =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/w/') ||
    request.nextUrl.pathname.startsWith('/workspaces/');
  if (!user && protectedPath) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return response;
}
```

```ts
// apps/web/src/proxy.ts
import type { NextRequest } from 'next/server';
import { refreshAuthSession } from '@/lib/supabase/proxy';

export function proxy(request: NextRequest) {
  return refreshAuthSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [x] **Step 4: 实现稳定的权限门和认证服务**

```ts
// apps/web/src/lib/workspaces/access.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { WorkspaceContextSchema, type Capability, type WorkspaceContext } from '@knowledge/domain';
import type { Database } from '@knowledge/domain';

export class WorkspaceAccessError extends Error {
  readonly code = 'FORBIDDEN' as const;
}

export async function requireWorkspaceCapability(
  client: SupabaseClient<Database>,
  workspaceId: string,
  capability: Capability
): Promise<WorkspaceContext> {
  const { data, error } = await client
    .rpc('assert_workspace_capability', {
      target_workspace_id: workspaceId,
      requested_capability: capability,
    })
    .single();
  if (error || !data) throw new WorkspaceAccessError('你已无权访问此工作区或执行此操作');
  return WorkspaceContextSchema.parse({
    workspaceId: data.workspace_id,
    userId: data.user_id,
    role: data.role,
    kind: data.kind,
  });
}
```

```ts
// apps/web/src/features/auth/service.ts
import { z } from 'zod';
import type { ActionResult } from '@knowledge/domain';

type AuthError = { message: string };
export type AuthGateway = {
  signInWithOtp(input: {
    email: string;
    options: { emailRedirectTo: string };
  }): Promise<{ error: AuthError | null }>;
  signInWithOAuth(input: {
    provider: 'google';
    options: { redirectTo: string };
  }): Promise<{ data: { url: string | null }; error: AuthError | null }>;
  exchangeCodeForSession(code: string): Promise<{ error: AuthError | null }>;
};

export async function requestEmailOtp(
  auth: AuthGateway,
  input: { email: string; callbackUrl: string }
): Promise<ActionResult<undefined>> {
  const email = z.string().email().parse(input.email).toLowerCase();
  const { error } = await auth.signInWithOtp({
    email,
    options: { emailRedirectTo: input.callbackUrl },
  });
  return error
    ? { ok: false, error: { code: 'DEPENDENCY_FAILED', message: '验证码邮件发送失败，请稍后重试' } }
    : { ok: true, data: undefined };
}

export async function beginGoogleSignIn(
  auth: AuthGateway,
  input: { callbackUrl: string }
): Promise<ActionResult<{ url: string }>> {
  const { data, error } = await auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: input.callbackUrl },
  });
  return error || !data.url
    ? { ok: false, error: { code: 'DEPENDENCY_FAILED', message: 'Google 登录暂时不可用' } }
    : { ok: true, data: { url: data.url } };
}
```

- [x] **Step 5: 实现登录 Server Actions、回调和登录后直接进入工作台**

```ts
// apps/web/src/features/auth/actions.ts
'use server';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { beginGoogleSignIn, requestEmailOtp } from './service';

export type LoginState = { status: 'idle' | 'sent' | 'error'; message: string };
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
function callbackUrl(next: string): string {
  const url = new URL('/auth/callback', process.env.APP_URL);
  url.searchParams.set('next', next);
  return url.toString();
}

export async function requestEmailOtpAction(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const client = await createServerSupabaseClient();
  const next = safeNext(formData.get('next'));
  const result = await requestEmailOtp(client.auth, {
    email: String(formData.get('email') ?? ''),
    callbackUrl: callbackUrl(next),
  });
  return result.ok
    ? { status: 'sent', message: '登录链接已发送，请检查邮箱。' }
    : { status: 'error', message: result.error.message };
}

export async function signInWithGoogleAction(formData: FormData): Promise<never> {
  const client = await createServerSupabaseClient();
  const result = await beginGoogleSignIn(client.auth, {
    callbackUrl: callbackUrl(safeNext(formData.get('next'))),
  });
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.error.message)}`);
  redirect(result.data.url);
}
```

```ts
// apps/web/src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedNext = request.nextUrl.searchParams.get('next') ?? '/';
  const safeNext =
    requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';
  if (!code) return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  const client = await createServerSupabaseClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(
    new URL(error ? '/login?error=session_exchange' : safeNext, request.url)
  );
}
```

```tsx
// apps/web/src/app/page.tsx
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EntryPage() {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: workspaceId, error } = await client.rpc('resolve_entry_workspace');
  if (error || !workspaceId) throw new Error('无法确定可访问的工作区');
  redirect(`/w/${workspaceId}/library`);
}
```

```tsx
// apps/web/src/features/auth/login-form.tsx
'use client';
import { useActionState } from 'react';
import { requestEmailOtpAction, signInWithGoogleAction, type LoginState } from './actions';

const initialState: LoginState = { status: 'idle', message: '' };
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestEmailOtpAction, initialState);
  return (
    <div className="w-full max-w-sm">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium" htmlFor="email">
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="min-h-11 w-full rounded-[6px] border border-[var(--line)] px-3"
        />
        <button
          disabled={pending}
          className="min-h-11 w-full rounded-[6px] bg-[var(--accent)] px-4 text-white"
        >
          {pending ? '正在发送' : '发送登录链接'}
        </button>
        <p
          aria-live="polite"
          className={
            state.status === 'error' ? 'text-sm text-red-700' : 'text-sm text-[var(--muted)]'
          }
        >
          {state.message}
        </p>
      </form>
      <div className="my-5 border-t border-[var(--line)]" />
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="next" value={next} />
        <button className="min-h-11 w-full rounded-[6px] border border-[var(--line)] px-4">
          使用 Google 登录
        </button>
      </form>
    </div>
  );
}
```

```tsx
// apps/web/src/app/(auth)/login/page.tsx
import { LoginForm } from '@/features/auth/login-form';

function safeNext(value: string | string[] | undefined) {
  const next = typeof value === 'string' ? value : '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--canvas)] p-6">
      <section className="w-full max-w-sm" aria-labelledby="login-title">
        <h1 id="login-title" className="text-3xl font-semibold tracking-[-0.03em]">
          进入知识工作台
        </h1>
        <p className="mb-7 mt-2 text-sm text-[var(--muted)]">使用邮箱验证码或 Google 登录。</p>
        <LoginForm next={safeNext(query.next)} />
        {query.error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            登录未完成，请重试。
          </p>
        )}
      </section>
    </main>
  );
}
```

- [x] **Step 6: 运行认证、权限门、数据库和类型测试**

Run: `pnpm --filter @knowledge/web test -- src/features/auth/service.test.ts src/lib/workspaces/access.test.ts && pnpm --filter @knowledge/web typecheck && pnpm test:db`

Expected: PASS；Google provider 固定为 `google`，权限拒绝不会被前端角色猜测绕过，数据库测试仍全部通过。

- [x] **Step 7: 提交登录与服务端权限门**

```bash
git add .env.example apps/web package.json pnpm-lock.yaml
git commit -m "feat: add private workspace authentication entry"
```

### Task 5: Build the Notion-Inspired Responsive Workspace Shell

**Files:**

- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/public/illustrations/first-upload.png`
- Create: `apps/web/public/illustrations/knowledge-graph.png`
- Create: `apps/web/public/illustrations/grounded-chat.png`
- Create: `apps/web/src/components/ui/app-icon.tsx`
- Create: `apps/web/src/components/ui/empty-state.tsx`
- Create: `apps/web/src/components/shell/app-shell.tsx`
- Create: `apps/web/src/components/shell/workspace-switcher.tsx`
- Create: `apps/web/src/features/workspaces/queries.ts`
- Create: `apps/web/src/features/workspaces/actions.ts`
- Create: `apps/web/src/app/(workspace)/w/[workspaceId]/layout.tsx`
- Create: `apps/web/src/app/(workspace)/w/[workspaceId]/library/page.tsx`
- Create: `apps/web/src/app/(workspace)/w/[workspaceId]/graph/page.tsx`
- Create: `apps/web/src/app/(workspace)/w/[workspaceId]/chat/page.tsx`
- Create: `apps/web/src/app/(workspace)/w/[workspaceId]/qa/page.tsx`
- Test: `apps/web/src/components/shell/app-shell.test.tsx`
- Test: `apps/web/src/components/ui/empty-state.test.tsx`

**Interfaces:**

- Consumes: `requireWorkspaceCapability(...)`, `WorkspaceContext`, `createServerSupabaseClient()`, RPC `set_last_workspace`.
- Produces: `WorkspaceSummary = { id: string; name: string; kind: WorkspaceKind; role: WorkspaceRole }`; `listAccessibleWorkspaces(client): Promise<WorkspaceSummary[]>`; `setLastWorkspaceAction(workspaceId: string): Promise<ActionResult<undefined>>`; `AppShellProps = { context: WorkspaceContext; workspaces: WorkspaceSummary[]; children: ReactNode }`.

- [x] **Step 1: 写工作台导航与有意义空状态的失败组件测试**

```tsx
// apps/web/src/components/shell/app-shell.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';

const context = {
  workspaceId: '21000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000001',
  role: 'owner' as const,
  kind: 'team' as const,
};

describe('AppShell', () => {
  it('renders task navigation and an accessible mobile drawer control', () => {
    render(
      <AppShell
        context={context}
        workspaces={[{ id: context.workspaceId, name: 'Team One', kind: 'team', role: 'owner' }]}
      >
        <p>内容</p>
      </AppShell>
    );
    expect(screen.getByRole('button', { name: '打开侧栏' })).toBeVisible();
    expect(screen.getByRole('link', { name: '资料库' })).toHaveAttribute(
      'href',
      `/w/${context.workspaceId}/library`
    );
    expect(screen.getByRole('link', { name: '知识图谱' })).toBeVisible();
    expect(screen.getByRole('link', { name: '私密对话' })).toBeVisible();
    expect(screen.getByText('内容')).toBeVisible();
  });
});
```

```tsx
// apps/web/src/components/ui/empty-state.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('never relies on illustration alone', () => {
    render(
      <EmptyState
        imageSrc="/illustrations/first-upload.png"
        imageAlt="人物把第一份资料放入档案盒"
        title="放入第一份资料"
        description="上传后可以离开，系统会继续处理。"
        action={<button>上传资料</button>}
      />
    );
    expect(screen.getByRole('img', { name: '人物把第一份资料放入档案盒' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '放入第一份资料' })).toBeVisible();
    expect(screen.getByRole('button', { name: '上传资料' })).toBeVisible();
  });
});
```

- [x] **Step 2: 运行组件测试并确认工作台组件不存在**

Run: `pnpm --filter @knowledge/web test -- src/components/shell/app-shell.test.tsx src/components/ui/empty-state.test.tsx`

Expected: FAIL，报告无法解析 `app-shell` 与 `empty-state`。

- [x] **Step 3: 写入设计 token、字体、插画副本与统一图标组件**

Run:

```bash
mkdir -p apps/web/public/illustrations
cp docs/superpowers/assets/illustration-first-upload.png apps/web/public/illustrations/first-upload.png
cp docs/superpowers/assets/illustration-knowledge-graph.png apps/web/public/illustrations/knowledge-graph.png
cp docs/superpowers/assets/illustration-grounded-chat.png apps/web/public/illustrations/grounded-chat.png
```

```css
/* apps/web/src/app/globals.css */
@import 'tailwindcss';

:root {
  --canvas: #fffefc;
  --sidebar: #f7f7f5;
  --text: #37352f;
  --muted: #6b6a66;
  --line: #e9e9e7;
  --hover: #efefed;
  --accent: #2869d8;
  --radius-control: 6px;
  color: var(--text);
  background: var(--canvas);
  font-family:
    Geist,
    'PingFang SC',
    'Microsoft YaHei',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

* {
  box-sizing: border-box;
}
body {
  margin: 0;
  min-width: 320px;
  background: var(--canvas);
}
button,
input,
select {
  font: inherit;
}
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.icon-button {
  min-width: 44px;
  min-height: 44px;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-control);
}
.workspace-grid {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
}
.workspace-sidebar {
  background: var(--sidebar);
  border-right: 1px solid var(--line);
  padding: 10px 8px;
}
.workspace-main {
  min-width: 0;
}
.page-content {
  width: min(100% - 32px, 1120px);
  margin: 0 auto;
  padding: 56px 0 96px;
}
.mobile-bar {
  display: none;
}
@media (max-width: 767px) {
  .workspace-grid {
    display: block;
  }
  .workspace-sidebar {
    position: fixed;
    z-index: 30;
    inset: 0 auto 0 0;
    width: min(88vw, 320px);
    transform: translateX(-100%);
    box-shadow: 0 12px 32px rgb(55 53 47 / 16%);
    transition: transform 160ms ease;
  }
  .workspace-sidebar[data-open='true'] {
    transform: translateX(0);
  }
  .mobile-bar {
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--line);
  }
  .page-content {
    width: min(100% - 24px, 1120px);
    padding-top: 32px;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

```tsx
// apps/web/src/components/ui/app-icon.tsx
import type { ComponentType, SVGProps } from 'react';

type RemixComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
const sizes = { inline: 16, nav: 18, action: 20 } as const;

export function AppIcon({
  icon: Icon,
  size = 'nav',
}: {
  icon: RemixComponent;
  size?: keyof typeof sizes;
}) {
  return <Icon aria-hidden="true" focusable="false" size={sizes[size]} />;
}
```

```tsx
// apps/web/src/components/ui/empty-state.tsx
import Image from 'next/image';
import type { ReactNode } from 'react';

export function EmptyState(props: {
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <section
      aria-labelledby="empty-title"
      className="mx-auto flex max-w-xl flex-col items-center py-12 text-center"
    >
      <Image src={props.imageSrc} alt={props.imageAlt} width={362} height={272} priority />
      <h1 id="empty-title" className="mt-5 text-2xl font-semibold tracking-[-0.02em]">
        {props.title}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{props.description}</p>
      <div className="mt-5">{props.action}</div>
    </section>
  );
}
```

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '知识工作台', template: '%s · 知识工作台' },
  description: '默认私密的个人与团队知识空间',
  referrer: 'strict-origin-when-cross-origin',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

- [x] **Step 4: 实现工作区查询、切换和响应式树状导航**

```ts
// apps/web/src/features/workspaces/queries.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceKind, WorkspaceRole } from '@knowledge/domain';
import type { Database } from '@knowledge/domain';

export type WorkspaceSummary = {
  id: string;
  name: string;
  kind: WorkspaceKind;
  role: WorkspaceRole;
};

export async function listAccessibleWorkspaces(
  client: SupabaseClient<Database>
): Promise<WorkspaceSummary[]> {
  const { data, error } = await client
    .from('memberships')
    .select('role, workspaces!inner(id,name,kind,state)')
    .eq('status', 'active')
    .eq('workspaces.state', 'ACTIVE')
    .order('joined_at', { ascending: true });
  if (error) throw new Error('无法读取工作区');
  return data.map((row) => ({
    id: row.workspaces.id,
    name: row.workspaces.name,
    kind: row.workspaces.kind,
    role: row.role,
  }));
}
```

```ts
// apps/web/src/features/workspaces/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@knowledge/domain';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function setLastWorkspaceAction(
  workspaceId: string
): Promise<ActionResult<undefined>> {
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc('set_last_workspace', { target_workspace_id: workspaceId });
  if (error)
    return { ok: false, error: { code: 'FORBIDDEN', message: '你已无法切换到这个工作区' } };
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}
```

```tsx
// apps/web/src/components/shell/workspace-switcher.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { WorkspaceSummary } from '@/features/workspaces/queries';
import { setLastWorkspaceAction } from '@/features/workspaces/actions';

export function WorkspaceSwitcher({
  currentId,
  workspaces,
}: {
  currentId: string;
  workspaces: WorkspaceSummary[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <label className="sr-only" htmlFor="workspace-switcher">
        当前工作区
      </label>
      <select
        id="workspace-switcher"
        value={currentId}
        disabled={pending}
        className="min-h-11 w-full rounded-[6px] bg-transparent px-2 font-medium"
        onChange={(event) => {
          const workspaceId = event.currentTarget.value;
          startTransition(async () => {
            const result = await setLastWorkspaceAction(workspaceId);
            if (!result.ok) return setError(result.error.message);
            router.push(`/w/${workspaceId}/library`);
          });
        }}
      >
        {workspaces.map((workspace) => (
          <option value={workspace.id} key={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      <p aria-live="polite" className="text-xs text-red-700">
        {error}
      </p>
    </div>
  );
}
```

```tsx
// apps/web/src/components/shell/app-shell.tsx
'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  RiBook2Line,
  RiChat3Line,
  RiCloseLine,
  RiMenuLine,
  RiNodeTree,
  RiQuestionAnswerLine,
  RiTeamLine,
} from '@remixicon/react';
import type { WorkspaceContext } from '@knowledge/domain';
import type { WorkspaceSummary } from '@/features/workspaces/queries';
import { AppIcon } from '@/components/ui/app-icon';
import { WorkspaceSwitcher } from './workspace-switcher';

export type AppShellProps = {
  context: WorkspaceContext;
  workspaces: WorkspaceSummary[];
  children: ReactNode;
};

export function AppShell({ context, workspaces, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const base = `/w/${context.workspaceId}`;
  const links = [
    ['资料库', `${base}/library`, RiBook2Line],
    ['知识图谱', `${base}/graph`, RiNodeTree],
    ['私密对话', `${base}/chat`, RiChat3Line],
    ['团队问答', `${base}/qa`, RiQuestionAnswerLine],
    ['成员与邀请', `${base}/settings/members`, RiTeamLine],
  ] as const;
  return (
    <div className="workspace-grid">
      <header className="mobile-bar">
        <button
          className="icon-button"
          aria-label="打开侧栏"
          title="打开侧栏"
          onClick={() => setOpen(true)}
        >
          <AppIcon icon={RiMenuLine} size="action" />
        </button>
      </header>
      <aside className="workspace-sidebar" data-open={open} aria-label="工作区侧栏">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <WorkspaceSwitcher currentId={context.workspaceId} workspaces={workspaces} />
          </div>
          <button
            className="icon-button md:hidden"
            aria-label="关闭侧栏"
            title="关闭侧栏"
            onClick={() => setOpen(false)}
          >
            <AppIcon icon={RiCloseLine} />
          </button>
        </div>
        <nav aria-label="主导航" className="mt-3 space-y-0.5">
          {links.map(([label, href, icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-[6px] px-2 text-sm hover:bg-[var(--hover)]"
            >
              <AppIcon icon={icon} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="workspace-main">{children}</main>
    </div>
  );
}
```

- [x] **Step 5: 把每个受保护页面绑定到单一工作区上下文**

```tsx
// apps/web/src/app/(workspace)/w/[workspaceId]/layout.tsx
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { listAccessibleWorkspaces } from '@/features/workspaces/queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireWorkspaceCapability } from '@/lib/workspaces/access';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceCapability(client, workspaceId, 'documents.read').catch(
    () => null
  );
  if (!context) notFound();
  const workspaces = await listAccessibleWorkspaces(client);
  return (
    <AppShell context={context} workspaces={workspaces}>
      {children}
    </AppShell>
  );
}
```

```tsx
// apps/web/src/app/(workspace)/w/[workspaceId]/library/page.tsx
import { RiUploadCloud2Line } from '@remixicon/react';
import { AppIcon } from '@/components/ui/app-icon';
import { EmptyState } from '@/components/ui/empty-state';

export default function LibraryPage() {
  return (
    <div className="page-content">
      <EmptyState
        imageSrc="/illustrations/first-upload.png"
        imageAlt="人物把第一份资料放入档案盒"
        title="放入第一份资料"
        description="支持图片、PDF、DOCX、Markdown 和 TXT。原件保存后，你可以离开页面，处理会继续进行。"
        action={
          <button
            data-open-upload
            className="inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-[var(--accent)] px-4 text-white"
          >
            <AppIcon icon={RiUploadCloud2Line} size="action" />
            上传资料
          </button>
        }
      />
    </div>
  );
}
```

```tsx
// apps/web/src/app/(workspace)/w/[workspaceId]/graph/page.tsx
import { EmptyState } from '@/components/ui/empty-state';
export default function GraphPage() {
  return (
    <div className="page-content">
      <EmptyState
        imageSrc="/illustrations/knowledge-graph.png"
        imageAlt="成员协作连接资料节点"
        title="连接会从资料中出现"
        description="完成处理后，有原文证据的资料、主题、人物和概念会在这里形成连接。"
        action={
          <a
            href="../library"
            className="inline-flex min-h-11 items-center rounded-[6px] border border-[var(--line)] px-4"
          >
            返回资料库
          </a>
        }
      />
    </div>
  );
}
```

```tsx
// apps/web/src/app/(workspace)/w/[workspaceId]/chat/page.tsx
import { EmptyState } from '@/components/ui/empty-state';
export default function ChatPage() {
  return (
    <div className="page-content">
      <EmptyState
        imageSrc="/illustrations/grounded-chat.png"
        imageAlt="人物基于多份来源资料提问"
        title="从你的资料开始提问"
        description="对话默认私密；即使使用团队资料，团队管理员也不能读取你的会话。"
        action={
          <button
            disabled
            className="min-h-11 rounded-[6px] border border-[var(--line)] px-4 text-[var(--muted)]"
          >
            资料处理完成后可提问
          </button>
        }
      />
    </div>
  );
}
```

```tsx
// apps/web/src/app/(workspace)/w/[workspaceId]/qa/page.tsx
export default function PublishedQaPage() {
  return (
    <div className="page-content">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">团队问答</h1>
      <div className="mt-12 border-y border-[var(--line)] py-10">
        <h2 className="text-lg font-medium">还没有已发布问答</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
          只有成员从私密对话中明确整理并发布的答案才会出现在这里；原始私聊不会公开给团队。
        </p>
      </div>
    </div>
  );
}
```

- [x] **Step 6: 运行组件测试、类型检查和生产构建**

Run: `pnpm --filter @knowledge/web test -- src/components/shell/app-shell.test.tsx src/components/ui/empty-state.test.tsx && pnpm --filter @knowledge/web typecheck && pnpm --filter @knowledge/web build`

Expected: PASS；构建不包含第二套图标库，受保护页面均为动态渲染。

- [x] **Step 7: 提交工作台壳**

```bash
git add apps/web/src/app apps/web/src/components apps/web/src/features/workspaces apps/web/public/illustrations
git commit -m "feat: add responsive knowledge workspace shell"
```

### Task 6: Add Team Creation, Email Invitations, and Member Administration

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/src/components/shell/app-shell.tsx`
- Modify: `apps/web/src/features/workspaces/actions.ts`
- Create: `apps/web/src/features/workspaces/schemas.ts`
- Create: `apps/web/src/features/workspaces/invitation-mailer.ts`
- Create: `apps/web/src/features/workspaces/invitation-service.ts`
- Create: `apps/web/src/features/workspaces/member-queries.ts`
- Create: `apps/web/src/features/workspaces/create-team-form.tsx`
- Create: `apps/web/src/features/workspaces/member-manager.tsx`
- Create: `apps/web/src/app/(workspace)/workspaces/new/page.tsx`
- Create: `apps/web/src/app/(workspace)/w/[workspaceId]/settings/members/page.tsx`
- Create: `apps/web/src/app/invite/[token]/page.tsx`
- Test: `apps/web/src/features/workspaces/invitation-service.test.ts`

**Interfaces:**

- Consumes: `ActionResult<T>`, `WorkspaceRole`, `requireWorkspaceCapability(...)`; all workspace/member/invitation RPCs from Task 3.
- Produces: `InvitationMailer.send(input: InvitationEmail): Promise<void>`; `inviteMember(client, mailer, input): Promise<ActionResult<{ invitationId: string; expiresAt: string }>>`; `createTeamWorkspaceAction(input): Promise<ActionResult<{ workspaceId: string }>>`; `createInvitationAction(input): Promise<ActionResult<{ invitationId: string; expiresAt: string }>>`; member actions for role change, removal and ownership transfer.

- [x] **Step 1: 写邀请令牌只进入邮件、发送失败即撤销的失败测试**

```ts
// apps/web/src/features/workspaces/invitation-service.test.ts
import { describe, expect, it, vi } from 'vitest';
import { inviteMember } from './invitation-service';

describe('inviteMember', () => {
  it('sends the one-time token but never returns it to the browser', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          invitation_id: '31000000-0000-4000-8000-000000000001',
          raw_token: 'secret-one-time-token',
          expires_at: '2026-09-09T09:00:00.000Z',
        },
      ],
      error: null,
    });
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await inviteMember(
      { rpc } as never,
      { send },
      {
        workspaceId: '21000000-0000-4000-8000-000000000001',
        workspaceName: 'Team One',
        inviterName: 'Owner',
        email: 'new@example.test',
        role: 'editor',
        appUrl: 'https://app.example.test',
        requestId: '32000000-0000-4000-8000-000000000001',
      }
    );
    expect(result).toEqual({
      ok: true,
      data: {
        invitationId: '31000000-0000-4000-8000-000000000001',
        expiresAt: '2026-09-09T09:00:00.000Z',
      },
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.test',
        acceptUrl: 'https://app.example.test/invite/secret-one-time-token',
      })
    );
  });

  it('revokes the database invitation when email delivery fails', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            invitation_id: '31000000-0000-4000-8000-000000000001',
            raw_token: 'token',
            expires_at: '2026-09-09T09:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    const result = await inviteMember(
      { rpc } as never,
      { send: vi.fn().mockRejectedValue(new Error('mail down')) },
      {
        workspaceId: '21000000-0000-4000-8000-000000000001',
        workspaceName: 'Team One',
        inviterName: 'Owner',
        email: 'new@example.test',
        role: 'viewer',
        appUrl: 'https://app.example.test',
        requestId: '32000000-0000-4000-8000-000000000001',
      }
    );
    expect(result).toEqual({
      ok: false,
      error: { code: 'DEPENDENCY_FAILED', message: '邀请邮件发送失败，邀请已撤销' },
    });
    expect(rpc).toHaveBeenLastCalledWith(
      'revoke_invitation',
      expect.objectContaining({
        target_invitation_id: '31000000-0000-4000-8000-000000000001',
      })
    );
  });
});
```

- [x] **Step 2: 运行邀请测试并确认服务尚不存在**

Run: `pnpm --filter @knowledge/web add resend@6.25.0 --save-exact && pnpm --filter @knowledge/web test -- src/features/workspaces/invitation-service.test.ts`

Expected: FAIL，报告无法解析 `./invitation-service`。

- [x] **Step 3: 实现厂商隔离的纯文本邀请邮件和单次令牌服务**

```ts
// apps/web/src/features/workspaces/invitation-mailer.ts
import 'server-only';
import { Resend } from 'resend';
import type { WorkspaceRole } from '@knowledge/domain';

export type InvitationEmail = {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  acceptUrl: string;
  expiresAt: string;
};
export interface InvitationMailer {
  send(input: InvitationEmail): Promise<void>;
}

export function createInvitationMailer(): InvitationMailer {
  const resend = new Resend(process.env.RESEND_API_KEY);
  return {
    async send(input) {
      const { error } = await resend.emails.send({
        from: process.env.INVITATION_EMAIL_FROM!,
        to: input.to,
        subject: `${input.inviterName} 邀请你加入 ${input.workspaceName}`,
        text: [
          `${input.inviterName} 邀请你以 ${input.role} 身份加入 ${input.workspaceName}。`,
          `请在 ${input.expiresAt} 前使用一次性链接接受邀请：`,
          input.acceptUrl,
        ].join('\n\n'),
      });
      if (error) throw new Error(error.message);
    },
  };
}
```

```ts
// apps/web/src/features/workspaces/invitation-service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionResult, WorkspaceRole } from '@knowledge/domain';
import type { Database } from '@knowledge/domain';
import type { InvitationMailer } from './invitation-mailer';

type InviteInput = {
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  email: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  appUrl: string;
  requestId: string;
};

export async function inviteMember(
  client: SupabaseClient<Database>,
  mailer: InvitationMailer,
  input: InviteInput
): Promise<ActionResult<{ invitationId: string; expiresAt: string }>> {
  const { data, error } = await client.rpc('create_invitation', {
    target_workspace_id: input.workspaceId,
    target_email: input.email,
    target_role: input.role,
    correlation_id: input.requestId,
  });
  const invitation = data?.[0];
  if (error || !invitation)
    return { ok: false, error: { code: 'FORBIDDEN', message: '无法创建此邀请' } };
  try {
    await mailer.send({
      to: input.email,
      inviterName: input.inviterName,
      workspaceName: input.workspaceName,
      role: input.role,
      acceptUrl: `${input.appUrl}/invite/${invitation.raw_token}`,
      expiresAt: invitation.expires_at,
    });
  } catch {
    await client.rpc('revoke_invitation', {
      target_workspace_id: input.workspaceId,
      target_invitation_id: invitation.invitation_id,
      correlation_id: input.requestId,
    });
    return {
      ok: false,
      error: { code: 'DEPENDENCY_FAILED', message: '邀请邮件发送失败，邀请已撤销' },
    };
  }
  return {
    ok: true,
    data: { invitationId: invitation.invitation_id, expiresAt: invitation.expires_at },
  };
}
```

- [x] **Step 4: 实现团队和成员 Server Actions，所有动作只调用数据库 RPC**

```ts
// apps/web/src/features/workspaces/schemas.ts
import { z } from 'zod';
export const CreateTeamSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{2,62}$/),
});
export const InviteMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  role: z.enum(['admin', 'editor', 'viewer']),
});
```

```ts
// append to apps/web/src/features/workspaces/actions.ts
import { randomUUID } from 'node:crypto';
import type { WorkspaceRole } from '@knowledge/domain';
import { createInvitationMailer } from './invitation-mailer';
import { inviteMember } from './invitation-service';
import { CreateTeamSchema, InviteMemberSchema } from './schemas';

export async function createTeamWorkspaceAction(input: {
  name: string;
  slug: string;
}): Promise<ActionResult<{ workspaceId: string }>> {
  const parsed = CreateTeamSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: 'INVALID_INPUT', message: '请检查团队名称和网址标识' } };
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc('create_team_workspace', {
    workspace_name: parsed.data.name,
    workspace_slug: parsed.data.slug,
    correlation_id: randomUUID(),
  });
  return error || !data
    ? { ok: false, error: { code: 'CONFLICT', message: '团队网址标识已被使用' } }
    : { ok: true, data: { workspaceId: data } };
}

export async function createInvitationAction(
  input: unknown
): Promise<ActionResult<{ invitationId: string; expiresAt: string }>> {
  const parsed = InviteMemberSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: 'INVALID_INPUT', message: '请检查邮箱和角色' } };
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: { code: 'AUTH_REQUIRED', message: '请先登录' } };
  const [{ data: workspace }, { data: profile }] = await Promise.all([
    client.from('workspaces').select('name').eq('id', parsed.data.workspaceId).single(),
    client.from('profiles').select('display_name').eq('id', user.id).single(),
  ]);
  if (!workspace || !profile)
    return { ok: false, error: { code: 'FORBIDDEN', message: '无法读取邀请上下文' } };
  return inviteMember(client, createInvitationMailer(), {
    ...parsed.data,
    workspaceName: workspace.name,
    inviterName: profile.display_name,
    appUrl: process.env.APP_URL!,
    requestId: randomUUID(),
  });
}

export async function changeMemberRoleAction(
  workspaceId: string,
  userId: string,
  role: Exclude<WorkspaceRole, 'owner'>
): Promise<ActionResult<undefined>> {
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc('change_member_role', {
    target_workspace_id: workspaceId,
    target_user_id: userId,
    new_role: role,
    correlation_id: randomUUID(),
  });
  return error
    ? { ok: false, error: { code: 'FORBIDDEN', message: '你不能修改此成员角色' } }
    : { ok: true, data: undefined };
}

export async function removeMemberAction(
  workspaceId: string,
  userId: string
): Promise<ActionResult<undefined>> {
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc('remove_member', {
    target_workspace_id: workspaceId,
    target_user_id: userId,
    correlation_id: randomUUID(),
  });
  return error
    ? { ok: false, error: { code: 'FORBIDDEN', message: '你不能移除此成员' } }
    : { ok: true, data: undefined };
}

export async function transferOwnershipAction(
  workspaceId: string,
  userId: string
): Promise<ActionResult<undefined>> {
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc('transfer_workspace_ownership', {
    target_workspace_id: workspaceId,
    new_owner_user_id: userId,
    correlation_id: randomUUID(),
  });
  return error
    ? { ok: false, error: { code: 'FORBIDDEN', message: '所有权转移失败' } }
    : { ok: true, data: undefined };
}
```

- [x] **Step 5: 实现成员读取、团队设置和邀请接受页面**

```ts
// apps/web/src/features/workspaces/member-queries.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@knowledge/domain';

export async function getMemberSettings(client: SupabaseClient<Database>, workspaceId: string) {
  const [{ data: members, error: memberError }, { data: invitations, error: inviteError }] =
    await Promise.all([
      client
        .from('memberships')
        .select('user_id,role,status,joined_at,profiles!inner(display_name)')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active'),
      client
        .from('invitations')
        .select('id,email,role,expires_at,accepted_at,revoked_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
    ]);
  if (memberError || inviteError) throw new Error('无法读取成员设置');
  return { members: members ?? [], invitations: invitations ?? [] };
}
```

```tsx
// apps/web/src/app/invite/[token]/page.tsx
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const metadata = { referrer: 'no-referrer' } as const;
export const dynamic = 'force-dynamic';

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  async function accept() {
    'use server';
    const serverClient = await createServerSupabaseClient();
    const { data: workspaceId, error } = await serverClient.rpc('accept_invitation', {
      raw_token: token,
      correlation_id: randomUUID(),
    });
    if (error || !workspaceId) redirect(`/invite/${token}?error=invalid`);
    redirect(`/w/${workspaceId}/library`);
  }
  return (
    <main className="page-content">
      <h1 className="text-2xl font-semibold">接受团队邀请</h1>
      <p className="mt-2 text-[var(--muted)]">邀请只可使用一次，并且必须与当前登录邮箱一致。</p>
      <form action={accept} className="mt-5">
        <button className="min-h-11 rounded-[6px] bg-[var(--accent)] px-4 text-white">
          接受邀请
        </button>
      </form>
    </main>
  );
}
```

```tsx
// apps/web/src/features/workspaces/create-team-form.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createTeamWorkspaceAction } from './actions';

export function CreateTeamForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await createTeamWorkspaceAction({
            name: String(form.get('name')),
            slug: String(form.get('slug')),
          });
          if (!result.ok) return setError(result.error.message);
          router.push(`/w/${result.data.workspaceId}/library`);
        });
      }}
    >
      <label className="block text-sm font-medium">
        团队名称
        <input
          name="name"
          required
          maxLength={80}
          className="mt-1 min-h-11 w-full rounded-[6px] border border-[var(--line)] px-3"
        />
      </label>
      <label className="block text-sm font-medium">
        网址标识
        <input
          name="slug"
          required
          pattern="[a-z0-9][a-z0-9-]{2,62}"
          className="mt-1 min-h-11 w-full rounded-[6px] border border-[var(--line)] px-3"
        />
      </label>
      <button
        disabled={pending}
        className="min-h-11 rounded-[6px] bg-[var(--accent)] px-4 text-white"
      >
        {pending ? '正在创建' : '创建团队'}
      </button>
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    </form>
  );
}
```

```tsx
// apps/web/src/features/workspaces/member-manager.tsx
'use client';
import { useState, useTransition } from 'react';
import type { WorkspaceRole } from '@knowledge/domain';
import {
  changeMemberRoleAction,
  createInvitationAction,
  removeMemberAction,
  transferOwnershipAction,
} from './actions';

type Member = { user_id: string; role: WorkspaceRole; profiles: { display_name: string } };
export function MemberManager(props: {
  workspaceId: string;
  currentUserId: string;
  currentRole: WorkspaceRole;
  members: Member[];
}) {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const roles =
    props.currentRole === 'owner'
      ? (['admin', 'editor', 'viewer'] as const)
      : (['editor', 'viewer'] as const);
  return (
    <section className="mt-8">
      {(props.currentRole === 'owner' || props.currentRole === 'admin') && (
        <form
          className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await createInvitationAction({
                workspaceId: props.workspaceId,
                email: form.get('email'),
                role: form.get('role'),
              });
              setMessage(result.ok ? '邀请已发送' : result.error.message);
            });
          }}
        >
          <input
            aria-label="邀请邮箱"
            name="email"
            type="email"
            required
            className="min-h-11 flex-1 rounded-[6px] border border-[var(--line)] px-3"
          />
          <select
            aria-label="邀请角色"
            name="role"
            className="min-h-11 rounded-[6px] border border-[var(--line)] px-2"
          >
            {roles.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
          <button
            disabled={pending}
            className="min-h-11 rounded-[6px] bg-[var(--accent)] px-4 text-white"
          >
            发送邀请
          </button>
        </form>
      )}
      <ul className="divide-y divide-[var(--line)]">
        {props.members.map((member) => {
          const canManage =
            props.currentRole === 'owner'
              ? member.role !== 'owner'
              : member.role !== 'owner' &&
                member.role !== 'admin' &&
                member.user_id !== props.currentUserId;
          return (
            <li key={member.user_id} className="flex min-h-14 items-center gap-3">
              <span className="min-w-0 flex-1 truncate">{member.profiles.display_name}</span>
              <span className="text-sm text-[var(--muted)]">{member.role}</span>
              {canManage && (
                <>
                  <select
                    aria-label={`修改 ${member.profiles.display_name} 的角色`}
                    defaultValue={member.role}
                    onChange={(event) =>
                      startTransition(async () => {
                        const result = await changeMemberRoleAction(
                          props.workspaceId,
                          member.user_id,
                          event.currentTarget.value as Exclude<WorkspaceRole, 'owner'>
                        );
                        setMessage(result.ok ? '角色已更新' : result.error.message);
                      })
                    }
                  >
                    {roles.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                  <button
                    className="min-h-11 px-2"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await removeMemberAction(props.workspaceId, member.user_id);
                        setMessage(result.ok ? '成员已移除' : result.error.message);
                      })
                    }
                  >
                    移除
                  </button>
                  {props.currentRole === 'owner' && (
                    <button
                      className="min-h-11 px-2"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await transferOwnershipAction(
                            props.workspaceId,
                            member.user_id
                          );
                          setMessage(result.ok ? '所有权已转移' : result.error.message);
                        })
                      }
                    >
                      转移所有权
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="mt-3 text-sm text-[var(--muted)]">
        {message}
      </p>
    </section>
  );
}
```

```tsx
// apps/web/src/app/(workspace)/workspaces/new/page.tsx
import { CreateTeamForm } from '@/features/workspaces/create-team-form';
export default function NewTeamPage() {
  return (
    <main className="page-content">
      <h1 className="text-3xl font-semibold">创建团队空间</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">团队资料默认对所有有效成员可见。</p>
      <CreateTeamForm />
    </main>
  );
}
```

```tsx
// apps/web/src/app/(workspace)/w/[workspaceId]/settings/members/page.tsx
import { MemberManager } from '@/features/workspaces/member-manager';
import { getMemberSettings } from '@/features/workspaces/member-queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireWorkspaceCapability } from '@/lib/workspaces/access';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceCapability(client, workspaceId, 'documents.read');
  const settings = await getMemberSettings(client, workspaceId);
  return (
    <div className="page-content">
      <h1 className="text-3xl font-semibold">成员与邀请</h1>
      {context.kind === 'personal' ? (
        <p className="mt-4 text-[var(--muted)]">个人空间只有你本人，不能邀请其他成员。</p>
      ) : (
        <MemberManager
          workspaceId={workspaceId}
          currentUserId={context.userId}
          currentRole={context.role}
          members={settings.members}
        />
      )}
    </div>
  );
}
```

```tsx
// add beneath WorkspaceSwitcher in apps/web/src/components/shell/app-shell.tsx
<Link
  href="/workspaces/new"
  className="mt-1 flex min-h-11 items-center rounded-[6px] px-2 text-sm hover:bg-[var(--hover)]"
>
  新建团队
</Link>
```

- [x] **Step 6: 运行邀请单元测试、数据库角色矩阵和生产构建**

Run: `pnpm --filter @knowledge/web test -- src/features/workspaces/invitation-service.test.ts && pnpm test:db && pnpm --filter @knowledge/web typecheck && pnpm --filter @knowledge/web build`

Expected: PASS；邮件失败会撤销邀请，浏览器返回值不含原始令牌，四角色数据库断言保持通过。

- [x] **Step 7: 提交团队成员旅程**

```bash
git add apps/web/package.json apps/web/src/components/shell/app-shell.tsx apps/web/src/features/workspaces apps/web/src/app/invite apps/web/src/app/\(workspace\)/workspaces apps/web/src/app/\(workspace\)/w/\[workspaceId\]/settings pnpm-lock.yaml
git commit -m "feat: add team invitations and member roles"
```

### Task 7: Create Private Storage and Path-Scoped Upload Sessions

**Files:**

- Create: `supabase/migrations/0004_private_upload_sessions.sql`
- Create: `supabase/tests/0004_private_upload_sessions.test.sql`
- Regenerate: `packages/domain/src/database.types.ts`
- Create: `apps/web/src/lib/supabase/admin.ts`
- Create: `apps/web/src/features/uploads/service.ts`
- Create: `apps/web/src/app/api/uploads/sessions/route.ts`
- Create: `apps/web/src/app/api/uploads/sessions/[sessionId]/complete/route.ts`
- Test: `apps/web/src/features/uploads/service.test.ts`

**Interfaces:**

- Consumes: `CreateUploadSessionsInput`, `UploadSession`, `parseUploadBatch(...)`, `requireWorkspaceCapability(...)`; tables and access functions from Tasks 2–3.
- Produces: tables `documents`, `document_revisions`, `upload_sessions`; enum `document_revision_state`; RPCs `create_upload_batch(uuid, jsonb, uuid)`, `complete_upload_session(uuid, uuid)`, `abort_upload_sessions(uuid[], uuid)`; `createUploadSessions(client, signer, input, requestId): Promise<UploadSession[]>`; `completeUploadSession(client, sessionId, requestId): Promise<{ documentId: string; revisionId: string; status: "QUEUED" }>`.

- [x] **Step 1: 写上传角色、租户路径、限制和 Storage 直访的失败数据库测试**

```sql
-- supabase/tests/0004_private_upload_sessions.test.sql
begin;
select extensions.plan(11);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('40000000-0000-4000-8000-000000000001'::uuid, 'upload-owner@example.test'),
  ('40000000-0000-4000-8000-000000000002'::uuid, 'upload-editor@example.test'),
  ('40000000-0000-4000-8000-000000000003'::uuid, 'upload-viewer@example.test'),
  ('40000000-0000-4000-8000-000000000004'::uuid, 'other-owner@example.test')
) as fixture(id, email);
insert into public.workspaces (id, kind, name, slug, owner_user_id, created_by) values
  ('41000000-0000-4000-8000-000000000001', 'team', 'Upload Team', 'upload-team', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
  ('41000000-0000-4000-8000-000000000002', 'team', 'Other Team', 'other-upload-team', '40000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004');
insert into public.memberships (workspace_id, user_id, role, status, joined_at) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'owner', 'active', now()),
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'editor', 'active', now()),
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'viewer', 'active', now()),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select * from public.create_upload_batch('41000000-0000-4000-8000-000000000001', '[{"name":"readme.txt","size":12,"declaredMime":"text/plain"}]', gen_random_uuid())$$,
  '42501', null, 'viewer cannot create upload sessions'
);

select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
create temporary table created_upload as
select * from public.create_upload_batch(
  '41000000-0000-4000-8000-000000000001',
  '[{"name":"readme.txt","size":12,"declaredMime":"text/plain"}]',
  '42000000-0000-4000-8000-000000000001'
);
select extensions.is((select count(*)::integer from created_upload), 1, 'editor creates one session');
select extensions.like((select object_path from created_upload), 'quarantine/41000000-0000-4000-8000-000000000001/%', 'path is fixed inside the workspace prefix');
select extensions.is((select count(*)::integer from public.documents where workspace_id = '41000000-0000-4000-8000-000000000001'), 1, 'document is pre-created');
select extensions.is((select count(*)::integer from public.document_revisions where workspace_id = '41000000-0000-4000-8000-000000000001' and state = 'UPLOADING'), 1, 'immutable revision is pre-created');
select extensions.is((select count(*)::integer from storage.objects where bucket_id = 'originals'), 0, 'authenticated users cannot list private originals');
select extensions.throws_ok(
  $$select * from public.create_upload_batch('41000000-0000-4000-8000-000000000002', '[{"name":"readme.txt","size":12,"declaredMime":"text/plain"}]', gen_random_uuid())$$,
  '42501', null, 'editor cannot target another workspace'
);
select extensions.throws_ok(
  $$select * from public.create_upload_batch('41000000-0000-4000-8000-000000000001',
    (select jsonb_agg(jsonb_build_object('name', 'f-' || n || '.txt', 'size', 1, 'declaredMime', 'text/plain')) from generate_series(1, 21) n), gen_random_uuid())$$,
  '22023', null, 'database rejects batches over twenty'
);

reset role;
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'originals', object_path, '40000000-0000-4000-8000-000000000002', '{"size":12,"mimetype":"text/plain"}'::jsonb from created_upload;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select * from public.complete_upload_session((select session_id from created_upload), '42000000-0000-4000-8000-000000000002');
select extensions.is((select state::text from public.document_revisions where id = (select revision_id from created_upload)), 'QUEUED', 'verified upload advances to queued');
select extensions.is((select count(*)::integer from public.audit_events where action = 'file.upload_completed'), 1, 'completion is audited');
select extensions.is((select count(*)::integer from public.upload_sessions where state = 'completed'), 1, 'session is single-use completed');

select * from extensions.finish();
rollback;
```

- [x] **Step 2: 运行数据库测试并确认上传表和 RPC 不存在**

Run: `pnpm db:reset && pnpm exec supabase test db supabase/tests/0004_private_upload_sessions.test.sql`

Expected: FAIL，报告 `function public.create_upload_batch(...) does not exist`。

- [x] **Step 3: 创建 Private Bucket、租户复合外键和上传状态表**

```sql
-- supabase/migrations/0004_private_upload_sessions.sql (schema section)
create type public.document_revision_state as enum (
  'UPLOADING', 'QUEUED', 'VALIDATING', 'EXTRACTING', 'CHUNKING',
  'ANALYZING', 'INDEXING', 'READY', 'RETRYING', 'FAILED', 'CANCELLED', 'SUPERSEDED'
);
create type public.upload_session_state as enum ('pending', 'completed', 'aborted', 'expired');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 255),
  uploaded_by uuid not null references public.profiles(id),
  status public.document_revision_state not null default 'UPLOADING',
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  document_id uuid not null,
  version_number integer not null default 1 check (version_number > 0),
  original_name text not null check (char_length(original_name) between 1 and 255),
  declared_mime text not null,
  byte_size bigint not null check (byte_size between 1 and 52428800),
  object_bucket text not null default 'originals' check (object_bucket = 'originals'),
  object_path text not null unique,
  state public.document_revision_state not null default 'UPLOADING',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, document_id, id),
  unique (workspace_id, document_id, version_number),
  foreign key (workspace_id, document_id) references public.documents(workspace_id, id) on delete cascade
);

alter table public.documents add constraint documents_current_revision_fk
  foreign key (workspace_id, id, current_revision_id)
  references public.document_revisions(workspace_id, document_id, id) deferrable initially deferred;

create table public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  document_id uuid not null,
  revision_id uuid not null,
  created_by uuid not null references public.profiles(id),
  object_bucket text not null default 'originals' check (object_bucket = 'originals'),
  object_path text not null unique,
  expected_size bigint not null check (expected_size between 1 and 52428800),
  expected_mime text not null,
  state public.upload_session_state not null default 'pending',
  expires_at timestamptz not null default now() + interval '2 hours',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, document_id) references public.documents(workspace_id, id) on delete cascade,
  foreign key (workspace_id, revision_id) references public.document_revisions(workspace_id, id) on delete cascade,
  foreign key (workspace_id, document_id, revision_id)
    references public.document_revisions(workspace_id, document_id, id) on delete cascade,
  check ((state = 'completed' and completed_at is not null) or (state <> 'completed' and completed_at is null))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('originals', 'originals', false, 52428800, array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown', 'text/plain'
]) on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
```

- [x] **Step 4: 实现只接收已验证工作区的批量创建、完成和中止 RPC**

```sql
-- supabase/migrations/0004_private_upload_sessions.sql (RPC section)
create or replace function public.create_upload_batch(
  target_workspace_id uuid, input_files jsonb, correlation_id uuid
) returns table (
  session_id uuid, workspace_id uuid, document_id uuid, revision_id uuid,
  object_path text, expires_at timestamptz
) language plpgsql security definer set search_path = '' as $$
declare item jsonb; doc_id uuid; rev_id uuid; sess_id uuid; suffix text; fixed_path text; expiration timestamptz;
begin
  perform * from public.assert_workspace_capability(target_workspace_id, 'documents.upload');
  if jsonb_typeof(input_files) <> 'array' or jsonb_array_length(input_files) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'upload batch must contain one to twenty files';
  end if;
  for item in select value from jsonb_array_elements(input_files) loop
    if (item->>'size')::bigint not between 1 and 52428800 then
      raise exception using errcode = '22023', message = 'file size exceeds limit';
    end if;
    suffix := lower(substring(item->>'name' from '(\.[^.]+)$'));
    if not (
      (suffix in ('.jpg', '.jpeg') and item->>'declaredMime' = 'image/jpeg') or
      (suffix = '.png' and item->>'declaredMime' = 'image/png') or
      (suffix = '.webp' and item->>'declaredMime' = 'image/webp') or
      (suffix = '.pdf' and item->>'declaredMime' = 'application/pdf') or
      (suffix = '.docx' and item->>'declaredMime' = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') or
      (suffix = '.md' and item->>'declaredMime' in ('text/markdown', 'text/plain')) or
      (suffix = '.txt' and item->>'declaredMime' = 'text/plain')
    ) then raise exception using errcode = '22023', message = 'unsupported extension and MIME pair'; end if;

    doc_id := gen_random_uuid(); rev_id := gen_random_uuid(); sess_id := gen_random_uuid(); expiration := now() + interval '2 hours';
    fixed_path := format('quarantine/%s/%s/%s/%s%s', target_workspace_id, doc_id, rev_id, gen_random_uuid(), suffix);
    insert into public.documents (id, workspace_id, title, uploaded_by)
    values (doc_id, target_workspace_id, regexp_replace(item->>'name', '\.[^.]+$', ''), auth.uid());
    insert into public.document_revisions (
      id, workspace_id, document_id, original_name, declared_mime, byte_size, object_path, created_by
    ) values (
      rev_id, target_workspace_id, doc_id, item->>'name', item->>'declaredMime', (item->>'size')::bigint, fixed_path, auth.uid()
    );
    insert into public.upload_sessions (
      id, workspace_id, document_id, revision_id, created_by, object_path, expected_size, expected_mime, expires_at
    ) values (
      sess_id, target_workspace_id, doc_id, rev_id, auth.uid(), fixed_path, (item->>'size')::bigint, item->>'declaredMime', expiration
    );
    perform private.write_audit(target_workspace_id, 'document', doc_id, 'file.upload_authorized', 'succeeded', correlation_id,
                                jsonb_build_object('revision_id', rev_id, 'byte_size', (item->>'size')::bigint));
    session_id := sess_id; workspace_id := target_workspace_id; document_id := doc_id;
    revision_id := rev_id; object_path := fixed_path; expires_at := expiration; return next;
  end loop;
end;
$$;

create or replace function public.complete_upload_session(target_session_id uuid, correlation_id uuid)
returns table (document_id uuid, revision_id uuid, status public.document_revision_state)
language plpgsql security definer set search_path = '' as $$
declare session_record public.upload_sessions%rowtype; stored_size bigint; stored_mime text;
begin
  select * into session_record from public.upload_sessions where id = target_session_id for update;
  if session_record.id is null or session_record.created_by <> auth.uid() then
    raise exception using errcode = '42501', message = 'upload session unavailable';
  end if;
  perform * from public.assert_workspace_capability(session_record.workspace_id, 'documents.upload');
  if session_record.state <> 'pending' or session_record.expires_at <= now() then
    raise exception using errcode = '23514', message = 'upload session is not active';
  end if;
  select (metadata->>'size')::bigint, metadata->>'mimetype' into stored_size, stored_mime
    from storage.objects where bucket_id = session_record.object_bucket and name = session_record.object_path;
  if stored_size is null or stored_size <> session_record.expected_size or stored_mime <> session_record.expected_mime then
    raise exception using errcode = '23514', message = 'uploaded object metadata does not match session';
  end if;
  update public.upload_sessions set state = 'completed', completed_at = now() where id = target_session_id;
  update public.document_revisions set state = 'QUEUED' where workspace_id = session_record.workspace_id and id = session_record.revision_id;
  update public.documents set status = 'QUEUED', updated_at = now() where workspace_id = session_record.workspace_id and id = session_record.document_id;
  perform private.write_audit(session_record.workspace_id, 'document', session_record.document_id, 'file.upload_completed', 'succeeded', correlation_id,
                              jsonb_build_object('revision_id', session_record.revision_id));
  document_id := session_record.document_id; revision_id := session_record.revision_id; status := 'QUEUED'; return next;
end;
$$;

create or replace function public.abort_upload_sessions(target_session_ids uuid[], correlation_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update public.upload_sessions set state = 'aborted'
   where id = any(target_session_ids) and created_by = auth.uid() and state = 'pending';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

alter table public.documents enable row level security;
alter table public.document_revisions enable row level security;
alter table public.upload_sessions enable row level security;
create policy documents_read_workspace on public.documents for select to authenticated
  using (public.has_workspace_capability(workspace_id, 'documents.read'));
create policy revisions_read_workspace on public.document_revisions for select to authenticated
  using (public.has_workspace_capability(workspace_id, 'documents.read'));
create policy upload_sessions_read_creator on public.upload_sessions for select to authenticated
  using (created_by = auth.uid() and public.has_workspace_capability(workspace_id, 'documents.upload'));
revoke all on public.documents, public.document_revisions, public.upload_sessions from anon, authenticated;
grant select on public.documents, public.document_revisions, public.upload_sessions to authenticated;
grant execute on function public.create_upload_batch(uuid, jsonb, uuid) to authenticated;
grant execute on function public.complete_upload_session(uuid, uuid) to authenticated;
grant execute on function public.abort_upload_sessions(uuid[], uuid) to authenticated;
```

- [x] **Step 5: 写失败的服务测试，再实现受控签名器、服务和 Route Handlers**

```ts
// apps/web/src/features/uploads/service.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createUploadSessions } from './service';
vi.mock('@/lib/workspaces/access', () => ({
  requireWorkspaceCapability: vi.fn().mockResolvedValue({
    workspaceId: '41000000-0000-4000-8000-000000000001',
    userId: '40000000-0000-4000-8000-000000000002',
    role: 'editor',
    kind: 'team',
  }),
}));

describe('createUploadSessions', () => {
  it('signs only database-generated paths', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          session_id: '43000000-0000-4000-8000-000000000001',
          workspace_id: '41000000-0000-4000-8000-000000000001',
          document_id: '44000000-0000-4000-8000-000000000001',
          revision_id: '45000000-0000-4000-8000-000000000001',
          object_path:
            'quarantine/41000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000001/45000000-0000-4000-8000-000000000001/random.txt',
          expires_at: '2026-09-02T11:00:00.000Z',
        },
      ],
      error: null,
    });
    const sign = vi.fn().mockResolvedValue({ token: 'scoped-token' });
    const result = await createUploadSessions(
      { rpc } as never,
      { sign },
      {
        workspaceId: '41000000-0000-4000-8000-000000000001',
        files: [{ name: 'readme.txt', size: 12, declaredMime: 'text/plain' }],
      },
      '42000000-0000-4000-8000-000000000001'
    );
    expect(sign).toHaveBeenCalledWith(
      expect.stringContaining('/45000000-0000-4000-8000-000000000001/')
    );
    expect(result[0]?.uploadToken).toBe('scoped-token');
  });
});
```

Run: `pnpm --filter @knowledge/web test -- src/features/uploads/service.test.ts`

Expected: FAIL，报告无法解析 `./service`。

```ts
// apps/web/src/lib/supabase/admin.ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@knowledge/domain';

export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
}
```

```ts
// apps/web/src/features/uploads/service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  UploadSessionSchema,
  parseUploadBatch,
  type CreateUploadSessionsInput,
  type UploadSession,
} from '@knowledge/domain';
import type { Database } from '@knowledge/domain';
import { requireWorkspaceCapability } from '@/lib/workspaces/access';

export type UploadSigner = { sign(objectPath: string): Promise<{ token: string }> };

export async function createUploadSessions(
  client: SupabaseClient<Database>,
  signer: UploadSigner,
  rawInput: CreateUploadSessionsInput,
  requestId: string
): Promise<UploadSession[]> {
  const input = parseUploadBatch(rawInput);
  await requireWorkspaceCapability(client, input.workspaceId, 'documents.upload');
  const { data, error } = await client.rpc('create_upload_batch', {
    target_workspace_id: input.workspaceId,
    input_files: input.files,
    correlation_id: requestId,
  });
  if (error || !data) throw new Error('无法创建上传会话');
  try {
    return await Promise.all(
      data.map(async (row) =>
        UploadSessionSchema.parse({
          id: row.session_id,
          workspaceId: row.workspace_id,
          documentId: row.document_id,
          revisionId: row.revision_id,
          objectPath: row.object_path,
          uploadToken: (await signer.sign(row.object_path)).token,
          expiresAt: row.expires_at,
        })
      )
    );
  } catch (cause) {
    await client.rpc('abort_upload_sessions', {
      target_session_ids: data.map((row) => row.session_id),
      correlation_id: requestId,
    });
    throw new Error('无法签发上传授权', { cause });
  }
}

export async function completeUploadSession(
  client: SupabaseClient<Database>,
  sessionId: string,
  requestId: string
) {
  const { data, error } = await client.rpc('complete_upload_session', {
    target_session_id: sessionId,
    correlation_id: requestId,
  });
  const row = data?.[0];
  if (error || !row) throw new Error('上传对象校验失败');
  return { documentId: row.document_id, revisionId: row.revision_id, status: 'QUEUED' as const };
}
```

```ts
// apps/web/src/app/api/uploads/sessions/route.ts
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createUploadSessions } from '@/features/uploads/service';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const client = await createServerSupabaseClient();
    const admin = createAdminSupabaseClient();
    const sessions = await createUploadSessions(
      client,
      {
        async sign(objectPath) {
          const { data, error } = await admin.storage
            .from('originals')
            .createSignedUploadUrl(objectPath, { upsert: false });
          if (error || !data.token) throw new Error('storage signing failed');
          return { token: data.token };
        },
      },
      await request.json(),
      randomUUID()
    );
    return NextResponse.json({ sessions }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '上传请求无效';
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
```

```ts
// apps/web/src/app/api/uploads/sessions/[sessionId]/complete/route.ts
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { completeUploadSession } from '@/features/uploads/service';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const result = await completeUploadSession(
      await createServerSupabaseClient(),
      sessionId,
      randomUUID()
    );
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json(
      { error: '上传对象校验失败' },
      { status: 409, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
```

- [x] **Step 6: 重建数据库、重新生成类型并验证上传服务**

Run: `pnpm db:reset && pnpm test:db && pnpm db:types && pnpm --filter @knowledge/web test -- src/features/uploads/service.test.ts && pnpm --filter @knowledge/web typecheck`

Expected: PASS；数据库共 35 个断言通过，签名器只收到数据库生成路径，`SUPABASE_SERVICE_ROLE_KEY` 只出现在 `server-only` 模块。

- [x] **Step 7: 提交私有上传后端**

```bash
git add supabase/migrations/0004_private_upload_sessions.sql supabase/tests/0004_private_upload_sessions.test.sql packages/domain/src/database.types.ts apps/web/src/lib/supabase/admin.ts apps/web/src/features/uploads apps/web/src/app/api/uploads
git commit -m "feat: add scoped private upload sessions"
```

### Task 8: Connect the Upload UI and Pass the Foundation Acceptance Gate

**Files:**

- Modify: `apps/web/src/app/(workspace)/w/[workspaceId]/library/page.tsx`
- Create: `apps/web/src/features/uploads/browser-upload.ts`
- Create: `apps/web/src/features/uploads/upload-dialog.tsx`
- Create: `apps/web/src/features/uploads/document-list.tsx`
- Create: `apps/web/src/features/uploads/queries.ts`
- Test: `apps/web/src/features/uploads/upload-dialog.test.tsx`
- Create: `playwright.config.ts`
- Create: `tests/e2e/global.setup.ts`
- Create: `tests/e2e/support/identities.ts`
- Create: `tests/e2e/auth-workspaces.spec.ts`
- Create: `tests/e2e/members-uploads.spec.ts`

**Interfaces:**

- Consumes: `UploadSession`, `WorkspaceContext`, `hasCapability(...)`; `/api/uploads/sessions`; `/api/uploads/sessions/{sessionId}/complete`; browser `uploadToSignedUrl`.
- Produces: `performUploadBatch(input): Promise<QueuedUpload[]>`; `UploadDialog({ context, onCompleted })`; immediately visible queued document rows; the Foundation fixture used by later slice acceptance suites.

- [ ] **Step 1: 写团队可见警示和只读 Viewer 的失败组件测试**

```tsx
// apps/web/src/features/uploads/upload-dialog.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UploadDialog } from './upload-dialog';

const teamEditor = {
  workspaceId: '41000000-0000-4000-8000-000000000001',
  userId: '40000000-0000-4000-8000-000000000002',
  role: 'editor' as const,
  kind: 'team' as const,
};

describe('UploadDialog', () => {
  it('names the target workspace and warns before a team upload', () => {
    render(<UploadDialog context={teamEditor} workspaceName="Upload Team" onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '上传资料' }));
    expect(screen.getByText('上传到 Upload Team')).toBeVisible();
    expect(screen.getByText('Upload Team 的所有成员都能看到这些资料。')).toBeVisible();
    expect(screen.getByLabelText('选择资料')).toHaveAttribute('multiple');
  });

  it('renders no upload control for a viewer', () => {
    render(
      <UploadDialog
        context={{ ...teamEditor, role: 'viewer' }}
        workspaceName="Upload Team"
        onCompleted={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: '上传资料' })).not.toBeInTheDocument();
    expect(screen.getByText('你在此工作区拥有只读权限。')).toBeVisible();
  });
});
```

- [ ] **Step 2: 运行组件测试并确认上传对话框不存在**

Run: `pnpm --filter @knowledge/web test -- src/features/uploads/upload-dialog.test.tsx`

Expected: FAIL，报告无法解析 `./upload-dialog`。

- [ ] **Step 3: 实现浏览器直传编排，路径和令牌只取自服务端响应**

```ts
// apps/web/src/features/uploads/browser-upload.ts
import { UploadSessionSchema, parseUploadBatch, type UploadSession } from '@knowledge/domain';

export type BrowserUploadGateway = {
  upload(session: UploadSession, file: File): Promise<void>;
};
export type UploadProgress = {
  fileName: string;
  state: 'authorizing' | 'uploading' | 'verifying' | 'queued' | 'failed';
  message?: string;
};
export type QueuedUpload = { documentId: string; revisionId: string; status: 'QUEUED' };

export async function performUploadBatch(input: {
  workspaceId: string;
  files: File[];
  gateway: BrowserUploadGateway;
  fetcher?: typeof fetch;
  onProgress(progress: UploadProgress): void;
}): Promise<QueuedUpload[]> {
  const fetcher = input.fetcher ?? fetch;
  const parsed = parseUploadBatch({
    workspaceId: input.workspaceId,
    files: input.files.map((file) => ({
      name: file.name,
      size: file.size,
      declaredMime: file.type || 'text/plain',
    })),
  });
  parsed.files.forEach((file) => input.onProgress({ fileName: file.name, state: 'authorizing' }));
  const response = await fetcher('/api/uploads/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error((await response.json()).error ?? '无法创建上传会话');
  const payload = (await response.json()) as { sessions: unknown[] };
  const sessions = payload.sessions.map((session) => UploadSessionSchema.parse(session));
  if (sessions.length !== input.files.length) throw new Error('上传会话数量不匹配');

  return Promise.all(
    sessions.map(async (session, index) => {
      const file = input.files[index]!;
      try {
        input.onProgress({ fileName: file.name, state: 'uploading' });
        await input.gateway.upload(session, file);
        input.onProgress({ fileName: file.name, state: 'verifying' });
        const completed = await fetcher(`/api/uploads/sessions/${session.id}/complete`, {
          method: 'POST',
          cache: 'no-store',
        });
        if (!completed.ok) throw new Error('上传对象校验失败');
        const queued = (await completed.json()) as QueuedUpload;
        input.onProgress({ fileName: file.name, state: 'queued' });
        return queued;
      } catch (error) {
        input.onProgress({
          fileName: file.name,
          state: 'failed',
          message: error instanceof Error ? error.message : '上传失败',
        });
        throw error;
      }
    })
  );
}
```

- [ ] **Step 4: 实现上传对话框、当前工作区文档查询和上传后即时列表**

```ts
// apps/web/src/features/uploads/queries.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@knowledge/domain';

export async function listWorkspaceDocuments(
  client: SupabaseClient<Database>,
  workspaceId: string
) {
  const { data, error } = await client
    .from('documents')
    .select('id,title,status,updated_at,uploaded_by')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error('无法读取资料库');
  return data;
}
```

```tsx
// apps/web/src/features/uploads/upload-dialog.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RiCloseLine, RiUploadCloud2Line } from '@remixicon/react';
import { hasCapability, type WorkspaceContext } from '@knowledge/domain';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { AppIcon } from '@/components/ui/app-icon';
import { performUploadBatch, type UploadProgress } from './browser-upload';

export function UploadDialog({
  context,
  workspaceName,
  onCompleted,
}: {
  context: WorkspaceContext;
  workspaceName: string;
  onCompleted(): void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState('');
  if (!hasCapability(context.role, 'documents.upload'))
    return <p className="text-sm text-[var(--muted)]">你在此工作区拥有只读权限。</p>;
  return (
    <>
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-[var(--accent)] px-4 text-white"
        onClick={() => setOpen(true)}
      >
        <AppIcon icon={RiUploadCloud2Line} size="action" />
        上传资料
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4"
        >
          <section className="w-full max-w-lg rounded-[7px] bg-[var(--canvas)] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="upload-title" className="text-lg font-semibold">
                上传到 {workspaceName}
              </h2>
              <button
                className="icon-button"
                aria-label="关闭上传窗口"
                title="关闭上传窗口"
                onClick={() => setOpen(false)}
              >
                <AppIcon icon={RiCloseLine} />
              </button>
            </div>
            {context.kind === 'team' && (
              <p className="mt-3 border-l-2 border-[var(--accent)] pl-3 text-sm">
                {workspaceName} 的所有成员都能看到这些资料。
              </p>
            )}
            <label className="mt-5 block text-sm font-medium" htmlFor="upload-files">
              选择资料
            </label>
            <input
              id="upload-files"
              aria-label="选择资料"
              className="mt-2 min-h-11 w-full"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.md,.txt"
              onChange={async (event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                if (!files.length) return;
                setError('');
                try {
                  const supabase = createBrowserSupabaseClient();
                  await performUploadBatch({
                    workspaceId: context.workspaceId,
                    files,
                    gateway: {
                      async upload(session, file) {
                        const { error: uploadError } = await supabase.storage
                          .from('originals')
                          .uploadToSignedUrl(session.objectPath, session.uploadToken, file, {
                            contentType: file.type,
                            upsert: false,
                          });
                        if (uploadError) throw uploadError;
                      },
                    },
                    onProgress(next) {
                      setProgress((current) => [
                        ...current.filter((item) => item.fileName !== next.fileName),
                        next,
                      ]);
                    },
                  });
                  onCompleted();
                  router.refresh();
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : '上传失败，请更换文件后重试');
                }
              }}
            />
            <ul aria-live="polite" className="mt-4 space-y-1 text-sm">
              {progress.map((item) => (
                <li key={item.fileName}>
                  {item.fileName}：
                  {
                    {
                      authorizing: '准备中',
                      uploading: '上传中',
                      verifying: '校验中',
                      queued: '排队中',
                      failed: item.message ?? '失败',
                    }[item.state]
                  }
                </li>
              ))}
            </ul>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
```

```tsx
// apps/web/src/features/uploads/document-list.tsx
export function DocumentList({
  documents,
}: {
  documents: Array<{ id: string; title: string; status: string; updated_at: string }>;
}) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">资料库</h1>
      <div role="table" aria-label="资料列表" className="mt-8 border-t border-[var(--line)]">
        {documents.map((document) => (
          <div
            role="row"
            key={document.id}
            className="grid min-h-14 grid-cols-[minmax(0,1fr)_120px] items-center border-b border-[var(--line)]"
          >
            <span role="cell" className="truncate">
              {document.title}
            </span>
            <span role="cell" className="text-sm text-[var(--muted)]">
              {document.status === 'QUEUED' ? '排队中' : document.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// replace apps/web/src/app/(workspace)/w/[workspaceId]/library/page.tsx
import { EmptyState } from '@/components/ui/empty-state';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireWorkspaceCapability } from '@/lib/workspaces/access';
import { listAccessibleWorkspaces } from '@/features/workspaces/queries';
import { listWorkspaceDocuments } from '@/features/uploads/queries';
import { DocumentList } from '@/features/uploads/document-list';
import { UploadDialog } from '@/features/uploads/upload-dialog';

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const client = await createServerSupabaseClient();
  const context = await requireWorkspaceCapability(client, workspaceId, 'documents.read');
  const [documents, workspaces] = await Promise.all([
    listWorkspaceDocuments(client, workspaceId),
    listAccessibleWorkspaces(client),
  ]);
  const workspaceName =
    workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? '当前工作区';
  return (
    <div className="page-content">
      {documents.length ? (
        <>
          <div className="mb-5 flex justify-end">
            <UploadDialog
              context={context}
              workspaceName={workspaceName}
              onCompleted={() => undefined}
            />
          </div>
          <DocumentList documents={documents} />
        </>
      ) : (
        <EmptyState
          imageSrc="/illustrations/first-upload.png"
          imageAlt="人物把第一份资料放入档案盒"
          title="放入第一份资料"
          description="支持图片、PDF、DOCX、Markdown 和 TXT。原件保存后，你可以离开页面，处理会继续进行。"
          action={
            <UploadDialog
              context={context}
              workspaceName={workspaceName}
              onCompleted={() => undefined}
            />
          }
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: 创建四宽度 Playwright 配置与可复用身份夹具**

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  globalSetup: './tests/e2e/global.setup.ts',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm --filter @knowledge/web dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'mobile-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1024',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 900 } },
    },
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
});
```

```ts
// tests/e2e/global.setup.ts
import { execFileSync } from 'node:child_process';
export default function globalSetup() {
  execFileSync('pnpm', ['db:reset'], { stdio: 'inherit' });
}
```

```ts
// tests/e2e/support/identities.ts
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

export async function createIdentity(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`fixture user failed: ${email}`);
  return data.user.id;
}

export async function magicLink(email: string) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: 'http://127.0.0.1:3000/auth/callback' },
  });
  if (error || !data.properties.action_link) throw new Error(`fixture link failed: ${email}`);
  return data.properties.action_link;
}

export async function seedFoundationFixture() {
  const suffix = randomUUID().slice(0, 8);
  const emails = {
    owner: `owner-${suffix}@example.test`,
    admin: `admin-${suffix}@example.test`,
    editor: `editor-${suffix}@example.test`,
    viewer: `viewer-${suffix}@example.test`,
    outsider: `outsider-${suffix}@example.test`,
  };
  const users = Object.fromEntries(
    await Promise.all(
      Object.entries(emails).map(async ([key, email]) => [key, await createIdentity(email)])
    )
  ) as Record<keyof typeof emails, string>;
  const teamOne = randomUUID();
  const teamTwo = randomUUID();
  const { error: workspaceError } = await admin.from('workspaces').insert([
    {
      id: teamOne,
      kind: 'team',
      name: 'Team One',
      slug: `team-one-${suffix}`,
      owner_user_id: users.owner,
      created_by: users.owner,
    },
    {
      id: teamTwo,
      kind: 'team',
      name: 'Team Two',
      slug: `team-two-${suffix}`,
      owner_user_id: users.outsider,
      created_by: users.outsider,
    },
  ]);
  if (workspaceError) throw workspaceError;
  const { error: membershipError } = await admin.from('memberships').insert([
    {
      workspace_id: teamOne,
      user_id: users.owner,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    },
    {
      workspace_id: teamOne,
      user_id: users.admin,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString(),
    },
    {
      workspace_id: teamOne,
      user_id: users.editor,
      role: 'editor',
      status: 'active',
      joined_at: new Date().toISOString(),
    },
    {
      workspace_id: teamOne,
      user_id: users.viewer,
      role: 'viewer',
      status: 'active',
      joined_at: new Date().toISOString(),
    },
    {
      workspace_id: teamTwo,
      user_id: users.outsider,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    },
  ]);
  if (membershipError) throw membershipError;
  return { emails, users, teamOne, teamTwo };
}

export async function createKnownInvitation(
  workspaceId: string,
  invitedBy: string,
  email: string,
  role: 'admin' | 'editor' | 'viewer'
) {
  const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  const tokenHash = `\\x${createHash('sha256').update(token).digest('hex')}`;
  const { error } = await admin.from('invitations').insert({
    workspace_id: workspaceId,
    email,
    role,
    token_hash: tokenHash,
    invited_by: invitedBy,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
  return token;
}

export { admin };
```

- [ ] **Step 6: 写完整 Foundation 端到端旅程**

```ts
// tests/e2e/auth-workspaces.spec.ts
import { expect, test } from '@playwright/test';
import { createKnownInvitation, magicLink, seedFoundationFixture } from './support/identities';

test('email login lands in the private personal library and an accepted invitation becomes the landing workspace', async ({
  page,
}) => {
  const fixture = await seedFoundationFixture();
  const inviteeEmail = `invitee-${Date.now()}@example.test`;
  const { createIdentity } = await import('./support/identities');
  await createIdentity(inviteeEmail);
  await page.goto(await magicLink(inviteeEmail));
  await expect(page.getByRole('heading', { name: '放入第一份资料' })).toBeVisible();
  const token = await createKnownInvitation(
    fixture.teamOne,
    fixture.users.owner,
    inviteeEmail,
    'viewer'
  );
  await page.goto(`/invite/${token}`);
  await page.getByRole('button', { name: '接受邀请' }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${fixture.teamOne}/library`));
  await page.goto('/');
  await expect(page).toHaveURL(new RegExp(`/w/${fixture.teamOne}/library`));
});
```

```ts
// tests/e2e/members-uploads.spec.ts
import { expect, test } from '@playwright/test';
import { admin, magicLink, seedFoundationFixture } from './support/identities';

test('viewer is read-only, editor sees the team warning and a verified upload appears queued', async ({
  browser,
}) => {
  const fixture = await seedFoundationFixture();
  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto(await magicLink(fixture.emails.viewer));
  await viewerPage.goto(`/w/${fixture.teamOne}/library`);
  await expect(viewerPage.getByText('你在此工作区拥有只读权限。')).toBeVisible();
  await expect(viewerPage.getByRole('button', { name: '上传资料' })).toHaveCount(0);

  const editorContext = await browser.newContext();
  const editorPage = await editorContext.newPage();
  await editorPage.goto(await magicLink(fixture.emails.editor));
  await editorPage.goto(`/w/${fixture.teamOne}/library`);
  await editorPage.getByRole('button', { name: '上传资料' }).click();
  await expect(editorPage.getByText('Team One 的所有成员都能看到这些资料。')).toBeVisible();
  await editorPage.getByLabel('选择资料').setInputFiles({
    name: 'foundation.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('foundation'),
  });
  await expect(editorPage.getByText('foundation.txt：排队中')).toBeVisible({ timeout: 10_000 });
  await expect(editorPage.getByRole('cell', { name: 'foundation' })).toBeVisible();

  await admin
    .from('memberships')
    .update({ status: 'removed', removed_at: new Date().toISOString() })
    .eq('workspace_id', fixture.teamOne)
    .eq('user_id', fixture.users.viewer);
  await viewerPage.reload();
  await expect(viewerPage.getByText(/无法找到|无权访问/)).toBeVisible();
  await expect(
    viewerPage.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).resolves.toBe(true);
});
```

- [ ] **Step 7: 运行 Foundation 全门禁并检查浏览器包密钥**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm --filter @knowledge/web build && pnpm test:e2e`

Expected: PASS；四种宽度的登录、个人落点、邀请接受、Viewer 只读、Editor 上传和即时降权全部通过。

Run: `rg -n "SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY" apps/web/.next/static apps/web/.next/server/app 2>/dev/null`

Expected: 浏览器静态产物无命中；服务端产物只在 `server-only` 模块引用变量名，不包含真实值。

- [ ] **Step 8: 提交 Foundation 验收切片**

```bash
git add apps/web/src/app/\(workspace\)/w/\[workspaceId\]/library apps/web/src/features/uploads playwright.config.ts tests/e2e
git commit -m "feat: complete secure foundation slice"
```

## Slice Exit Criteria and Next-Plan Contract

- 邮箱 OTP 完成真实本地回调；Google OAuth 的 provider/redirect 契约由单元测试锁定，生产 Google 凭据在部署环境配置。
- 每个新账号只有一个个人空间和一个 Owner；个人空间不能添加成员。
- 两个无关联团队、四种角色的数据库/RLS 矩阵通过，跨租户查询结果为零。
- 邀请只保存 SHA-256 哈希，绑定邮箱、7 天过期、单次接受；成员移除或降权后的下一次请求立即失效。
- Private Bucket 无公开读取和普通客户端列举；服务端只对数据库生成的固定路径签发上传令牌。
- 单批 20、单文件 50 MB 与七类首发格式在客户端 Schema 和数据库 RPC 双重执行。
- 上传完成只把 Revision 推进到 `QUEUED`；计划 02 消费 `document_revision_state`、`documents`、`document_revisions`、`upload_sessions`，创建 `processing_jobs` 和队列，并负责 24 小时内回收过期会话和孤儿对象。
- 后续计划直接复用且不得改名：

```ts
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type WorkspaceContext = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  kind: 'personal' | 'team';
};
export async function requireWorkspaceCapability(
  client: SupabaseClient<Database>,
  workspaceId: string,
  capability: Capability
): Promise<WorkspaceContext>;
export type UploadSession = {
  id: string;
  workspaceId: string;
  documentId: string;
  revisionId: string;
  objectPath: string;
  uploadToken: string;
  expiresAt: string;
};
```
