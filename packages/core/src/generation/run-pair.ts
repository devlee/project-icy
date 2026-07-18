import { eq } from "drizzle-orm";
import type { GenerationAdapter } from "../ports/generation";
import type { StorageAdapter } from "../ports/storage";
import type { IcyDb } from "../db/client";
import { characters } from "../db/schema";
import {
  getPrimaryAnimeAnchor,
  getPrimaryRealAnchor,
} from "../characters/images";
import { createPairSet } from "./pair-sets";
import {
  buildUserPrompt,
  resolveFormWorkflowId,
  runFormOnce,
} from "./run-form";
import { expandSeeds } from "./seeds";
import {
  GenerationTaskError,
  getGenerationTask,
  markTaskDone,
  markTaskFailed,
  markTaskRunning,
} from "./tasks";

export type RunPairTaskDeps = {
  db: IcyDb;
  generation: GenerationAdapter;
  storage: StorageAdapter;
  workflowsDir?: string;
  signal?: AbortSignal;
};

/**
 * Execute a queued `pair` task: for each seed run anime then real (shared seed),
 * write PairSet rows, mark done/failed.
 */
export async function runPairGenerationTask(
  taskId: string,
  deps: RunPairTaskDeps,
): Promise<void> {
  const { db, generation, storage } = deps;
  const task = getGenerationTask(db, taskId);
  if (!task) throw new GenerationTaskError("任务不存在", "not_found");
  if (task.type !== "pair") {
    throw new GenerationTaskError("仅支持 pair 任务", "validation");
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

  const animeAnchor = getPrimaryAnimeAnchor(db, character.id);
  const realAnchor = getPrimaryRealAnchor(db, character.id);
  const animeWorkflowId = resolveFormWorkflowId(
    "anime",
    Boolean(animeAnchor),
    task.params.animeWorkflowId,
  );
  const realWorkflowId = resolveFormWorkflowId(
    "real",
    Boolean(realAnchor),
    task.params.realWorkflowId,
  );

  const seeds = expandSeeds(task.params.seedStrategy);
  const userPrompt = buildUserPrompt(character.tagline, task.params.extraPrompt);
  const outputKeys: string[] = [];
  const formDeps = {
    generation,
    storage,
    workflowsDir: deps.workflowsDir,
    signal: deps.signal,
  };

  try {
    for (const seed of seeds) {
      if (deps.signal?.aborted) {
        throw new Error("生成已取消");
      }

      const animeImagePath = await runFormOnce(
        {
          taskId,
          form: "anime",
          workflowId: animeWorkflowId,
          userPrompt,
          seed,
          anchor: animeAnchor,
          outputName: "anime",
        },
        formDeps,
      );
      outputKeys.push(animeImagePath);

      const realImagePath = await runFormOnce(
        {
          taskId,
          form: "real",
          workflowId: realWorkflowId,
          userPrompt,
          seed,
          anchor: realAnchor,
          outputName: "real",
        },
        formDeps,
      );
      outputKeys.push(realImagePath);

      createPairSet(db, {
        taskId,
        characterId: character.id,
        seed,
        animeImagePath,
        realImagePath,
      });
    }

    markTaskDone(db, taskId, outputKeys);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    markTaskFailed(db, taskId, message, outputKeys);
  }
}
