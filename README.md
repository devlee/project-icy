# project-icy

AI 双形态内容工作室：同一原创角色的「二次元 ↔ 真人」成对生成、筛选、后期与发布流水线。

## 结构

```
apps/
  studio/     后台创作管理（本地运行，UI 待设计后开发）
  portal/     前台门户（静态站，阶段 1 中期启动）
packages/
  core/       数据模型（Drizzle + SQLite）、workflow registry、成对生成编排、
              端口接口（Storage / Generation / Queue）
  adapters/   端口的基础设施实现（本地 fs / ComfyUI / 进程内队列，云化只换实现）
  shared/     共享类型（枚举、门户内容包 schema）
content/      本地内容仓（git 忽略：图片、数据库）
docs/         项目文档（git 忽略）：whitepaper.md、product-design.md
```

## 开发

```bash
pnpm install
pnpm typecheck        # 全仓类型检查
pnpm test             # 运行全部测试（Vitest）
pnpm db:generate      # schema 变更后生成 SQL 迁移（须提交）
pnpm db:push          # 本地快速同步 schema 到 content/icy.db
```

要求 Node ≥ 20、pnpm ≥ 10。

开发规范见 `AGENTS.md` 与 `.cursor/rules/project-icy-development.mdc`（架构依赖规则：apps → adapters → core → shared）。
