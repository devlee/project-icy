import { eq } from "drizzle-orm";
import type { GenerationAdapter } from "../ports/generation";
import type { StorageAdapter } from "../ports/storage";
import type { IcyDb } from "../db/client";
import { characters } from "../db/schema";
import { getPrimaryAnimeAnchor } from "../characters/images";
import {
  defaultWorkflowRegistry,
  getWorkflowById,
} from "../workflows/default-registry";
import { injectWorkflow, mergePrompts } from "../workflows/inject";
import { loadWorkflowJson } from "../workflows/load";
import { expandSeeds } from "./seeds";
import {
  GenerationTaskError,
  getGenerationTask,
  markTaskDone,
  markTaskFailed,
  markTaskRunning,
} from "./tasks";

export const WORKFLOW_TXT2IMG = "anime-txt2img-stub";
export const WORKFLOW_IPADAPTER = "anime-txt2img-ipadapter";

export type RunSingleTaskDeps = {
  db: IcyDb;
  generation: GenerationAdapter;
  storage: StorageAdapter;
  workflowsDir?: string;
  signal?: AbortSignal;
};

/**
 * Prompt fragments for generation: tagline (short visual/persona line) + extra.
 * Do NOT include character `profile` — that field holds freeform notes / research
 * (often unsuitable as ComfyUI prompt text).
 */
function buildUserPrompt(tagline: string, extra?: string): string {
  const parts = [tagline.trim(), extra?.trim()].filter(Boolean);
  return parts.join(", ");
}

function refUploadName(taskId: string, filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  const ext =
    dot > 0 && [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(filePath.slice(dot).toLowerCase())
      ? filePath.slice(dot).toLowerCase()
      : ".png";
  return `icy-ref-${taskId}${ext}`;
}

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
  const workflowId = anchor
    ? WORKFLOW_IPADAPTER
    : task.params.animeWorkflowId || WORKFLOW_TXT2IMG;

  const def = getWorkflowById(defaultWorkflowRegistry, workflowId);
  if (!def) {
    markTaskFailed(db, taskId, `未知 workflow: ${workflowId}`);
    return;
  }

  let inputImages: { name: string; data: Buffer }[] = [];
  let faceIdImageName: string | undefined;
  if (anchor) {
    try {
      const data = await storage.get(anchor.filePath);
      const name = refUploadName(taskId, anchor.filePath);
      inputImages = [{ name, data }];
      faceIdImageName = name;
    } catch {
      markTaskFailed(db, taskId, `无法读取角色参考图: ${anchor.filePath}`);
      return;
    }
  }

  const seeds = expandSeeds(task.params.seedStrategy);
  const userPrompt = buildUserPrompt(character.tagline, task.params.extraPrompt);
  const outputKeys: string[] = [];

  try {
    for (const seed of seeds) {
      if (deps.signal?.aborted) {
        throw new Error("生成已取消");
      }

      const graph = loadWorkflowJson(def, deps.workflowsDir);
      const workflow = injectWorkflow(graph, def.injectionPoints, {
        positivePrompt: mergePrompts(def.basePrompt, userPrompt || "1girl"),
        negativePrompt: mergePrompts(def.baseNegativePrompt, undefined),
        seed,
        faceIdImageName,
      });

      const result = await generation.run(
        { workflow, inputImages },
        undefined,
        deps.signal,
      );

      for (let i = 0; i < result.images.length; i++) {
        const img = result.images[i]!;
        const ext = img.filename.includes(".")
          ? img.filename.slice(img.filename.lastIndexOf("."))
          : ".png";
        const key = `raw/tasks/${taskId}/seed-${seed}/${String(i).padStart(2, "0")}${ext}`;
        await storage.put(key, img.data);
        outputKeys.push(key);
      }
    }

    markTaskDone(db, taskId, outputKeys);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    markTaskFailed(db, taskId, message, outputKeys);
  }
}
