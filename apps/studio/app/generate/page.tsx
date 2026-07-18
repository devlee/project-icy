import {
  defaultWorkflowRegistry,
  listCharacters,
  listFactors,
  listGenerationTasks,
  listPoses,
  listSeries,
  resolveFactorNames,
  resolvePoseNames,
} from "@icy/core"

export const dynamic = "force-dynamic"

import { getDb } from "@/lib/db"
import { BatchSeries } from "./batch-series"
import { FactorManager } from "./factor-manager"
import { PairTaskForm } from "./pair-task-form"
import { PoseManager } from "./pose-manager"
import { SingleTaskForm } from "./single-task-form"
import { TaskQueue, type TaskQueueItem } from "./task-queue"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
    realAnchorPath: c.realAnchorPath,
  }))
  const factors = listFactors(db).map((f) => ({
    id: f.id,
    category: f.category,
    name: f.name,
    promptFragment: f.promptFragment,
    negativeFragment: f.negativeFragment,
    enabled: f.enabled,
  }))
  const factorOptions = factors.map((f) => ({
    id: f.id,
    category: f.category,
    name: f.name,
    promptFragment: f.promptFragment,
    enabled: f.enabled,
  }))
  const poses = listPoses(db).map((p) => ({
    id: p.id,
    name: p.name,
    filePath: p.filePath,
    tags: p.tags,
  }))
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
      realWorkflowId: t.params.realWorkflowId,
      extraPrompt: t.params.extraPrompt,
      outputKeys: t.params.outputKeys,
      factorIds: t.params.factorIds,
      factorNames: resolveFactorNames(db, t.params.factorIds ?? []),
      poseId: t.params.poseId,
      poseNames: t.params.poseId
        ? resolvePoseNames(db, [t.params.poseId])
        : [],
    },
    createdAt: t.createdAt.toISOString(),
  }))
  const characterNames = new Map(characters.map((character) => [character.id, character.name]))
  const batchSeries = listSeries(db).map((row) => ({
    id: row.id,
    name: row.name,
    characterName: characterNames.get(row.characterId) ?? "未知角色",
    scheduleCron: row.scheduleCron,
    active: row.active,
    perBatch: row.batchConfig?.perBatch ?? 0,
    factorNames: resolveFactorNames(db, row.batchConfig?.factorIds ?? []),
    poseNames: resolvePoseNames(db, row.batchConfig?.poseIds ?? []),
  }))

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <Tabs defaultValue="generate" className="flex flex-1 flex-col gap-4">
        <TabsList>
          <TabsTrigger value="generate">生成</TabsTrigger>
          <TabsTrigger value="factors">因子库</TabsTrigger>
          <TabsTrigger value="poses">姿势库</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="grid flex-1 gap-4 lg:grid-cols-[minmax(360px,480px)_1fr]">
          <div className="flex flex-col gap-4">
            <SingleTaskForm characters={characters} workflows={workflows} />
            <PairTaskForm
              characters={characters}
              factors={factorOptions}
              poses={poses}
            />
          </div>

          <div className="flex flex-col gap-4">
            <TaskQueue initialTasks={tasks} />

            <BatchSeries
              characters={characters.map((character) => ({
                id: character.id,
                name: character.name,
                status: character.status,
              }))}
              series={batchSeries}
              factors={factorOptions}
              poses={poses}
            />
          </div>
        </TabsContent>

        <TabsContent value="factors" className="max-w-3xl">
          <FactorManager factors={factors} />
        </TabsContent>

        <TabsContent value="poses" className="max-w-3xl">
          <PoseManager poses={poses} />
        </TabsContent>
      </Tabs>
    </main>
  )
}
