# 每日执行指南

## 🌅 每日开发流程

### 开始新的一天

```bash
# 1. 更新代码
git pull origin main

# 2. 安装新依赖（如有）
pnpm install

# 3. 重置数据库（如有新迁移）
pnpm db:reset

# 4. 启动开发环境
tmux new -s dev  # 或使用VS Code多终端

# 窗口1: Web服务器
pnpm dev:web

# 窗口2: Worker
pnpm dev:worker

# 窗口3: 测试监控
pnpm test --watch

# 窗口4: 类型检查
pnpm typecheck --watch
```

---

## 📝 Plan 01 每日任务示例

### Week 1: Database Schema (Task 1)

**Monday: Extensions和Helpers**
```bash
# 创建迁移文件
supabase migration new extensions

# 编辑 supabase/migrations/0001_extensions.sql
# - 启用 pgcrypto, pg_trgm, vector
# - 创建 gen_ulid() helper

# 测试迁移
pnpm db:reset

# 验证
psql $DATABASE_URL -c "SELECT gen_ulid();"

# 提交
git add supabase/migrations/0001_extensions.sql
git commit -m "feat(plan01): add database extensions and helpers"
```

**Tuesday: 创建测试框架**
```bash
# 创建测试文件
touch supabase/tests/0001_extensions.test.sql

# 编写pgTAP测试
# - 测试extensions已启用
# - 测试helper函数正确

# 运行
pnpm test:db

# 如果失败，修复后重新运行
# 直到全部通过
```

**Wednesday-Friday: Identity Tables**
- profiles表
- workspaces表
- memberships表
- invitations表
- 所有复合外键
- RLS策略草稿

---

## 🔍 实时调试技巧

### 调试Worker处理失败

```typescript
// apps/worker/src/pipeline/run-processing-job.ts

// 添加详细日志
logger.info('stage_start', {
  job_id: job.id,
  stage: currentStage,
  workspace_id: job.workspace_id,
  document_id: job.document_id,
});

try {
  const result = await stageHandler.run(job, signal);
  logger.info('stage_success', { job_id: job.id, stage: currentStage });
} catch (error) {
  logger.error('stage_failed', {
    job_id: job.id,
    stage: currentStage,
    error_code: error.code,
    error_message: error.message,
    // 不记录error.stack（可能包含敏感路径）
  });
  throw error;
}
```

### 调试RLS策略

```sql
-- 在Supabase Studio SQL Editor中

-- 模拟特定用户
SET request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

-- 尝试查询
SELECT * FROM documents WHERE workspace_id = '10000000-0000-4000-8000-000000000001';

-- 检查RLS是否生效
-- 应该只返回该用户有权限的文档

-- 重置
RESET request.jwt.claim.sub;
```

### 调试混合搜索

```sql
-- 测试词法搜索
SELECT id, title, ts_rank(search_tsv, websearch_to_tsquery('simple', 'privacy')) as rank
FROM chunks
WHERE workspace_id = '...'
  AND search_tsv @@ websearch_to_tsquery('simple', 'privacy')
ORDER BY rank DESC
LIMIT 10;

-- 测试向量搜索
SELECT id, title, 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM chunks
WHERE workspace_id = '...'
  AND embedding IS NOT NULL
ORDER BY similarity DESC
LIMIT 10;
```

---

## ✅ 每日签出检查清单

**离开前必做（5分钟）：**

```bash
# 1. 提交所有工作
git status  # 确认没有遗漏的文件
git add .
git commit -m "wip: <what-you-worked-on>"

# 2. 推送到个人分支
git push origin feature/plan01-task1-schema

# 3. 运行快速测试
pnpm lint
pnpm typecheck

# 4. 记录明天的TODO
echo "## $(date +%Y-%m-%d) TODO" >> daily-notes.md
echo "- [ ] Complete RLS policies for memberships" >> daily-notes.md
echo "- [ ] Add pgTAP tests for workspace creation" >> daily-notes.md

# 5. 停止服务
tmux kill-session -t dev  # 或Ctrl+D关闭所有终端
supabase stop  # 可选：节省资源
```

