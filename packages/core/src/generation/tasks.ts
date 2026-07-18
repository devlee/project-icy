import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { TaskStatus, TaskType } from "@icy/shared";
import { TASK_STATUSES, TASK_TYPES } from "@icy/shared";
import type { IcyDb } from "../db/client";
import {
  characters,
  factors,
  generationTasks,
  poses,
  series,
  type GenerationParams,
} from "../db/schema";
import { mergeCharacterDefaultFactors } from "../characters/factor-bindings";
import { assertFactorIds, FactorError } from "../factors/factors";
import { assertPoseIds, PoseError } from "../poses/poses";
import { getWorkflowById, defaultWorkflowRegistry } from "../workflows/default-registry";
import { expandSeeds } from "./seeds";

export type GenerationTaskListItem = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  characterId: string;
  characterName: string;
  priority: number;
  error: string | null;
  params: GenerationParams;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

export type CreateSingleTaskInput = {
  characterId: string;
  seedStrategy: GenerationParams["seedStrategy"];
  animeWorkflowId?: string;
  extraPrompt?: string;
  priority?: number;
};

export type CreatePairTaskInput = {
  characterId: string;
  seedStrategy: GenerationParams["seedStrategy"];
  /** Defaults to `default-pair` registry entry. */
  pairConfigId?: string;
  animeWorkflowId?: string;
  realWorkflowId?: string;
  extraPrompt?: string;
  /** Enabled factors to inject; disabled ids are rejected. */
  factorIds?: string[];
  /** Optional ControlNet skeleton pose. */
  poseId?: string;
  priority?: number;
};

export type CreateBatchTaskInput = {
  seriesId: string;
  /** Defaults to `default-pair` registry entry. */
  pairConfigId?: string;
  animeWorkflowId?: string;
  realWorkflowId?: string;
  extraPrompt?: string;
};

export class GenerationTaskError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "not_found" | "conflict",
  ) {
    super(message);
    this.name = "GenerationTaskError";
  }
}

function assertTaskStatus(status: string): asserts status is TaskStatus {
  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    throw new GenerationTaskError(`无效任务状态: ${status}`, "validation");
  }
}

function assertTaskType(type: string): asserts type is TaskType {
  if (!(TASK_TYPES as readonly string[]).includes(type)) {
    throw new GenerationTaskError(`无效任务类型: ${type}`, "validation");
  }
}

function normalizeSeedStrategy(
  strategy: GenerationParams["seedStrategy"],
): GenerationParams["seedStrategy"] {
  if (strategy.kind === "fixed") {
    if (!Number.isFinite(strategy.seed)) {
      throw new GenerationTaskError("固定 seed 无效", "validation");
    }
    return { kind: "fixed", seed: Math.trunc(strategy.seed) };
  }
  const count = Math.trunc(strategy.count);
  if (!Number.isFinite(count) || count < 1 || count > 24) {
    throw new GenerationTaskError("随机数量须在 1–24", "validation");
  }
  return { kind: "random", count };
}

export function createSingleGenerationTask(db: IcyDb, input: CreateSingleTaskInput) {
  const characterId = input.characterId.trim();
  if (!characterId) throw new GenerationTaskError("须选择角色", "validation");

  const character = db.select().from(characters).where(eq(characters.id, characterId)).get();
  if (!character) throw new GenerationTaskError("角色不存在", "not_found");

  const animeWorkflowId = input.animeWorkflowId?.trim() || "anime-txt2img-stub";
  if (!getWorkflowById(defaultWorkflowRegistry, animeWorkflowId)) {
    throw new GenerationTaskError(`未知 workflow: ${animeWorkflowId}`, "validation");
  }

  const seedStrategy = normalizeSeedStrategy(input.seedStrategy);
  const params: GenerationParams = {
    seedStrategy,
    seeds: expandSeeds(seedStrategy),
    factorIds: [],
    animeWorkflowId,
    realWorkflowId: "",
    extraPrompt: input.extraPrompt?.trim() || undefined,
  };

  const id = nanoid();
  const priority = input.priority ?? 10;
  db.insert(generationTasks)
    .values({
      id,
      type: "single",
      status: "queued",
      characterId,
      params,
      priority,
    })
    .run();

  return getGenerationTask(db, id)!;
}

