import { defaultWorkflowRegistry, listCharacters, listGenerationTasks } from "@icy/core"

export const dynamic = "force-dynamic"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { getDb } from "@/lib/db"
import { SingleTaskForm } from "./single-task-form"
import { TaskQueue, type TaskQueueItem } from "./task-queue"

export default function GeneratePage() {
  const db = getDb()
  const characters = listCharacters(db).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    origin: c.origin,
    tagline: c.tagline,
    profile: c.profile,
    animeAnchorPath: c.animeAnchorPath,
  }))
  // Confirm dialog only needs txt2img base prompts; IP-Adapter shares the same bases.
  const workflows = defaultWorkflowRegistry.workflows
    .filter((w) => w.id === "anime-txt2img-stub")
    .map((w) => ({
      id: w.id,
      name: w.name,
      basePrompt: w.basePrompt ?? "",
      baseNegativePrompt: w.baseNegativePrompt ?? "",
    }))
  const tasks: TaskQueueItem[] = listGenerationTasks(db).map((t) => ({
    id: t.id,
    type: t.type,
    status: t.status,
    characterName: t.characterName,
    error: t.error,
    params: {
      seedStrategy: t.params.seedStrategy,
      animeWorkflowId: t.params.animeWorkflowId,
      extraPrompt: t.params.extraPrompt,
      outputKeys: t.params.outputKeys,
    },
    createdAt: t.createdAt.toISOString(),
  }))

  return (
    <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(360px,480px)_1fr]">
      <SingleTaskForm characters={characters} workflows={workflows} />

      <div className="flex flex-col gap-4">
        <TaskQueue initialTasks={tasks} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              成对任务
              <Badge variant="outline" className="font-normal">
                下一阶段
              </Badge>
            </CardTitle>
            <CardDescription>
              共享 seed / pose / FaceID，一键产出双形态 PairSet（编排未接通）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              单张闭环就绪后，将在此提交成对任务并写入筛选队列。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              批次系列
              <Badge variant="outline" className="font-normal">
                下一阶段
              </Badge>
            </CardTitle>
            <CardDescription>定时批次挂在系列下，按因子池随机组合</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-1">
              <Item size="sm">
                <ItemContent>
                  <ItemTitle className="text-muted-foreground">暂无系列</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Badge variant="secondary">未启用</Badge>
                </ItemActions>
              </Item>
            </ItemGroup>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
