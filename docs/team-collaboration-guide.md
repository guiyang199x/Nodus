# 团队协作指南

## 👥 推荐团队配置

### 小团队（3-4人）

**角色分配：**

```
Tech Lead / 全栈工程师 (1人)
├─ 负责架构决策
├─ Code review所有PR
├─ 处理跨Plan边界问题
└─ 把握整体进度

后端工程师 (1人)
├─ Worker实现
├─ 数据库迁移
├─ RPC和RLS策略
└─ 性能优化

前端工程师 (1人)
├─ Next.js UI
├─ React组件
├─ 无障碍实现
└─ 响应式设计

可选：QA工程师 (1人)
├─ E2E测试
├─ 安全测试
├─ 性能测试
└─ 发布验证
```

### 中型团队（5-7人）

```
Tech Lead (1人) - 同上

后端小组 (2人)
├─ 后端工程师A: Worker pipeline, 格式提取
└─ 后端工程师B: Database schema, RLS, AI integration

前端小组 (2人)
├─ 前端工程师A: Core UI (Library, Upload, Document view)
└─ 前端工程师B: AI features (Graph, Chat, Review)

DevOps工程师 (1人)
├─ CI/CD pipeline
├─ 监控和告警
├─ 备份恢复
└─ 部署自动化

QA工程师 (1人) - 同上
```

---

## 🔄 协作工作流

### Sprint计划（每2周）

**Sprint开始（周一上午）：**

1. **回顾上个Sprint**
   - 哪些任务完成了？
   - 哪些blocked？
   - 技术债务如何？

2. **选择本Sprint任务**

   ```
   Plan 02 正在进行：
   ✅ Task 1: Contracts (已完成)
   ✅ Task 2: Database jobs (已完成)
   🟡 Task 3: Worker runtime (进行中，80%)
   ⬜ Task 4: Validation (下个sprint)
   ⬜ Task 5: Extraction (下个sprint)

   本Sprint承诺：
   - 完成Task 3
   - 完成Task 4
   - Task 5 开始（如果时间允许）
   ```

3. **分配任务**
   - 后端工程师A: Task 3 worker orchestration
   - 后端工程师B: Task 4 validation stage
   - 前端工程师: 开始Plan 02 UI (processing status)
   - QA: 编写Task 3/4的E2E测试

**Sprint结束（周五下午）：**

- Demo完成的功能
- 更新Exit Gate检查清单
- 记录技术债务
- 计划下Sprint

---

## 📋 任务看板示例

使用GitHub Projects或类似工具：

```
Backlog            | To Do          | In Progress        | In Review      | Done
-------------------|----------------|--------------------:|----------------|------
[ ] Plan03: Task1  | [ ] Task3:Test | [👤A] Task3:Worker | [PR#12] Task2  | [✅] Task1
[ ] Plan03: Task2  | [ ] Task4:Impl |   Heartbeat loop   |   RLS policies |   Contracts
[ ] Plan03: Task3  |                | [👤B] Task4:ClamAV |                |
                   |                |   Integration      |                |
```

**标签系统：**

- `plan01`, `plan02`, ...
- `backend`, `frontend`, `database`, `tests`
- `blocked`, `needs-review`, `urgent`
- `tech-debt`, `bug`, `enhancement`

---

## 🔀 Git分支策略

### 分支命名

```
main                              (protected, 只能通过PR合并)
  ↓
develop                           (集成分支，每日合并)
  ↓
feature/plan02-task3-worker       (功能分支)
feature/plan02-task4-validation   (功能分支)
fix/plan02-lease-expiry-bug       (修复分支)
test/plan02-e2e-upload            (测试分支)
```

### 提交消息规范

