import { eq } from "drizzle-orm";
import type { GenerationAdapter } from "../ports/generation";
import type { StorageAdapter } from "../ports/storage";
import type { IcyDb } from "../db/client";
import { characters } from "../db/schema";
import { getPrimaryAnimeAnchor } from "../characters/images";
import { expandSeeds } from "./seeds";
import {
  buildUserPrompt,
  resolveFormWorkflowId,
  runFormOnce,
  WORKFLOW_ANIME_IPADAPTER,
  WORKFLOW_ANIME_TXT2IMG,
} from "./run-form";
import {
  GenerationTaskError,
  getGenerationTask,
  markTaskDone,
  markTaskFailed,
  markTaskRunning,
} from "./tasks";

/** @deprecated Use WORKFLOW_ANIME_* from run-form */
export const WORKFLOW_TXT2IMG = WORKFLOW_ANIME_TXT2IMG;
/** @deprecated Use WORKFLOW_ANIME_* from run-form */
export const WORKFLOW_IPADAPTER = WORKFLOW_ANIME_IPADAPTER;

export type RunSingleTaskDeps = {
  db: IcyDb;
  generation: GenerationAdapter;
  storage: StorageAdapter;
  workflowsDir?: string;
  signal?: AbortSignal;
};

/**
 * Execute a queued `single` generation task end-to-end.
 * Marks running → done/failed; writes images under raw/tasks/{taskId}/.
 * With an anime anchor, uses IP-Adapter workflow and uploads the reference.
 */
export async function runSingleGenerationTask(
  taskId: string,
  deps: RunSingleTaskDeps,
): Promise<void> {
  const { db, generation, storage } = deps;
  const task = getGenerationTask(db, taskId);
  if (!task) throw new GenerationTaskError("任务不存在", "not_found");
  if (task.type !== "single") {
    throw new GenerationTaskError("仅支持 single 任务", "validation");
  }
  if (task.status === "cancelled") return;
  if (task.status !== "queued") {
    throw new GenerationTaskError(`任务状态不可执行: ${task.status}`, "conflict");
  }

  markTaskRunning(db, taskId);

  const character = db
    .select()
    .from(characters)
    .where(eq(characters.id, task.characterId))
    .get();
  if (!character) {
    markTaskFailed(db, taskId, "角色不存在");
    return;
  }

  const anchor = getPrimaryAnimeAnchor(db, character.id);
  const workflowId = resolveFormWorkflowId(
    "anime",
    Boolean(anchor),
    task.params.animeWorkflowId,
  );
  const seeds = task.params.seeds?.length
    ? task.params.seeds
    : expandSeeds(task.params.seedStrategy);
  const userPrompt = buildUserPrompt(character.tagline, task.params.extraPrompt);
  const outputKeys: string[] = [];

  try {
    for (const seed of seeds) {
      if (deps.signal?.aborted) {
        throw new Error("生成已取消");
      }

      const key = await runFormOnce(
        {
          taskId,
          form: "anime",
          workflowId,
          userPrompt,
          seed,
          anchor,
          outputName: "00",
        },
        { generation, storage, workflowsDir: deps.workflowsDir, signal: deps.signal },
      );
      outputKeys.push(key);
    }

    markTaskDone(db, taskId, outputKeys);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    markTaskFailed(db, taskId, message, outputKeys);
  }
}
