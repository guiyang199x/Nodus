# AI知识库项目 - 完整文档总结

> **状态**: 📝 计划阶段完成，准备开始实施  
> **最后更新**: 2026-09-03  
> **文档完整性**: ✅ 100%

## 📚 文档索引

### 核心规划文档（位于 `docs/superpowers/plans/`）

| 文档 | 规模 | 状态 | 内容概览 |
|-----|------|------|---------|
| [Master计划](superpowers/plans/2026-09-02-ai-knowledge-base-master.md) | 21 KB | ✅ 完整 | 5个Plan协调、合约清单、里程碑 |
| [Plan 01: Foundation](superpowers/plans/2026-09-02-ai-knowledge-base-01-foundation.md) | 156 KB | ✅ 完整 | 身份认证、工作区、权限、存储 |
| [Plan 02: Ingestion & Search](superpowers/plans/2026-09-02-ai-knowledge-base-02-ingestion-search.md) | 194 KB | ✅ 完整 | 文档处理、混合搜索、Worker、100+检查项 |
| [Plan 03: AI & Graph](superpowers/plans/2026-09-02-ai-knowledge-base-03-ai-graph.md) | 139 KB | ✅ 完整 | AI分析、知识图谱、证据追溯、120+检查项 |
| [Plan 04: Chat & Collab](superpowers/plans/2026-09-02-ai-knowledge-base-04-chat-collaboration.md) | 93 KB | ✅ 完整 | Grounded聊天、团队问答、协作、100+检查项 |
| [Plan 05: Hardening & Release](superpowers/plans/2026-09-02-ai-knowledge-base-05-hardening-release.md) | 92 KB | ✅ 完整 | 删除、审计、性能、发布门禁、150+检查项 |

**合计**: 695 KB，5个完整的垂直计划 + 1个总体协调计划

### 实施指南文档（位于 `docs/`）

| 文档 | 用途 | 受众 |
|-----|------|------|
| [Implementation Guide](implementation-guide.md) | 阶段化实施路线图、环境搭建、时间估算 | Tech Lead, 全体工程师 |
| [Daily Execution Guide](daily-execution-guide.md) | 每日开发流程、调试技巧、进度跟踪 | 执行工程师 |
| [Team Collaboration Guide](team-collaboration-guide.md) | 团队配置、协作工作流、沟通规范 | Tech Lead, Scrum Master |

---

## 🎯 项目概览

### 产品定位
跨行业、多用户云服务的AI知识库，支持个人和团队工作区，集成文档管理、智能分析、知识图谱和Grounded Chat。

### 核心特性
- ✅ **多租户隔离**: 严格的workspace边界，零跨租户泄漏
- ✅ **文档处理**: 支持7种格式（JPG/PNG/WebP/PDF/DOCX/Markdown/TXT）
- ✅ **混合搜索**: 词法 + CJK + 语义向量的RRF融合
- ✅ **AI分析**: 摘要、主题、标签、实体、关系（全程可追溯证据）
- ✅ **知识图谱**: 桌面交互式画布 + 移动端语义列表
- ✅ **Grounded Chat**: 基于证据的问答，拒绝幻觉
- ✅ **团队协作**: 版本化笔记、评论、实时更新

### 技术栈
```
前端:   Next.js 16 + React 19 + Tailwind CSS 4
后端:   Node.js 24 LTS + TypeScript strict
数据库: Supabase (Postgres + RLS + Private Storage + Queues + Realtime)
AI:     OpenAI (适配器模式，可替换)
测试:   Vitest 4 + Playwright + pgTAP
CI/CD:  GitHub Actions + Docker
```

---

## 📊 质量保证体系

### 每个Plan的验收标准

每个Plan都包含3层质量保证：

1. **详细验收测试矩阵** (70-100+测试用例)
   - 功能正确性
   - 权限执行
   - 租户隔离
   - 性能预算
   - 可访问性

2. **运维手册** (Operations Runbook)
   - 架构概览
   - 诊断查询
   - 故障排除
   - 性能监控
   - 隐私合规

3. **退出门禁** (Exit Gate, 100-150检查项)
   - 必须全部通过才能进入下一Plan
   - 可验证、可执行的检查标准
   - 涵盖功能、安全、性能、运维各方面

### 关键质量指标

| 类别 | 指标 | 阈值 |
|-----|------|------|
| **安全** | 跨租户泄漏 | 0 |
| | 提示注入防御率 | 100% |
| **AI质量** | 主题/标签Top-5召回率 | ≥ 80% |
| | 实体/关系Micro-F1 | ≥ 85% |
| | 引用支持率 | ≥ 90% |
| **性能** | 搜索P95延迟 | < 1.5s |
| | 聊天TTFC P95 | < 8s |
| | LCP P75 | < 2.5s |
| **可访问性** | WCAG 2.2 AA合规 | 100% |
| | Critical/Serious问题 | 0 |
| **备份恢复** | RPO | ≤ 24h |
| | RTO | ≤ 8h |

---

## 🚀 实施路线图