```bash
# 格式: <type>(<scope>): <subject>

# Types:
feat     - 新功能
fix      - Bug修复
docs     - 文档更新
test     - 测试相关
refactor - 重构
perf     - 性能优化
chore    - 构建/工具相关

# Examples:
git commit -m "feat(plan02): implement worker heartbeat mechanism"
git commit -m "fix(plan02): handle lease expiry race condition"
git commit -m "test(plan02): add validation stage e2e tests"
git commit -m "docs(plan02): update worker runbook"
```

### Pull Request模板

```markdown
## Description

简要描述这个PR做了什么

## Related Issue

Closes #123

## Type of Change

- [ ] Bug fix
- [x] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [x] Unit tests pass
- [x] Integration tests pass
- [x] E2E tests pass (if applicable)
- [x] Manual testing completed

## Checklist

- [x] Code follows style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] Documentation updated
- [x] No console.log or debugger statements
- [x] No hardcoded secrets
- [x] Database migration tested (if applicable)

## Screenshots (if applicable)

<before-after screenshots>

## Additional Notes

任何需要reviewer注意的事项
```

---

## 👀 Code Review最佳实践

### Reviewer检查清单

**功能性：**

- [ ] 代码实现了PR描述的功能
- [ ] Edge cases被考虑到
- [ ] 错误处理完善

**安全性：**

- [ ] 无SQL注入风险（使用parameterized queries）
- [ ] 无XSS风险（用户输入被sanitize）
- [ ] RLS策略正确（workspace_id过滤）
- [ ] 无secrets泄漏（敏感信息在.env）
- [ ] 日志无敏感数据（chunk text, prompts, tokens）

**性能：**

- [ ] 无N+1查询
- [ ] 大数据集有pagination
- [ ] 索引正确（检查EXPLAIN ANALYZE）
- [ ] 无blocking循环（使用async/await正确）

**可维护性：**

- [ ] 代码清晰易读
- [ ] 复杂逻辑有注释
- [ ] 函数职责单一
- [ ] 变量命名语义化

**测试：**

- [ ] 测试覆盖核心逻辑
- [ ] 测试有意义（不是形式主义）
- [ ] Mock合理使用
- [ ] 测试数据清理（避免污染）

### 给反馈的艺术

**❌ 不好的反馈：**

```
"这代码写得太烂了"
"为什么不这样做？"
```

**✅ 好的反馈：**

```
"建议: 这里可以使用Promise.all并行处理，能提升30%性能
示例代码：
const results = await Promise.all(items.map(item => process(item)));
"

"问题: 这个RLS策略似乎没有过滤workspace_id，可能导致跨租户泄漏
建议添加: WHERE workspace_id = current_workspace_id()
参考: docs/superpowers/plans/.../security-best-practices
"

"Nit: 变量名'x'不够语义化，建议改为'processedDocument'
(这是小问题，如果你不同意可以忽略)
"
```

**反馈优先级标签：**

- `🔴 MUST FIX` - 安全问题、功能缺陷、破坏性变更
- `🟡 SHOULD FIX` - 性能问题、可维护性、最佳实践
- `🟢 NIT` - 代码风格、命名建议（可选）

---

## 💬 沟通最佳实践

### 每日站会（15分钟）

**每人回答3个问题：**

1. 昨天完成了什么？
2. 今天计划做什么？
3. 有什么blockers？

**示例：**

```
张三 (后端):
1. 昨天: 完成了worker heartbeat实现，通过了单元测试
2. 今天: 集成ClamAV，开始validation stage
3. Blockers: ClamAV Docker镜像拉取很慢，可能需要VPN

李四 (前端):
1. 昨天: 实现了processing status组件，支持4种状态显示
2. 今天: 添加retry按钮，处理权限判断
3. Blockers: 需要后端提供reprocess API endpoint

王五 (QA):
1. 昨天: 编写了upload flow的E2E测试
2. 今天: 添加各种文件格式的测试用例
3. Blockers: 需要测试fixture文件，张三能帮忙准备吗？
```

### 技术讨论（异步优先）

**使用文档化沟通：**

