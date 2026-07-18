"use server";

import {
  cancelGenerationTask,
  createPairGenerationTask,
  createSingleGenerationTask,
  GenerationTaskError,
  retryGenerationTask,
} from "@icy/core";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { enqueueGenerationTask } from "@/lib/generation-runner";

export type ActionResult =
  | { ok: true; taskId?: string }
  | { ok: false; error: string };

export async function submitSingleTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const characterId = String(formData.get("characterId") ?? "");
    const extraPrompt = String(formData.get("extraPrompt") ?? "");
    const animeWorkflowId = String(formData.get("animeWorkflowId") ?? "") || undefined;
    const seedKind = String(formData.get("seedKind") ?? "random");

    const seedStrategy =
      seedKind === "fixed"
        ? {
            kind: "fixed" as const,
            seed: Number(formData.get("seed") ?? 0),
          }
        : {
            kind: "random" as const,
            count: Number(formData.get("count") ?? 1),
          };

    const task = createSingleGenerationTask(getDb(), {
      characterId,
      seedStrategy,
      animeWorkflowId,
      extraPrompt,
      priority: 10,
    });

    enqueueGenerationTask(task.id);
    revalidatePath("/generate");
    return { ok: true, taskId: task.id };
  } catch (e) {
    if (e instanceof GenerationTaskError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function submitPairTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const characterId = String(formData.get("characterId") ?? "");
    const extraPrompt = String(formData.get("extraPrompt") ?? "");
    const seedKind = String(formData.get("seedKind") ?? "random");

    const seedStrategy =
      seedKind === "fixed"
        ? {
            kind: "fixed" as const,
            seed: Number(formData.get("seed") ?? 0),
          }
        : {
            kind: "random" as const,
            count: Number(formData.get("count") ?? 1),
          };

    const task = createPairGenerationTask(getDb(), {
      characterId,
      seedStrategy,
      extraPrompt,
      priority: 10,
    });

    enqueueGenerationTask(task.id);
    revalidatePath("/generate");
    return { ok: true, taskId: task.id };
  } catch (e) {
    if (e instanceof GenerationTaskError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function cancelTaskAction(taskId: string): Promise<ActionResult> {
  try {
    cancelGenerationTask(getDb(), taskId);
    revalidatePath("/generate");
    return { ok: true };
  } catch (e) {
    if (e instanceof GenerationTaskError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function retryTaskAction(taskId: string): Promise<ActionResult> {
  try {
    const task = retryGenerationTask(getDb(), taskId);
    enqueueGenerationTask(task.id);
    revalidatePath("/generate");
    return { ok: true, taskId: task.id };
  } catch (e) {
    if (e instanceof GenerationTaskError) return { ok: false, error: e.message };
    throw e;
  }
}
