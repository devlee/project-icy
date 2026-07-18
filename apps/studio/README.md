# Studio

project-icy 的本地创作工作台，基于 Next.js App Router、shadcn/ui Nova 与 Base UI。

推荐始终从仓库根目录安装、构建和启动：

```bash
pnpm install
cp .env.example apps/studio/.env.local
pnpm dev
```

根命令会同时启动 Web 与伴生 worker（生成、定时批次、后期拼版）。访问 [http://localhost:3000](http://localhost:3000)。生产模式使用根命令 `pnpm build` 和 `pnpm start`；请勿另开第二个 worker。

环境变量文件必须放在本目录的 `.env.local`；完整变量说明见仓库根目录 `.env.example`。本地数据库和图片位于仓库根目录 `content/`，不要提交。
