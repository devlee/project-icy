import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { TaskStatus, TaskType } from "@icy/shared";
import { TASK_STATUSES, TASK_TYPES } from "@icy/shared";
import type { IcyDb } from "../db/client";
import {
  characters,
  generationTasks,
  type GenerationParams,
} from "../db/schema";
import { getWorkflowById, defaultWorkflowRegistry } from "../workflows/default-registry";

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
  priority?: number;
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
  const params: GenerationParams = {
    seedStrategy,
    factorIds: [],
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