### 执行顺序（严格按序）
```
阶段0: 初始化 (1-2周)
  └─ 环境搭建、工具配置、AI账号
       ↓
阶段1: Plan 01 (3-4周)
  └─ Identity、Workspaces、RBAC、Private Storage
       ↓
阶段2: Plan 02 (4-6周)
  └─ 文档处理、混合搜索、Worker Pipeline
       ↓
阶段3: Plan 03 (4-5周)
  └─ AI分析、知识图谱、证据追溯
       ↓
阶段4: Plan 04 (3-4周)
  └─ Grounded聊天、团队问答、协作功能
       ↓
阶段5: Plan 05 (3-4周)
  └─ 删除、审计、性能、发布门禁
       ↓
生产发布 🎉
```

**总时长预估**: 18-22周（约5个月）

### 团队配置建议

**小团队（3-4人）:**
- Tech Lead (1)
- 后端工程师 (1)
- 前端工程师 (1)
- QA工程师 (1, 可选)

**中型团队（5-7人）:**
- Tech Lead (1)
- 后端工程师 (2)
- 前端工程师 (2)
- DevOps工程师 (1)
- QA工程师 (1)

---

## 📋 每日开发循环

### 标准工作日流程

```bash
# 早上
git pull origin main
pnpm install
pnpm db:reset  # 如有新迁移

# 启动开发环境（4个终端窗口）
pnpm dev:web       # 终端1
pnpm dev:worker    # 终端2
pnpm test --watch  # 终端3
pnpm typecheck --watch  # 终端4

# 开发 → 测试 → 提交
# (迭代)

# 晚上离开前
pnpm lint && pnpm typecheck
git commit -am "wip: <description>"
git push
```

### 任务完成检查清单

每个任务完成后：
- [ ] `pnpm lint` 通过
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过
- [ ] 新功能有测试覆盖
- [ ] 数据库测试通过（如有迁移）
- [ ] 提交代码并推送

---

## 🛡️ 安全与合规

### 核心安全原则

1. **零信任边界**
   - Worker无直接表权限（只通过RPC）
   - 所有RPC检查lease + workspace_id
   - 客户端提供的ID从不被信任

2. **租户隔离**
   - 所有表有 `(workspace_id, id)` 复合键
   - 所有查询必须过滤 `workspace_id`
   - RLS策略双重保护

3. **隐私保护**
   - 日志无敏感内容（chunk text, prompts, tokens）
   - AI请求使用 `store: false`
   - 审计记录无content bodies

4. **输入验证**
   - 所有用户输入Zod验证
   - 文件类型magic byte检查
   - SQL注入防护（parameterized queries）

### 合规要求

- WCAG 2.2 AA无障碍标准
- 隐私政策披露：AI提供商、数据处理、保留期限
- 数据删除控制：30天恢复窗口 + 24小时永久删除
- 审计日志保留：按政策要求（例如7年）

---

## 📈 成功指标

### MVP发布的必要条件

✅ **所有5个Plan的Exit Gate通过**  
✅ **零P0/P1缺陷**  
✅ **安全测试：零跨租户泄漏、零提示注入失败**  
✅ **AI质量：所有阈值达标（80%/85%/85%/90%）**  
✅ **性能：所有预算达标**  
✅ **可访问性：零Critical/Serious问题**  
✅ **备份恢复：最近一次演练通过（RPO≤24h, RTO≤8h）**  
✅ **`pnpm release:gate --revision <sha>` 返回 `approved`**

---

## 🔗 快速导航

### 立即开始

1. **阅读**: [Implementation Guide](implementation-guide.md)
2. **搭建环境**: 按照Implementation Guide的"阶段1"
3. **开始Plan 01**: 阅读 [Plan 01文档](superpowers/plans/2026-09-02-ai-knowledge-base-01-foundation.md)
4. **每日参考**: [Daily Execution Guide](daily-execution-guide.md)

### 遇到问题

- **技术问题**: 参考对应Plan的运维手册 (Operations Runbook)
- **协作问题**: [Team Collaboration Guide](team-collaboration-guide.md)
- **Git工作流**: Team Collaboration Guide的"Git分支策略"
- **Code Review**: Team Collaboration Guide的"Code Review最佳实践"

---

## 🎓 关键经验教训（提前记录）

### DOs ✅

- ✅ 严格按Plan顺序执行，不跳步
- ✅ 每个任务完成后运行完整测试套件
- ✅ Exit Gate是质量保证，不是建议
- ✅ 及时求助，卡住2小时就寻求帮助
- ✅ 小步提交，方便回滚
- ✅ 文档同步更新

### DON'Ts ❌

- ❌ 不要跳过测试（技术债会10倍返回）
- ❌ 不要在Plan未完成时并行开启下一个Plan
- ❌ 不要忽略Exit Gate检查项
- ❌ 不要把secrets提交到git
- ❌ 不要在日志中记录敏感数据
- ❌ 不要绕过RLS直接查询表

---

## 📞 支持和联系

**项目维护者**: [您的团队]  
**技术问题**: [GitHub Issues / 内部论坛]  
**文档反馈**: [提交PR到docs/目录]

---

**最后更新**: 2026-09-03  
**文档版本**: 1.0  
**项目阶段**: 📝 计划完成，准备实施

---

> **记住**: 这是一个长期项目（5个月），慢就是快。  
> 质量第一，保持可持续的节奏。  
> 团队健康和项目成功一样重要。 💪
