import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { IcyDb } from "../db/client";
import {
  characters,
  factors,
  generationTasks,
  poses,
  series,
  type SeriesBatchConfig,
} from "../db/schema";

export type CreateSeriesInput = {
  characterId: string;
  name: string;
  theme?: string;
  batchConfig?: SeriesBatchConfig | null;
  scheduleCron?: string | null;
  active?: boolean;
};

export type UpdateSeriesInput = Partial<CreateSeriesInput>;

export class SeriesError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "not_found" | "conflict",
  ) {
    super(message);
    this.name = "SeriesError";
  }
}

function normalizeIds(ids: string[], label: string): string[] {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new SeriesError(`${label} id 不能为空`, "validation");
  }
  return [...new Set(ids.map((id) => id.trim()))];
}

function assertReferences(
  db: IcyDb,
  table: typeof factors | typeof poses,
  ids: string[],
  label: string,
): void {
  if (ids.length === 0) return;
  const found = db.select({ id: table.id }).from(table).where(inArray(table.id, ids)).all();
  if (found.length !== ids.length) {
    throw new SeriesError(`${label}包含不存在的引用`, "validation");
  }
}

function normalizeBatchConfig(
  db: IcyDb,
  config: SeriesBatchConfig | null | undefined,
): SeriesBatchConfig | null {
  if (config == null) return null;
  if (!Number.isInteger(config.perBatch) || config.perBatch < 1 || config.perBatch > 24) {
    throw new SeriesError("每批数量须为 1–24 的整数", "validation");
  }

  const factorIds = normalizeIds(config.factorIds, "因子");
  const poseIds = config.poseIds === undefined ? undefined : normalizeIds(config.poseIds, "姿势");
  assertReferences(db, factors, factorIds, "因子池");
  assertReferences(db, poses, poseIds ?? [], "姿势池");
  return {
    factorIds,
    perBatch: config.perBatch,
    ...(poseIds === undefined ? {} : { poseIds }),
  };
}

function normalizeCron(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cron = value.trim();
  if (!cron) throw new SeriesError("cron 表达式不能为空", "validation");
  return cron;
}

function requireCharacter(db: IcyDb, characterId: string) {
  const id = characterId.trim();
  if (!id) throw new SeriesError("须指定角色", "validation");
  const character = db.select().from(characters).where(eq(characters.id, id)).get();
  if (!character) throw new SeriesError("角色不存在", "not_found");
  return id;
}

export function createSeries(db: IcyDb, input: CreateSeriesInput) {
  const characterId = requireCharacter(db, input.characterId);
  const name = input.name.trim();
  if (!name) throw new SeriesError("系列名称不能为空", "validation");

  const id = nanoid();
  db.insert(series)
    .values({
      id,
      characterId,
      name,
      theme: input.theme?.trim() ?? "",
      batchConfig: normalizeBatchConfig(db, input.batchConfig),
      scheduleCron: normalizeCron(input.scheduleCron),
      active: input.active ?? true,
    })
    .run();
  return getSeries(db, id)!;
}

export function getSeries(db: IcyDb, id: string) {
  return db.select().from(series).where(eq(series.id, id)).get() ?? null;
}

export function listSeries(
  db: IcyDb,
  opts: { characterId?: string; active?: boolean } = {},
) {
  const filters = [];
  if (opts.characterId?.trim()) filters.push(eq(series.characterId, opts.characterId.trim()));
  if (opts.active !== undefined) filters.push(eq(series.active, opts.active));
  const query = db.select().from(series);
  return (filters.length ? query.where(and(...filters)) : query)
    .orderBy(desc(series.updatedAt))
    .all();
}

export function updateSeries(db: IcyDb, id: string, input: UpdateSeriesInput) {
  const row = getSeries(db, id);
  if (!row) throw new SeriesError("系列不存在", "not_found");

  const patch: Partial<typeof series.$inferInsert> = { updatedAt: new Date() };
  if (input.characterId !== undefined) {
    patch.characterId = requireCharacter(db, input.characterId);
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new SeriesError("系列名称不能为空", "validation");
    patch.name = name;
  }
  if (input.theme !== undefined) patch.theme = input.theme.trim();
  if (input.batchConfig !== undefined) {
    patch.batchConfig = normalizeBatchConfig(db, input.batchConfig);
  }
  if (input.scheduleCron !== undefined) {
    patch.scheduleCron = normalizeCron(input.scheduleCron);
  }
  if (input.active !== undefined) patch.active = input.active;

  db.update(series).set(patch).where(eq(series.id, id)).run();
  return getSeries(db, id)!;
}

export function deleteSeries(db: IcyDb, id: string) {
  const row = getSeries(db, id);
  if (!row) throw new SeriesError("系列不存在", "not_found");
  const task = db
    .select({ id: generationTasks.id })
    .from(generationTasks)
    .where(eq(generationTasks.seriesId, id))
    .limit(1)
    .get();
  if (task) throw new SeriesError("系列已有生成任务，不能删除", "conflict");
  db.delete(series).where(eq(series.id, id)).run();
  return row;
}
