import {
  defaultWorkflowRegistry,
  listCharacters,
  listGenerationTasks,
  listSeries,
} from "@icy/core"

export const dynamic = "force-dynamic"

import { getDb } from "@/lib/db"
import { BatchSeries } from "./batch-series"
import { PairTaskForm } from "./pair-task-form"
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
    realAnchorPath: c.realAnchorPath,
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
  }))

  return (
    <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(360px,480px)_1fr]">
      <div className="flex flex-col gap-4">
        <SingleTaskForm characters={characters} workflows={workflows} />
        <PairTaskForm characters={characters} />
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
        />
      </div>
    </main>
  )
}
