# AI知识库项目实施指南

## 阶段1：项目初始化（1-2周）

### 1.1 本地开发环境搭建

**必需工具：**
```bash
# 检查版本
node --version  # 需要 24 LTS
pnpm --version  # 最新版本
docker --version

# 安装Supabase CLI
brew install supabase/tap/supabase

# 验证安装
supabase --version
```

**创建项目结构：**
```bash
# 初始化monorepo
mkdir -p apps/web apps/worker packages/domain packages/ai packages/observability
mkdir -p supabase/migrations supabase/tests supabase/seed.sql
mkdir -p tests/e2e tests/ai-evals tests/security tests/accessibility
mkdir -p scripts ops/alerts ops/runbooks

# 初始化pnpm workspace
cat > pnpm-workspace.yaml << EOF
packages:
  - 'apps/*'
  - 'packages/*'
EOF

# 初始化根package.json
cat > package.json << EOF
{
  "name": "ai-knowledge-base",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:web": "pnpm --filter @knowledge/web dev",
    "dev:worker": "pnpm --filter @knowledge/worker dev",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --build",
    "test": "vitest run",
    "test:db": "supabase test db",
    "build": "pnpm --filter @knowledge/web build && pnpm --filter @knowledge/worker build",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > packages/domain/src/database.types.ts"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.6.0",
    "vitest": "^4.1.11"
  },
  "packageManager": "pnpm@9.0.0"
}
EOF
```

**启动本地Supabase：**
```bash
# 初始化Supabase项目
supabase init

# 启动本地堆栈（Postgres + Storage + Auth + Realtime）
supabase start

# 输出会显示：
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# Anon key: eyJ...
# Service role key: eyJ...

# 保存这些凭证到.env.local
```

### 1.2 配置文件设置

**TypeScript配置（根目录 tsconfig.json）：**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "paths": {
      "@knowledge/*": ["./packages/*/src"]
    }
  }
}
```

**ESLint配置（根目录 eslint.config.js）：**
```javascript
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint },
    languageOptions: { parser: tsparser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];
```

### 1.3 AI提供商配置

**OpenAI设置：**
```bash
# .env.local (不要提交到git)
OPENAI_API_KEY=sk-...
OPENAI_KNOWLEDGE_MODEL=gpt-4o-2024-11-20
OPENAI_VISUAL_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Web环境变量（Next.js）
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Worker环境变量
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**注意事项：**
- 开发阶段使用个人OpenAI API key
- 生产环境需要组织账号并配置usage limits
- 所有AI请求必须设置`store: false`

---

## 阶段2：Plan 01 实施（预估3-4周）

### 2.1 执行顺序（按Plan 01任务顺序）

**任务优先级：**
```
Task 1: 数据库Extensions和Schema → 
Task 2: Identity和Workspaces表 → 
Task 3: RLS策略 → 
Task 4: 认证集成 → 
Task 5: 工作区UI → 
Task 6: 邀请系统 → 
Task 7: 上传Session
```

### 2.2 关键检查点

**每个任务完成后验证：**
```bash
# 1. 类型检查通过
pnpm typecheck

# 2. 单元测试通过
pnpm test

# 3. 数据库测试通过
pnpm test:db

# 4. 提交代码
git add <files>
git commit -m "feat(plan01): <task-description>"
```

**Plan 01 Exit Gate验证：**
```bash
# 完整测试套件
pnpm lint && \
pnpm typecheck && \
pnpm test && \
pnpm test:db && \
pnpm test:e2e:foundation

# 检查清单（参考Plan 01的退出门禁）
# ✅ 新用户可以创建个人工作区
# ✅ 团队邀请流程工作正常
# ✅ 四种角色权限矩阵通过
# ✅ Owner唯一性约束强制执行
# ✅ 私有bucket策略正确
# ✅ 上传session创建成功
```

**通过标准：所有检查项✅，无P0/P1缺陷**

