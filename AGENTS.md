# project-icy — Agent 指引

供 Cursor / AI Agent 快速了解项目。**完整规范见 `.cursor/rules/project-icy-development.mdc`（alwaysApply）。**

## 项目

AI 双形态内容工作室：同一原创角色「二次元 ↔ 真人」成对生成、筛选、后期、发布。pnpm monorepo，轻量清晰架构（依赖方向 apps → adapters → core → shared，端口在 core，切勿反向）。

- **Studio**（`apps/studio`）：本地创作工作台，Next.js 全栈 + 伴生 worker；UI 暂缓，先出设计（用 `.cursor/skills/frontend-design`，审计用 `web-design-guidelines`）
- **Portal**（`apps/portal`）：静态门户，经 Studio「发布」动作驱动，契约为 `@icy/shared` 的 `PortalContentPack`

## 关键路径

```
packages/core/src/db/schema.ts        # 全部数据模型（PairSet 为基本单元）
packages/core/src/ports/              # Storage / Generation / Queue 端口接口
packages/core/src/workflows/          # workflow registry（ComfyUI API JSON + 注入点）
packages/adapters/src/                # 端口本地实现（云化时新增实现，不改 core）
content/                              # 本地数据：icy.db + 图片（勿提交）
docs/                                 # whitepaper.md + product-design.md（本地，未入库）
```

## 常用命令

```bash
pnpm typecheck      # 提交前必须通过
pnpm test           # 提交前必须通过（Vitest；CI 同款）
pnpm db:generate    # schema 变更后生成迁移并提交 packages/core/drizzle/
pnpm db:push        # 仅本地快速实验用
```

CI：`.github/workflows/ci.yml`（typecheck + test + 迁移漂移检查）。数据库测试模式：`createDb(":memory:")` + `migrateDb`。

## 迭代必做（摘要）

CHANGELOG `[Unreleased]` → 版本只 bump 根 `package.json` → 设计变更同步 `docs/product-design.md` → 详见 rule。
