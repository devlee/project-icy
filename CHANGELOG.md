# Changelog

本项目遵循 [SemVer](https://semver.org/lang/zh-CN/)（0.x.y），版本唯一来源为根 `package.json`。

## [Unreleased]

### Added

- Monorepo 骨架：pnpm workspaces（`apps/studio`、`apps/portal` 占位；`packages/shared`、`packages/core`、`packages/adapters`）
- 数据模型（Drizzle + SQLite，11 张表）：角色库（含基准图/FaceID 参考/LoRA/因子绑定）、因子库、pose 库、系列与批次配置、生成任务、PairSet 成对结果、成品资产、发布计划
- 端口接口（`@icy/core/ports`）：StorageAdapter / GenerationAdapter / QueueAdapter；本地实现（`@icy/adapters`）：文件系统存储、进程内优先级队列
- Workflow registry 类型：注入点声明 + 成对配置（共享 seed/pose/FaceID）
- 门户内容包契约 `PortalContentPack`（Studio → Portal 发布 schema）
- 开发规范：`.cursor/rules/project-icy-development.mdc` + `AGENTS.md`
- 测试体系：Vitest（core 18 项 schema/存储/队列测试）；SQL 迁移入库（`packages/core/drizzle/`），运行时与测试统一走 `migrateDb`
- CI：GitHub Actions（typecheck + test + 迁移漂移检查）
- 设计 skills：`frontend-design`（Anthropic）、`web-design-guidelines`（Vercel）