export function createPairGenerationTask(db: IcyDb, input: CreatePairTaskInput) {
  const characterId = input.characterId.trim();
  if (!characterId) throw new GenerationTaskError("须选择角色", "validation");

  const character = db.select().from(characters).where(eq(characters.id, characterId)).get();
  if (!character) throw new GenerationTaskError("角色不存在", "not_found");

  const pairConfigId = input.pairConfigId?.trim() || "default-pair";
  const pairConfig = defaultWorkflowRegistry.pairConfigs.find((c) => c.id === pairConfigId);
  if (!pairConfig) {
    throw new GenerationTaskError(`未知 pairConfig: ${pairConfigId}`, "validation");
  }

  const animeWorkflowId = input.animeWorkflowId?.trim() || pairConfig.animeWorkflowId;
  const realWorkflowId = input.realWorkflowId?.trim() || pairConfig.realWorkflowId;
  if (!getWorkflowById(defaultWorkflowRegistry, animeWorkflowId)) {
    throw new GenerationTaskError(`未知 anime workflow: ${animeWorkflowId}`, "validation");
  }
  if (!getWorkflowById(defaultWorkflowRegistry, realWorkflowId)) {
    throw new GenerationTaskError(`未知 real workflow: ${realWorkflowId}`, "validation");
  }

  const seedStrategy = normalizeSeedStrategy(input.seedStrategy);
  let factorIds: string[] = [];
  try {
    const explicit = assertFactorIds(db, input.factorIds ?? [], { requireEnabled: true });
    factorIds = assertFactorIds(
      db,
      mergeCharacterDefaultFactors(db, characterId, explicit),
      { requireEnabled: true },
    );
  } catch (error) {
    if (error instanceof FactorError) {
      throw new GenerationTaskError(error.message, "validation");
    }
    throw error;
  }

  let poseId: string | undefined;
  if (input.poseId?.trim()) {
    try {
      poseId = assertPoseIds(db, [input.poseId.trim()])[0];
    } catch (error) {
      if (error instanceof PoseError) {
        throw new GenerationTaskError(error.message, "validation");
      }
      throw error;
    }
  }

  const params: GenerationParams = {
    seedStrategy,
    seeds: expandSeeds(seedStrategy),
    factorIds,
    ...(poseId ? { poseId } : {}),
    animeWorkflowId,
    realWorkflowId,
    extraPrompt: input.extraPrompt?.trim() || undefined,
  };

  const id = nanoid();
  const priority = input.priority ?? 10;
  db.insert(generationTasks)
    .values({
      id,
      type: "pair",
      status: "queued",
      characterId,
      params,
      priority,
    })
    .run();

  return getGenerationTask(db, id)!;
}

