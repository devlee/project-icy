# project-icy

AI 双形态内容工作室：同一原创角色的「二次元 ↔ 真人」成对生成、筛选、后期与半自动发布流水线。

## 当前状态

- `apps/studio`：本地 Next.js 创作工作台，角色库、单张/成对生成、筛选、拼版和排期 MVP 已接入真实数据。
- `apps/portal`：阶段 1 中期启动的静态门户，目前仅保留内容包契约和占位说明。
- `packages/core`：数据模型、业务流程、workflow registry 与端口接口。
- `packages/adapters`：本地文件、ComfyUI、进程内队列与 Sharp 图片处理实现。
- `packages/shared`：共享枚举和 Portal 内容包类型。

本地生成数据写入 `content/`，包括 SQLite 数据库和图片；该目录已被 Git 忽略，禁止提交。

## 环境要求

- Node.js 20 或更高版本（CI 使用 Node.js 22）
- pnpm 10（根 `package.json` 已声明 `pnpm@10.0.0`）
- Comfy Cloud API Key，或本机可访问的 ComfyUI

## 本地启动

在仓库根目录执行：

```bash
pnpm install
cp .env.example apps/studio/.env.local
pnpm dev
```

`pnpm dev` 会同时启动 Studio Web 与伴生 worker。然后访问 [http://localhost:3000](http://localhost:3000)。首次启动时会创建 `content/icy.db` 并应用已提交的 SQL 迁移。生成、定时批次与后期拼版任务由 worker 按优先级串行执行；请勿另开第二个 worker。

Next.js 的项目根目录是 `apps/studio`，因此环境变量应放在 `apps/studio/.env.local`。仓库根目录的 `.env` 不会被上述命令自动读取。云端使用 `COMFY_CLOUD_API_KEY`；本机 ComfyUI 可在环境文件中设置：

```dotenv
COMFYUI_BACKEND=local
COMFYUI_URL=http://127.0.0.1:8188
```

生产模式本地运行：

```bash
pnpm build
pnpm start
```

## 常用命令

```bash
pnpm dev             # 启动 Studio Web + 伴生 worker
pnpm build           # 构建 Studio
pnpm start           # 启动已构建的 Studio Web + 伴生 worker
pnpm typecheck       # 全仓类型检查
pnpm test            # 运行全部 Vitest 测试
pnpm test:coverage   # 运行测试并生成覆盖率报告
pnpm db:generate     # schema 变更后生成 SQL 迁移（须提交）
pnpm db:push         # 仅用于本地快速实验
```

开发规范见 `AGENTS.md` 与 `.cursor/rules/project-icy-development.mdc`。架构依赖方向固定为 `apps → adapters → core → shared`。