```markdown
# RFC: Worker Lease Mechanism

## Problem

Worker可能crash，导致job被永久锁住

## Proposed Solution

1. 每个job有lease_expires_at字段
2. Worker每30s发送heartbeat更新lease
3. 定期检查stale jobs (lease过期 > 15min)
4. 自动requeue stale jobs

## Alternatives Considered

- Redis distributed lock: 增加依赖复杂度
- Database advisory lock: 不适合长时间持有

## Trade-offs

- Pro: 简单可靠，利用现有Postgres
- Con: 需要额外的maintenance loop

## Decision

采用方案1，理由：简单性 > 其他方案的边际收益

## Action Items

- [ ] @张三 实现heartbeat logic
- [ ] @李四 实现stale job recovery
- [ ] @王五 添加lease timeout测试
```

### Slack/微信使用规范

**频道划分：**

```
#general          - 一般讨论
#plan-01          - Plan 01相关
#plan-02          - Plan 02相关
#bugs             - Bug报告和修复
#deployments      - 发布通知
#random           - 闲聊
#wins             - 庆祝小成就 🎉
```

**消息原则：**

- 技术决策 → 写RFC文档
- 代码问题 → GitHub Issue/PR评论
- 紧急bug → @channel + 创建Issue
- 随便聊天 → #random

---

## 🎯 解决冲突

### 技术分歧

**场景：两个工程师对实现方案有不同意见**

**步骤：**

1. **各自写出方案**（方案A vs 方案B）
2. **列出优缺点**
   ```
   方案A (使用Redis cache):
   Pro: 性能更好 (O(1) lookup)
   Con: 增加依赖，运维复杂度

   方案B (使用Postgres cache table):
   Pro: 利用现有基础设施，事务一致性
   Con: 稍慢 (O(log n) with index)
   ```
3. **参考Exit Gate要求** - 哪个方案更符合？
4. **Tech Lead最终决策** - 如果无法达成共识
5. **记录决策** - 在RFC或ADR中

### Merge冲突

```bash
# 你的分支
git checkout feature/plan02-task3-worker

# 拉取最新develop
git fetch origin develop

# Rebase（而不是merge，保持线性历史）
git rebase origin/develop

# 解决冲突
# 编辑冲突文件，保留正确的代码

# 继续rebase
git add <resolved-files>
git rebase --continue

# 强制推送（因为rebase改写了历史）
git push --force-with-lease
```

**预防冲突：**

- 每天rebase develop一次
- PR尽快merge，减少分支寿命
- 大的重构提前通知团队

### 进度延迟

**场景：某个task预估2天，实际需要5天**

**立即沟通：**

```
"Hey team, Task 3 worker runtime比预期复杂，需要额外3天
原因：lease mechanism需要处理edge cases（crash recovery, stale jobs）
影响：Task 4可能推迟到下个sprint
建议：李四可以提前开始Task 5的研究，避免idle
```

**调整计划：**

- 重新评估Sprint目标
- 考虑简化scope（MVP first）
- 如有必要，寻求帮助

---

## 📚 知识共享

### 每周分享会（1小时，周五下午）

**轮流分享：**

- 本周学到的技术点
- 踩过的坑和解决方案
- 代码中的精妙设计
- 读的好文章/视频推荐

**示例主题：**

```
Week 1: "Supabase RLS最佳实践"
Week 2: "如何调试复杂的SQL查询"
Week 3: "React Server Components深度理解"
Week 4: "OpenAI Structured Output实战"
```

### 技术文档积累

**在遇到问题时立即记录：**

```markdown
# Troubleshooting: Worker无法claim job

## 症状

Worker日志显示"No jobs available"，但队列中有消息

## 根本原因

Worker role缺少EXECUTE权限on worker_claim_processing_job RPC

## 解决方案

\`\`\`sql
GRANT EXECUTE ON FUNCTION worker_claim_processing_job TO knowledge_worker;
\`\`\`

## 预防

在迁移文件中添加明确的GRANT语句，不依赖默认权限

## 相关

- Issue #42
- PR #45
```