export function createBatchGenerationTask(db: IcyDb, input: CreateBatchTaskInput) {
  const seriesId = input.seriesId.trim();
  if (!seriesId) throw new GenerationTaskError("须指定系列", "validation");
  const seriesRow = db.select().from(series).where(eq(series.id, seriesId)).get();
  if (!seriesRow) throw new GenerationTaskError("系列不存在", "not_found");
  if (!seriesRow.active) throw new GenerationTaskError("系列已停用", "conflict");
  const config = seriesRow.batchConfig;
  if (!config) throw new GenerationTaskError("系列未配置批次参数", "validation");
  if (!Number.isInteger(config.perBatch) || config.perBatch < 1 || config.perBatch > 24) {
    throw new GenerationTaskError("每批数量须为 1–24 的整数", "validation");
  }

  const factorIds = [...new Set(config.factorIds)];
  if (factorIds.length > 0) {
    const found = db
      .select({ id: factors.id })
      .from(factors)
      .where(inArray(factors.id, factorIds))
      .all();
    if (found.length !== factorIds.length) {
      throw new GenerationTaskError("系列包含不存在的因子", "validation");
    }
  }

  const poseIds = [...new Set(config.poseIds ?? [])];
  if (poseIds.length > 0) {
    const found = db
      .select({ id: poses.id })
      .from(poses)
      .where(inArray(poses.id, poseIds))
      .all();
    if (found.length !== poseIds.length) {
      throw new GenerationTaskError("系列包含不存在的姿势", "validation");
    }
  }

  const pairConfigId = input.pairConfigId?.trim() || "default-pair";
  const pairConfig = defaultWorkflowRegistry.pairConfigs.find((c) => c.id === pairConfigId);
  if (!pairConfig) {
    throw new GenerationTaskError(`未知 pairConfig: ${pairConfigId}`, "validation");
  }
  const animeWorkflowId = input.animeWorkflowId?.trim() || pairConfig.animeWorkflowId;
  const realWorkflowId = input.realWorkflowId?.trim() || pairConfig.realWorkflowId;
  if (!getWorkflowById(defaultWorkflowRegistry, animeWorkflowId)) {
    throw new GenerationTaskError(`未知 anime workflow: ${animeWorkflowId}`, "validation");
  }
  if (!getWorkflowById(defaultWorkflowRegistry, realWorkflowId)) {
    throw new GenerationTaskError(`未知 real workflow: ${realWorkflowId}`, "validation");
  }

  const poseId =
    poseIds.length > 0
      ? poseIds[Math.floor(Math.random() * poseIds.length)]
      : undefined;
  const params: GenerationParams = {
    seedStrategy: { kind: "random", count: config.perBatch },
    seeds: expandSeeds({ kind: "random", count: config.perBatch }),
    factorIds,
    ...(poseId ? { poseId } : {}),
    animeWorkflowId,
    realWorkflowId,
    extraPrompt: input.extraPrompt?.trim() || seriesRow.theme.trim() || undefined,
  };

  const id = nanoid();
  db.insert(generationTasks)
    .values({
      id,
      type: "batch",
      status: "queued",
      characterId: seriesRow.characterId,
      seriesId,
      params,
      priority: 0,
    })
    .run();
  return getGenerationTask(db, id)!;
}

export function getGenerationTask(db: IcyDb, id: string) {
  return db.select().from(generationTasks).where(eq(generationTasks.id, id)).get() ?? null;
}

export function listGenerationTasks(
  db: IcyDb,
  opts: { limit?: number } = {},
): GenerationTaskListItem[] {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 40));
  const rows = db
    .select({
      id: generationTasks.id,
      type: generationTasks.type,
      status: generationTasks.status,
      characterId: generationTasks.characterId,
      characterName: characters.name,
      priority: generationTasks.priority,
      error: generationTasks.error,
      params: generationTasks.params,
      startedAt: generationTasks.startedAt,
      finishedAt: generationTasks.finishedAt,
      createdAt: generationTasks.createdAt,
    })
    .from(generationTasks)
    .innerJoin(characters, eq(generationTasks.characterId, characters.id))
    .orderBy(desc(generationTasks.createdAt))
    .limit(limit)
    .all();

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    characterId: r.characterId,
    characterName: r.characterName,
    priority: r.priority,
    error: r.error,
    params: r.params,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    createdAt: r.createdAt,
  }));
}

/** Queue-facing read ordered by interactive priority, then FIFO. */
export function listQueuedGenerationTasks(
  db: IcyDb,
  opts: { limit?: number } = {},
) {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  return db
    .select()
    .from(generationTasks)
    .where(eq(generationTasks.status, "queued"))
    .orderBy(desc(generationTasks.priority), asc(generationTasks.createdAt))
    .limit(limit)
    .all();
}

/**
 * A process restart cannot safely resume an in-flight Comfy task. Mark stale
 * `running` rows failed so the operator can explicitly retry them while queued
 * work remains recoverable.
 */
