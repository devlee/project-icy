"use server";

import {
  cancelGenerationTask,
  createBatchGenerationTask,
  createFactor,
  createPairGenerationTask,
  createPose,
  createSeries,
  createSingleGenerationTask,
  deleteFactor,
  deletePose,
  FactorError,
  GenerationTaskError,
  getFactor,
  importFactorPresets,
  importPosePresets,
  PoseError,
  retryGenerationTask,
  SeriesError,
  setFactorEnabled,
  updateFactor,
  updateSeries,
} from "@icy/core";
import type { FactorCategory } from "@icy/shared";
import { FACTOR_CATEGORIES } from "@icy/shared";
import cron from "node-cron";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getStorage } from "@/lib/services";

export type ActionResult =
  | {
      ok: true;
      taskId?: string;
      seriesId?: string;
      factorId?: string;
      poseId?: string;
      inserted?: number;
      skipped?: number;
      softDisabled?: boolean;
    }
  | { ok: false; error: string };

function parseFactorIds(formData: FormData): string[] {
  return formData
    .getAll("factorIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function parsePoseIds(formData: FormData): string[] {
  return formData
    .getAll("poseIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function parseCategory(raw: string): FactorCategory {
  if (!(FACTOR_CATEGORIES as readonly string[]).includes(raw)) {
    throw new FactorError(`无效分类: ${raw}`, "validation");
  }
  return raw as FactorCategory;
}

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
    const factorIds = parseFactorIds(formData);
    const poseId = String(formData.get("poseId") ?? "").trim() || undefined;

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
      factorIds,
      poseId,
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
    const factorIds = parseFactorIds(formData);
    const poseIds = parsePoseIds(formData);
    if (scheduleCron && !cron.validate(scheduleCron)) {
      return { ok: false, error: "cron 表达式无效" };
    }

    const row = createSeries(getDb(), {
      characterId,
      name,
      theme,
      scheduleCron: scheduleCron || null,
      batchConfig: { factorIds, perBatch, poseIds },
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

export async function createFactorAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const row = createFactor(getDb(), {
      category: parseCategory(String(formData.get("category") ?? "")),
      name: String(formData.get("name") ?? ""),
      promptFragment: String(formData.get("promptFragment") ?? ""),
      negativeFragment: String(formData.get("negativeFragment") ?? ""),
      enabled: String(formData.get("enabled") ?? "1") !== "0",
    });
    revalidatePath("/generate");
    return { ok: true, factorId: row.id };
  } catch (error) {
    if (error instanceof FactorError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function updateFactorAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const id = String(formData.get("id") ?? "");
    const row = updateFactor(getDb(), id, {
      category: parseCategory(String(formData.get("category") ?? "")),
      name: String(formData.get("name") ?? ""),
      promptFragment: String(formData.get("promptFragment") ?? ""),
      negativeFragment: String(formData.get("negativeFragment") ?? ""),
      enabled: String(formData.get("enabled") ?? "1") !== "0",
    });
    revalidatePath("/generate");
    return { ok: true, factorId: row.id };
  } catch (error) {
    if (error instanceof FactorError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function setFactorEnabledAction(
  factorId: string,
  enabled: boolean,
): Promise<ActionResult> {
  try {
    const row = setFactorEnabled(getDb(), factorId, enabled);
    revalidatePath("/generate");
    return { ok: true, factorId: row.id };
  } catch (error) {
    if (error instanceof FactorError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function deleteFactorAction(factorId: string): Promise<ActionResult> {
  try {
    const before = getFactor(getDb(), factorId);
    if (!before) return { ok: false, error: "因子不存在" };
    const after = deleteFactor(getDb(), factorId);
    const softDisabled = Boolean(getFactor(getDb(), after.id)) && !after.enabled;
    revalidatePath("/generate");
    return { ok: true, factorId: after.id, softDisabled };
  } catch (error) {
    if (error instanceof FactorError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function importFactorPresetsAction(): Promise<ActionResult> {
  try {
    const result = importFactorPresets(getDb());
    revalidatePath("/generate");
    return { ok: true, inserted: result.inserted, skipped: result.skipped };
  } catch (error) {
    if (error instanceof FactorError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function importPosePresetsAction(): Promise<ActionResult> {
  try {
    const result = await importPosePresets(getDb(), getStorage());
    revalidatePath("/generate");
    return { ok: true, inserted: result.inserted, skipped: result.skipped };
  } catch (error) {
    if (error instanceof PoseError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function createPoseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const name = String(formData.get("name") ?? "");
    const tags = String(formData.get("tags") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "请上传骨架图" };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : ".png";
    const id = randomBytes(12).toString("hex");
    const filePath = `poses/${id}${ext}`;
    await getStorage().put(filePath, buf);
    const row = createPose(getDb(), { name, filePath, tags });
    revalidatePath("/generate");
    return { ok: true, poseId: row.id };
  } catch (error) {
    if (error instanceof PoseError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function deletePoseAction(poseId: string): Promise<ActionResult> {
  try {
    deletePose(getDb(), poseId.trim());
    revalidatePath("/generate");
    return { ok: true, poseId };
  } catch (error) {
    if (error instanceof PoseError) return { ok: false, error: error.message };
    throw error;
  }
}