---

## 阶段3：Plan 02 实施（预估4-6周）

### 3.1 最具挑战的任务

**Task 4: 文件验证（关键）**
```bash
# 需要集成ClamAV
docker pull clamav/clamav:latest
docker run -d -p 3310:3310 clamav/clamav

# 测试所有拒绝场景
pnpm test apps/worker/src/stages/validate-file.test.ts
```

**Task 5: 格式提取（最复杂）**
- 需要7种格式的提取器
- 每个格式需要确定性测试fixture
- PDF OCR最耗时（需要视觉提取）

### 3.2 开发建议

**并行开发策略（同一任务内）：**
```
开发者A: PDF提取器
开发者B: DOCX提取器  
开发者C: 图像提取器
开发者D: 文本提取器（Markdown + TXT）

前提：Task 1-4已完成，contracts已冻结
```

**Worker开发调试：**
```typescript
// apps/worker/src/index.ts
// 本地调试模式
if (process.env.NODE_ENV === 'development') {
  // 单次处理然后退出，方便调试
  const job = await claimJob();
  if (job) {
    await processJob(job);
    process.exit(0);
  }
}
```

### 3.3 常见陷阱规避

**❌ 错误做法：**
```typescript
// 不要在Worker中直接访问表
const chunks = await supabase
  .from('chunks')
  .insert({ workspace_id, ... });  // ❌ Worker角色被拒绝
```

**✅ 正确做法：**
```typescript
// 通过受限RPC
await workerRpc.replaceChunks({
  job,  // 包含workspace_id
  chunks,
  requestId,
});  // ✅ RPC从job派生workspace_id
```

---

## 阶段4：Plan 03 实施（预估4-5周）

### 4.1 AI质量门槛准备

**提前准备评估语料：**
```bash
# tests/ai-evals/knowledge-corpus.json
{
  "cases": [
    {
      "id": "case-001",
      "name": "产品文档-季度规划",
      "chunks": ["chunk text..."],
      "expected": {
        "topics": ["产品规划", "季度目标"],
        "tags": ["Q1", "roadmap"],
        "entities": [
          {"type": "concept", "name": "用户增长"}
        ],
        "relations": [
          {"subject": "产品A", "predicate": "依赖于", "object": "技术B"}
        ],
        "evidenceRefs": ["chunk-001"]
      }
    }
  ]
}
```

**人工标注要求：**
- 至少30个案例
- 涵盖中英文内容
- 包含提示注入测试用例
- 不使用生产数据

### 4.2 图谱性能优化

**300节点限制测试：**
```typescript
// tests/e2e/graph-performance.spec.ts
test('renders 300 nodes in <2s', async ({ page }) => {
  await page.goto('/w/${workspaceId}/graph');
  
  const start = Date.now();
  await page.waitForSelector('[data-testid="graph-ready"]');
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(2000);
});
```

---

## 阶段5：Plan 04 实施（预估3-4周）

### 5.1 SSE流式传输

**服务端实现：**
```typescript
// app/api/chat/stream/route.ts
export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of groundedChatProvider.stream(input)) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
      }
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
```

**客户端消费：**
```typescript
const eventSource = new EventSource('/api/chat/stream');
eventSource.onmessage = (event) => {
  const chunk = JSON.parse(event.data);
  appendToMessage(chunk);
};

// 权限撤销时关闭
if (permissionRevoked) {
  eventSource.close();
}
```

---

## 阶段6：Plan 05 实施（预估3-4周）

### 6.1 CI/CD Pipeline设置

**GitHub Actions工作流：**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Start Supabase
        run: supabase start
      
      - name: Run tests
        run: |
          pnpm lint
          pnpm typecheck
          pnpm test
          pnpm test:db
          pnpm build
          pnpm test:e2e
      
      - name: Security scan
        run: pnpm scan:secrets
