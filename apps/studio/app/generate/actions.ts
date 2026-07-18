"use server";

import {
  cancelGenerationTask,
  createBatchGenerationTask,
  createPairGenerationTask,
  createSeries,
  createSingleGenerationTask,
  GenerationTaskError,
  retryGenerationTask,
  SeriesError,
  updateSeries,
} from "@icy/core";
import cron from "node-cron";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

export type ActionResult =
  | { ok: true; taskId?: string; seriesId?: string }
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
    revalidatePath("/generate");
    return { ok: true, taskId: task.id };
  } catch (e) {
    if (e instanceof GenerationTaskError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function createSeriesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const characterId = String(formData.get("characterId") ?? "");
    const name = String(formData.get("name") ?? "");
    const theme = String(formData.get("theme") ?? "");
    const scheduleCron = String(formData.get("scheduleCron") ?? "").trim();
    const perBatch = Number(formData.get("perBatch") ?? 1);
    if (scheduleCron && !cron.validate(scheduleCron)) {
      return { ok: false, error: "cron 表达式无效" };
    }

    const row = createSeries(getDb(), {
      characterId,
      name,
      theme,
      scheduleCron: scheduleCron || null,
      batchConfig: { factorIds: [], poseIds: [], perBatch },
    });
    revalidatePath("/generate");
    return { ok: true, seriesId: row.id };
  } catch (error) {
    if (error instanceof SeriesError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function runBatchNowAction(seriesId: string): Promise<ActionResult> {
  try {
    const task = createBatchGenerationTask(getDb(), { seriesId });
    revalidatePath("/generate");
    return { ok: true, taskId: task.id };
  } catch (error) {
    if (error instanceof GenerationTaskError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function setSeriesActiveAction(
  seriesId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    updateSeries(getDb(), seriesId, { active });
    revalidatePath("/generate");
    return { ok: true, seriesId };
  } catch (error) {
    if (error instanceof SeriesError) return { ok: false, error: error.message };
    throw error;
  }
}