---

## 🚨 常见问题快速解决

### 问题1：数据库迁移失败

**症状：**
```bash
pnpm db:reset
# Error: migration 0005 failed at line 42
```

**解决：**
```bash
# 1. 查看详细错误
supabase db reset --debug

# 2. 修复SQL文件（通常是语法错误或外键问题）

# 3. 重新测试
pnpm db:reset

# 4. 如果还是失败，尝试从空数据库开始
supabase db reset --no-seed
```

### 问题2：Worker无法claim job

**症状：**
Worker日志显示"No jobs available"，但队列里有消息

**解决：**
```sql
-- 检查Worker角色权限
SELECT routine_name 
FROM information_schema.routine_privileges
WHERE grantee = 'knowledge_worker'
  AND routine_name LIKE 'worker_%';
-- 应该列出所有worker RPC

-- 检查lease状态
SELECT id, state, current_stage, lease_expires_at, now()
FROM processing_jobs
WHERE state IN ('VALIDATING', 'EXTRACTING', 'CHUNKING', 'ANALYZING', 'INDEXING');
-- 如果lease_expires_at是过去时间，说明lease过期了

-- 手动恢复stale jobs
SELECT recover_stale_jobs();
```

### 问题3：前端无法上传文件

**症状：**
浏览器显示403 Forbidden

**检查顺序：**
```typescript
// 1. 检查用户认证状态
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session); // 应该有user和access_token

// 2. 检查workspace权限
const hasCapability = await requireWorkspaceCapability(
  supabase,
  workspaceId,
  'documents.upload'
);
console.log('Has upload capability:', hasCapability);

// 3. 检查Storage bucket策略
// 在Supabase Studio → Storage → Policies
// 应该有针对upload_sessions的INSERT policy

// 4. 检查upload session是否过期
// session.expiresAt应该在未来
```

### 问题4：AI分析返回空结果

**症状：**
Document处理到ANALYZING stage但没有生成artifacts

**检查：**
```typescript
// 1. 验证OpenAI API key
const testCompletion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'test' }],
});
console.log('OpenAI works:', testCompletion);

// 2. 检查chunks是否存在
const chunks = await workerRpc.readAnalysisInput(job_id, lease_token);
console.log('Chunks count:', chunks.length);
// 应该 > 0

// 3. 检查structured output schema
// 确保KnowledgeAnalysisSchema与OpenAI兼容
// 所有required字段都有默认值或被生成

// 4. 查看provider trace
// 应该记录在analysis_runs表中
```

---

## 📊 进度跟踪

### 每周回顾模板

```markdown
# Week <N> Sprint Review

## 本周完成
- [x] Task 1: Database schema
- [x] Task 2: Identity tables
- [ ] Task 3: RLS policies (50%)

## 遇到的问题
1. Composite foreign keys语法错误 → 已解决
2. pgTAP测试一直失败 → 发现是seed data问题

## 下周计划
- [ ] 完成Task 3 RLS policies
- [ ] 开始Task 4 认证集成
- [ ] 编写E2E测试for登录流程

## 需要帮助
- 不确定Supabase Auth的最佳实践
- 性能测试工具选择

## Metrics
- 代码提交: 15 commits
- 测试覆盖率: 78%
- 代码审查: 3 PRs
```

---

## 🎯 保持高效的习惯

### 1. 晨会自问（5分钟）
- 今天要完成哪个task？
- 有哪些blockers？
- 需要谁的帮助？

### 2. 番茄工作法
```
25分钟专注编码
5分钟休息
每4个番茄休息15-20分钟
```

### 3. 定期检查Exit Gate
```bash
# 每个task完成后
cat docs/superpowers/plans/2026-09-02-ai-knowledge-base-01-foundation.md | \
  grep -A 50 "Exit Gate" | \
  head -n 30

# 对照检查清单，标记✅完成的项
```

### 4. 保持文档更新
- 发现新问题 → 立即记录到runbook
- 找到workaround → 添加到troubleshooting
- 改变设计决策 → 更新计划文档

---

## 🚀 加速技巧