```

### 6.2 Release Gate实施

**发布检查清单自动化：**
```typescript
// scripts/release-gate.ts
const evidence = await collectEvidence();

const result = evaluateRelease({
  revision: process.env.GITHUB_SHA,
  security: await runSecurityTests(),
  ai: await runAiEvals(),
  accessibility: await runA11yTests(),
  performance: await runPerfTests(),
  recovery: await verifyLastBackup(),
});

if (result.decision === 'blocked') {
  console.error('Release blocked:', result.reasons);
  process.exit(1);
}
```

---

## 🛠️ 推荐的开发工具和工作流

### 日常开发循环

```bash
# 终端1: 启动Web开发服务器
pnpm dev:web

# 终端2: 启动Worker（手动触发）
pnpm dev:worker

# 终端3: 运行测试（watch模式）
pnpm test --watch

# 终端4: Supabase Studio
# 浏览器访问 http://localhost:54323
```

### Git分支策略

```
main (protected)
  ↓
feature/plan01-task1-database-schema
feature/plan01-task2-identity-workspaces
  ...
feature/plan02-task1-contracts
  ...
```

**分支命名规范：**
```
feature/plan<NN>-task<N>-<short-description>
fix/plan<NN>-<bug-description>
test/plan<NN>-<test-area>
```

### 代码审查检查清单

**提交PR前自检：**
- [ ] `pnpm lint`通过
- [ ] `pnpm typecheck`通过
- [ ] `pnpm test`通过
- [ ] 新增功能有测试覆盖
- [ ] 运维手册更新（如有新配置）
- [ ] 数据库迁移可回滚（如有）
- [ ] 无硬编码secrets
- [ ] 日志无敏感内容

---

## ⚠️ 关键风险和缓解措施

### 风险1：AI成本超支

**缓解：**
- 开发阶段使用小文档测试
- 设置OpenAI usage limits
- 监控每日API消耗
- 考虑mock provider用于测试

### 风险2：性能预算超标

**缓解：**
- 每个sprint运行性能测试
- 提前优化慢查询（使用EXPLAIN ANALYZE）
- 300节点图谱从一开始就测试
- 考虑pagination/虚拟滚动

### 风险3：跨租户泄漏

**缓解：**
- 每次提交运行安全测试套件
- Code review重点检查RLS策略
- 所有查询必须包含workspace_id
- 定期渗透测试

---

## 📅 建议的里程碑时间线

**总预估：18-22周（4.5-5.5个月）**

| 阶段 | 时长 | 里程碑 |
|-----|------|-------|
| 初始化 | 1-2周 | 环境就绪 |
| Plan 01 | 3-4周 | Foundation完成 |
| Plan 02 | 4-6周 | Ingestion&Search完成 |
| Plan 03 | 4-5周 | AI&Graph完成 |
| Plan 04 | 3-4周 | Chat&Collab完成 |
| Plan 05 | 3-4周 | Release就绪 |

**关键决策点：**
- Week 4: Plan 01通过 → 继续Plan 02
- Week 10: Plan 02通过 → 继续Plan 03
- Week 15: Plan 03通过 → 继续Plan 04
- Week 18: Plan 04通过 → 开始Plan 05
- Week 22: Release Gate通过 → 生产部署

---

## 🎯 成功标准

**MVP发布的最终检查清单：**

1. **功能完整性** - 所有5个Plan的Exit Gate通过
2. **安全性** - 零跨租户泄漏、零提示注入失败
3. **性能** - 所有预算达标（LCP < 2.5s, TTFC P95 < 8s等）
4. **可访问性** - WCAG 2.2 AA合规、零critical/serious问题
5. **AI质量** - 所有阈值达标（recall ≥ 80%, F1 ≥ 85%等）
6. **运维就绪** - 备份恢复通过、runbook完整、告警配置
7. **发布证据** - `pnpm release:gate`返回`approved`

**达成后 → 生产部署 🚀**
