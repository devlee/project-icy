# Changelog

本项目遵循 [SemVer](https://semver.org/lang/zh-CN/)（0.x.y），版本唯一来源为根 `package.json`。

## [Unreleased]

### Added

- Monorepo 骨架：pnpm workspaces（`apps/studio`、`apps/portal` 占位；`packages/shared`、`packages/core`、`packages/adapters`）
- 数据模型（Drizzle + SQLite，13 张表）：角色库（含基准图/FaceID 参考/LoRA/因子绑定）、因子库、pose 库、系列与批次配置、生成/后期任务、PairSet 成对结果、成品资产、发布计划
- 端口接口（`@icy/core/ports`）：StorageAdapter / GenerationAdapter / QueueAdapter；本地实现（`@icy/adapters`）：文件系统存储、进程内优先级队列
- Workflow registry 类型：注入点声明 + 成对配置（共享 seed/pose/FaceID）
- 门户内容包契约 `PortalContentPack`（Studio → Portal 发布 schema）
- 开发规范：`.cursor/rules/project-icy-development.mdc` + `AGENTS.md`
- 测试体系：Vitest（core/adapters 单元与集成测试）；SQL 迁移入库（`packages/core/drizzle/`），运行时与测试统一走 `migrateDb`
- CI：GitHub Actions（typecheck + test + 迁移漂移检查）
- Studio UI（`apps/studio`）：Next.js 16 + Tailwind v4 + shadcn/ui（Nova 预设，Base UI），六个页面全部完成 UI 骨架（仪表盘、角色库、生成中心、筛选、后期、排期），静态数据待接入 `@icy/core`
- Studio 深浅模式切换：`next-themes` + 顶栏切换按钮，默认跟随系统
- 测试覆盖率：`@vitest/coverage-v8`，`pnpm test:coverage` 出终端 + HTML 报告；CI Test 步骤改为跑覆盖率（不设硬门槛）；当前 core 99% / adapters 100%（语句）
- 设计 skills：`shadcn`（官方，`.agents/skills/`）、`ui-ux-pro-max`（`.cursor/skills/`）
- 设计 skills：`frontend-design`（Anthropic）、`web-design-guidelines`（Vercel）
- 角色库接真库：`@icy/core` 角色 CRUD（list/create/update/archive）+ 测试；Studio Server Actions + `/characters` 读写 `content/icy.db`（启动时 migrate）
- 角色来源划分：`origin`（`original` / `ip_reference`）+ `ipSource`；创建表单与列表筛选；迁移 `0001_*`；研究清单 `docs/anime-character-research.md`
- Studio REST：`GET/POST /api/characters`（列表 / 创建）
- ComfyUI `GenerationAdapter`（`@icy/adapters`）：`ping` + `run`（HTTP `/prompt` + WebSocket 进度 + `/view` 拉图）；mock 测试
- Workflow 注入：`injectWorkflow` / stub 图 `packages/core/workflows/anime-txt2img.stub.json` + `defaultWorkflowRegistry`
- Studio 单张生成烟测：`POST /api/generate`、`GET /api/comfyui/health`；侧栏真实连接状态；`.env.example`（`COMFYUI_URL`）
- ComfyUI adapter 支持 **Comfy Cloud**：`COMFY_CLOUD_API_KEY` + `https://cloud.comfy.org`（`X-API-Key`、`/api/*`、WS `token`）；无 key 时仍走本机
- 生成中心单张闭环：`generation_tasks` CRUD + `runSingleGenerationTask`；Studio `/generate` 真表单与队列轮询；成对/批次 UI 占位
- Fixed: Comfy Cloud 成功响应里的空 `node_errors: {}` 被误判为拒绝工作流
- 生成任务：失败/已取消可一键重试（保留原参数，重新入队）
- 默认 anime workflow 改用 Comfy Cloud 可用的 `wai-illustrious-sdxl.safetensors`（832×1216）；执行错误信息更可读
- 角色一致性：`character_images` CRUD（主基准）+ 角色库上传 anime 基准；`anime-txt2img-ipadapter` workflow；单张生成有参考图时自动上传并走 IP-Adapter；Studio `GET /api/content/[...path]` 预览
- Fixed: IP-Adapter workflow 的 `weight_type` 改回 Cloud 合法值 `standard`（误用 Advanced 节点的 `linear` 会导致 400）
- Changed: IP-Adapter 默认改为 `PLUS FACE`、weight `1.15`、`style transfer`；芙宁娜 tagline 改为 Illustrious 可用英文外观标签
- 成对生成 MVP：`createPairGenerationTask` + `runPairGenerationTask`（共享 seed：anime→real）写入 `pair_sets`；RealVisXL + IP-Adapter workflow；角色库 real 主基准上传；生成中心成对表单与队列双缩略图
- Fixed: 角色基准上传放宽到 100MB，并提高 Next Server Actions `bodySizeLimit`（默认 1MB 会拒大图）
- 筛选写回 MVP：`reviewPairSet` / `getReviewStats`；Studio `/review` 接真实 PairSet，快捷键 J/K、1–5、Enter/X/H 写回；淘汰不删文件
- 后期拼版 MVP：`ImageComposePort` + Sharp 左右拼版/AI 声明水印/多平台尺寸；`runComposePairSet` 写 `assets` 并标记 `composed`；Studio `/post` 真库队列
- 排期与半自动发布 MVP：`publish_plans` CRUD + 库存天数；Studio `/schedule` 创建排期、当日清单（复制文案 + 素材路径）、标记已发布；后期「加入排期」预填
- Fixed: IP 参考角色内容仅限研究，core 强制排除商业库存并阻断创建/标记发布计划；后期界面明确标识不可发布
- Fixed: 成品库存只统计原创、已通过、已完成后期且尚未排期的 PairSet，避免已排期/已发布内容继续虚增库存天数
- Fixed: 排期页保留展示逾期未发布项目，避免日期跨天后任务从工作台消失
- Studio 仪表盘与全局头部改接真实任务、筛选、库存和发布计划摘要，移除固定日期与假指标；筛选快捷键不再劫持聚焦按钮的 Enter
- Series/Batch 核心域：系列配置校验、低优先级 batch task、因子正/负提示词注入、系列/pose 关联与测试
- 伴生 generation worker：恢复 DB 排队任务、中断态显式失败、交互任务优先、Series cron 同步；根 `dev/start` 同时启动 Web 与 worker
- 生成中心批次系列 UI：创建定时系列、立即运行、停用/启用；`POST /api/generate` 改为返回 202 的异步 DB 任务
- Fixed: ComfyUI 在提交 prompt 前建立 WebSocket，避免快速任务丢完成事件；超时主动调用 `/interrupt`
- Fixed: 随机任务在创建时固化 concrete seeds；Pair/Batch 重试跳过已完成 seed，成品资产按稳定输出键幂等写入，避免半途失败后重复记录
- 后期任务持久化：新增 `post_tasks` 与迁移 `0002_*`，拼版改由伴生 worker 执行；排队/运行/失败状态与错误在后期页可见，重启不再静默丢任务