### 使用脚手架工具

```bash
# 快速创建新feature
pnpm create-feature --name document-review --plan 03

# 自动生成：
# - apps/web/src/features/document-review/
#   - service.ts
#   - actions.ts
#   - components/
# - apps/web/src/app/api/document-review/route.ts
# - 对应测试文件
```

### 复用测试fixtures

```typescript
// tests/fixtures/common.ts
export const testWorkspace = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Test Workspace',
  kind: 'team',
};

export const testUsers = {
  owner: { id: '...', email: 'owner@test.com' },
  admin: { id: '...', email: 'admin@test.com' },
  editor: { id: '...', email: 'editor@test.com' },
  viewer: { id: '...', email: 'viewer@test.com' },
};

// 在任何测试中import
import { testWorkspace, testUsers } from '@/tests/fixtures/common';
```

### 使用AI辅助（但要验证）

```typescript
// 可以让AI帮你生成样板代码
// 例如RLS策略、CRUD操作、测试用例
// 但必须：
// 1. 仔细审查生成的代码
// 2. 确保符合项目规范
// 3. 运行测试验证正确性
// 4. 添加必要的edge case测试
```

---

## 📅 示例：Plan 02 第一周详细计划

### Monday: Task 1 冻结contracts

**上午（2-3小时）：**
```typescript
// 1. 创建 packages/domain/src/processing.ts
// - 定义ProcessingStage, ProcessingState枚举
// - 定义ProcessingError接口
// - 实现classifyFailure()逻辑

// 2. 创建测试
// packages/domain/src/processing.test.ts
```

**下午（2-3小时）：**
```typescript
// 3. 创建 packages/domain/src/search.ts
// - 定义WorkspaceSearchRequest
// - 定义WorkspaceSearchResult
// - 实现normalizeSearchQuery()

// 4. 运行测试
pnpm --filter @knowledge/domain test

// 5. 提交
git commit -m "feat(plan02): freeze processing and search contracts"
```

### Tuesday: Task 2 数据库jobs表

**全天（6-8小时）：**
```sql
-- 1. 创建迁移
-- supabase/migrations/0005_document_processing.sql

-- 2. 创建表：
--    - processing_jobs
--    - job_attempts  
--    - revision_stage_results

-- 3. 创建worker role
CREATE ROLE knowledge_worker NOLOGIN;

-- 4. 创建RPC stubs
CREATE FUNCTION worker_claim_processing_job(...) ...
CREATE FUNCTION worker_heartbeat(...) ...

-- 5. 编写pgTAP测试
-- 6. 运行 pnpm db:reset && pnpm test:db
-- 7. 迭代直到通过
```

### Wednesday: Task 3 Worker runtime

**上午：**
```typescript
// 创建 apps/worker/package.json
// 创建 apps/worker/src/index.ts
// - 实现polling loop
// - 实现heartbeat timer
// - 连接到本地Supabase
```

**下午：**
```typescript
// 创建 apps/worker/src/db/worker-rpc.ts
// - SupabaseWorkerRpc类
// - claimJob()方法
// - heartbeat()方法
// - finishStage()方法

// 测试worker可以claim job
```

### Thursday: Task 4 Validation stage

**全天：**
```typescript
// 1. 集成ClamAV Docker
// 2. 实现 apps/worker/src/stages/validate-file.ts
// 3. 测试所有7种格式
// 4. 测试拒绝场景（伪造、加密、病毒）
```

### Friday: Code review和收尾

**上午：**
- 完成本周所有测试
- 修复lint/typecheck错误
- 更新文档

**下午：**
- 创建PR
- Self-review代码
- 记录下周TODO

---

## 💡 最重要的建议

1. **不要跳过测试** - 写测试的时间会在后期bug修复中10倍返回
2. **小步提交** - 每个逻辑单元都提交，方便回滚
3. **遵循Exit Gate** - 这是质量保证，不是建议
4. **及时求助** - 卡住超过2小时就应该寻求帮助
5. **保持健康** - 这是长期项目，不要burnout

**记住：慢就是快，快就是慢。质量优先。** 🎯