export function failInterruptedGenerationTasks(
  db: IcyDb,
  message = "worker 已重启；上次运行状态未知，请确认后重试",
): string[] {
  const rows = db
    .select({ id: generationTasks.id })
    .from(generationTasks)
    .where(eq(generationTasks.status, "running"))
    .all();
  if (rows.length === 0) return [];

  db.update(generationTasks)
    .set({ status: "failed", error: message, finishedAt: new Date() })
    .where(eq(generationTasks.status, "running"))
    .run();
  return rows.map((row) => row.id);
}

export function hasActiveBatchTaskForSeries(db: IcyDb, seriesId: string): boolean {
  return Boolean(
    db
      .select({ id: generationTasks.id })
      .from(generationTasks)
      .where(
        and(
          eq(generationTasks.seriesId, seriesId),
          eq(generationTasks.type, "batch"),
          inArray(generationTasks.status, ["queued", "running"]),
        ),
      )
      .limit(1)
      .get(),
  );
}

export function markTaskRunning(db: IcyDb, id: string) {
  const row = getGenerationTask(db, id);
  if (!row) throw new GenerationTaskError("任务不存在", "not_found");
  if (row.status === "cancelled") {
    throw new GenerationTaskError("任务已取消", "conflict");
  }
  if (row.status !== "queued") {
    throw new GenerationTaskError(`任务状态不可开始: ${row.status}`, "conflict");
  }
  db.update(generationTasks)
    .set({ status: "running", startedAt: new Date(), error: null })
    .where(eq(generationTasks.id, id))
    .run();
  return getGenerationTask(db, id)!;
}

export function markTaskDone(db: IcyDb, id: string, outputKeys: string[]) {
  const row = getGenerationTask(db, id);
  if (!row) throw new GenerationTaskError("任务不存在", "not_found");
  db.update(generationTasks)
    .set({
      status: "done",
      finishedAt: new Date(),
      error: null,
      params: { ...row.params, outputKeys },
    })
    .where(eq(generationTasks.id, id))
    .run();
  return getGenerationTask(db, id)!;
}

export function markTaskFailed(db: IcyDb, id: string, error: string, outputKeys?: string[]) {
  const row = getGenerationTask(db, id);
  if (!row) throw new GenerationTaskError("任务不存在", "not_found");
  db.update(generationTasks)
    .set({
      status: "failed",
      finishedAt: new Date(),
      error,
      params: outputKeys ? { ...row.params, outputKeys } : row.params,
    })
    .where(eq(generationTasks.id, id))
    .run();
  return getGenerationTask(db, id)!;
}

export function cancelGenerationTask(db: IcyDb, id: string) {
  const row = getGenerationTask(db, id);
  if (!row) throw new GenerationTaskError("任务不存在", "not_found");
  if (row.status !== "queued") {
    throw new GenerationTaskError("仅排队中的任务可取消", "conflict");
  }
  assertTaskStatus("cancelled");
  assertTaskType(row.type);
  db.update(generationTasks)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(eq(generationTasks.id, id))
    .run();
  return getGenerationTask(db, id)!;
}

/**
 * Re-queue a failed (or cancelled) task with the same params.
 * Clears error / timestamps / prior outputKeys, then caller should enqueue.
 */
export function retryGenerationTask(db: IcyDb, id: string) {
  const row = getGenerationTask(db, id);
  if (!row) throw new GenerationTaskError("任务不存在", "not_found");
  if (row.status !== "failed" && row.status !== "cancelled") {
    throw new GenerationTaskError("仅失败或已取消的任务可重试", "conflict");
  }

  const { outputKeys: _dropped, ...rest } = row.params;
  db.update(generationTasks)
    .set({
      status: "queued",
      error: null,
      startedAt: null,
      finishedAt: null,
      params: rest,
    })
    .where(eq(generationTasks.id, id))
    .run();
  return getGenerationTask(db, id)!;
}
