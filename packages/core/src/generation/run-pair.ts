import { and, eq } from "drizzle-orm";
import type { GenerationAdapter } from "../ports/generation";
import type { StorageAdapter } from "../ports/storage";
import type { IcyDb } from "../db/client";
import { characters, factors, pairSets } from "../db/schema";
import {
  getPrimaryAnimeAnchor,
  getPrimaryRealAnchor,
} from "../characters/images";
import { getPose } from "../poses/poses";
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
 * Execute a queued `pair` or `batch` task: for each seed run anime then real
 * (shared seed), write PairSet rows, mark done/failed.
 */
export async function runPairGenerationTask(
  taskId: string,
  deps: RunPairTaskDeps,
): Promise<void> {
  const { db, generation, storage } = deps;
  const task = getGenerationTask(db, taskId);
  if (!task) throw new GenerationTaskError("任务不存在", "not_found");
  if (task.type !== "pair" && task.type !== "batch") {
    throw new GenerationTaskError("仅支持 pair 或 batch 任务", "validation");
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
  const pose = task.params.poseId ? getPose(db, task.params.poseId) : null;
  if (task.params.poseId && !pose) {
    markTaskFailed(db, taskId, `姿势不存在: ${task.params.poseId}`);
    return;
  }
  const poseFilePath = pose?.filePath ?? null;
  const hasPose = Boolean(poseFilePath);
  const animeWorkflowId = resolveFormWorkflowId(
    "anime",
    Boolean(animeAnchor),
    task.params.animeWorkflowId,
    hasPose,
  );
  const realWorkflowId = resolveFormWorkflowId(
    "real",
    Boolean(realAnchor),
    task.params.realWorkflowId,
    hasPose,
  );

  const outputKeys: string[] = [];
  const formDeps = {
    generation,
    storage,
    workflowsDir: deps.workflowsDir,
    signal: deps.signal,
  };

  try {
    const factorRows = task.params.factorIds.map((id) => {
      const factor = db.select().from(factors).where(eq(factors.id, id)).get();
      if (!factor) throw new Error(`因子不存在: ${id}`);
      return factor;
    });
    const positiveFactors = factorRows
      .filter((factor) => factor.enabled)
      .map((factor) => factor.promptFragment.trim())
      .filter(Boolean)
      .join(", ");
    const negativePrompt = factorRows
      .filter((factor) => factor.enabled)
      .map((factor) => factor.negativeFragment.trim())
      .filter(Boolean)
      .join(", ");
    const extraPrompt = [positiveFactors, task.params.extraPrompt]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ");
    const userPrompt = buildUserPrompt(character.tagline, extraPrompt);
    const seeds = task.params.seeds?.length
      ? task.params.seeds
      : expandSeeds(task.params.seedStrategy);

    for (const seed of seeds) {
      if (deps.signal?.aborted) {
        throw new Error("生成已取消");
      }

      const existing = db
        .select()
        .from(pairSets)
        .where(and(eq(pairSets.taskId, taskId), eq(pairSets.seed, seed)))
        .get();
      if (existing) {
        outputKeys.push(existing.animeImagePath, existing.realImagePath);
        continue;
      }

      const animeImagePath = await runFormOnce(
        {
          taskId,
          form: "anime",
          workflowId: animeWorkflowId,
          userPrompt,
          negativePrompt,
          seed,
          anchor: animeAnchor,
          poseFilePath,
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
          negativePrompt,
          seed,
          anchor: realAnchor,
          poseFilePath,
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
        seriesId: task.seriesId,
        poseId: task.params.poseId,
      });
    }

    markTaskDone(db, taskId, outputKeys);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    markTaskFailed(db, taskId, message, outputKeys);
  }
}