---

## 🏆 团队文化建议

### 庆祝小胜利

**完成里程碑时：**

- Plan 01 Exit Gate通过 → 团队聚餐 🍕
- 第一个用户成功上传文档 → 截图分享到#wins
- AI分析首次返回正确结果 → 欢呼庆祝 🎉
- 性能优化提升50% → 记录并分享

### 保持可持续节奏

**避免Burnout：**

- ❌ 不鼓励加班文化
- ✅ 鼓励准时下班（6pm）
- ✅ 周末不工作（除非生产事故）
- ✅ 定期休假

**工作时间内保持高效：**

- 上午：深度工作（写代码）
- 下午：会议、Code review、协作
- 避免打断：专注时段关闭通知

### 心理安全

**鼓励的文化：**

- 提问题不会被嘲笑
- 承认错误不会被责怪
- 尝试新方案即使失败也被认可
- 互相帮助是常态

**示例对话：**

```
Junior: "我不太懂这个RLS策略怎么写..."
Senior: "没问题，这确实挺复杂的。我们一起看看，
         我记得之前写过类似的，给你找个例子。
         另外这个文档很有帮助：[链接]"

而不是：
"这么简单都不会？自己去看文档。"
```

---

## 🚨 应急响应

### 生产事故处理（Plan 05后）

**Incident Response流程：**

1. **检测**
   - 监控告警触发
   - 用户报告问题

2. **确认**
   - 验证严重性（P0-P4）
   - 确定影响范围

3. **响应**

   ```
   P0 (Critical - 服务完全不可用):
     - 立即通知on-call工程师
     - 创建incident channel
     - 每15分钟更新状态
     - 考虑rollback

   P1 (High - 核心功能受影响):
     - 通知相关工程师
     - 1小时内响应
     - 每小时更新状态

   P2/P3/P4: 正常优先级处理
   ```

4. **修复**
   - Hotfix分支（从production tag）
   - 最小改动原则
   - 快速测试
   - 部署

5. **事后回顾（Postmortem）**
   ```markdown
   # Incident Postmortem: 2024-01-15 Search服务宕机

   ## Timeline

   14:30 - 告警触发：search_p95_high
   14:35 - 确认问题：Postgres连接池耗尽
   14:45 - 部署hotfix：增加连接池大小
   15:00 - 服务恢复

   ## Root Cause

   新部署的graph查询没有使用连接池，导致连接泄漏

   ## Impact

   30分钟服务降级，~500个搜索请求失败

   ## Action Items

   - [ ] 添加连接池监控告警
   - [ ] Code review checklist加入"检查连接释放"
   - [ ] 添加集成测试覆盖高并发场景

   ## Lessons Learned

   1. 数据库连接是有限资源，必须显式管理
   2. 监控要更主动（连接数而不只是错误率）
   3. Staging环境需要模拟生产负载
   ```

---

## ✅ 团队成功的标志

**你的团队在正轨上，如果：**

- ✅ 每个Sprint都能完成承诺的任务
- ✅ Code review平均24小时内完成
- ✅ 技术债务被主动管理，不是堆积
- ✅ 新成员能在2周内开始贡献
- ✅ 团队成员乐于互相帮助
- ✅ 问题被公开讨论，不是私下抱怨
- ✅ Exit Gate检查清单被严格执行
- ✅ 大家知道项目状态和下一步目标

**需要改进的信号：**

- 🚨 频繁的生产bug（测试不够）
- 🚨 PR堆积超过1周（review不及时）
- 🚨 经常加班赶进度（计划不合理）
- 🚨 成员不愿意问问题（心理不安全）
- 🚨 重复犯同样错误（没有学习）
- 🚨 技术债务越来越多（短视决策）

---

记住：**好的团队合作 = 清晰的目标 + 开放的沟通 + 互相尊重** 🤝
