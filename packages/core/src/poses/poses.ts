import { asc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { IcyDb } from "../db/client";
import { poses, series } from "../db/schema";
import type { StorageAdapter } from "../ports/storage";

export type PoseListItem = {
  id: string;
  name: string;
  filePath: string;
  tags: string;
  createdAt: Date;
};

export type CreatePoseInput = {
  name: string;
  filePath: string;
  tags?: string;
};

export type UpdatePoseInput = {
  name?: string;
  filePath?: string;
  tags?: string;
};

export class PoseError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "not_found" | "conflict",
  ) {
    super(message);
    this.name = "PoseError";
  }
}

function toListItem(row: typeof poses.$inferSelect): PoseListItem {
  return {
    id: row.id,
    name: row.name,
    filePath: row.filePath,
    tags: row.tags,
    createdAt: row.createdAt,
  };
}

function seriesReferencesPose(db: IcyDb, poseId: string): boolean {
  const rows = db.select({ batchConfig: series.batchConfig }).from(series).all();
  return rows.some((row) => row.batchConfig?.poseIds?.includes(poseId));
}

export function getPose(db: IcyDb, id: string): PoseListItem | null {
  const row = db.select().from(poses).where(eq(poses.id, id)).get();
  return row ? toListItem(row) : null;
}

export function listPoses(db: IcyDb, opts: { search?: string } = {}): PoseListItem[] {
  let rows = db.select().from(poses).orderBy(asc(poses.name)).all();
  const search = opts.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(search) ||
        row.tags.toLowerCase().includes(search),
    );
  }
  return rows.map(toListItem);
}

export function createPose(db: IcyDb, input: CreatePoseInput): PoseListItem {
  const name = input.name.trim();
  if (!name) throw new PoseError("名称不能为空", "validation");
  const filePath = input.filePath.trim();
  if (!filePath) throw new PoseError("须指定骨架图路径", "validation");

  const id = nanoid();
  db.insert(poses)
    .values({
      id,
      name,
      filePath,
      tags: input.tags?.trim() ?? "",
    })
    .run();
  return getPose(db, id)!;
}

export function updatePose(db: IcyDb, id: string, input: UpdatePoseInput): PoseListItem {
  const row = db.select().from(poses).where(eq(poses.id, id)).get();
  if (!row) throw new PoseError("姿势不存在", "not_found");

  const patch: Partial<typeof poses.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new PoseError("名称不能为空", "validation");
    patch.name = name;
  }
  if (input.filePath !== undefined) {
    const filePath = input.filePath.trim();
    if (!filePath) throw new PoseError("须指定骨架图路径", "validation");
    patch.filePath = filePath;
  }
  if (input.tags !== undefined) patch.tags = input.tags.trim();

  if (Object.keys(patch).length === 0) return toListItem(row);
  db.update(poses).set(patch).where(eq(poses.id, id)).run();
  return getPose(db, id)!;
}

/** Hard-delete unless referenced by a series pose pool (then conflict). */
export function deletePose(db: IcyDb, id: string): void {
  const row = getPose(db, id);
  if (!row) throw new PoseError("姿势不存在", "not_found");
  if (seriesReferencesPose(db, id)) {
    throw new PoseError("姿势仍被系列姿势池引用，请先从系列移除", "conflict");
  }
  db.delete(poses).where(eq(poses.id, id)).run();
}

export function assertPoseIds(db: IcyDb, poseIds: string[]): string[] {
  if (!Array.isArray(poseIds) || poseIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new PoseError("姿势 id 无效", "validation");
  }
  const ids = [...new Set(poseIds.map((id) => id.trim()))];
  if (ids.length === 0) return [];
  const found = db.select({ id: poses.id }).from(poses).where(inArray(poses.id, ids)).all();
  if (found.length !== ids.length) {
    throw new PoseError("包含不存在的姿势", "validation");
  }
  return ids;
}

export function resolvePoseNames(db: IcyDb, poseIds: string[]): string[] {
  const ids = [...new Set(poseIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = db
    .select({ id: poses.id, name: poses.name })
    .from(poses)
    .where(inArray(poses.id, ids))
    .all();
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => nameById.get(id)).filter((n): n is string => Boolean(n));
}

/** 1×1 PNG — placeholder until user replaces with real OpenPose skeletons. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export const POSE_PRESET_NAMES = [
  { name: "站立正面", tags: "standing front" },
  { name: "站立侧面", tags: "standing side" },
  { name: "行走", tags: "walk" },
  { name: "坐下", tags: "sit" },
  { name: "蹲姿", tags: "squat" },
  { name: "举手", tags: "hands up" },
  { name: "叉腰", tags: "hands on hips" },
  { name: "回头", tags: "looking back" },
  { name: "倚靠", tags: "lean" },
  { name: "跪姿", tags: "kneel" },
  { name: "躺姿", tags: "lie" },
  { name: "跳跃", tags: "jump" },
  { name: "挥手", tags: "wave" },
  { name: "抱臂", tags: "crossed arms" },
  { name: "指点", tags: "point" },
  { name: "捧脸", tags: "hands on face" },
  { name: "跑姿", tags: "run" },
  { name: "鞠躬", tags: "bow" },
  { name: "坐地", tags: "sit floor" },
  { name: "侧躺", tags: "side lie" },
] as const;

/**
 * Seed up to 20 placeholder poses (tiny PNG). Replace filePath images with real
 * OpenPose skeletons for production quality.
 */
export async function importPosePresets(
  db: IcyDb,
  storage: StorageAdapter,
): Promise<{ inserted: number; skipped: number }> {
  const existing = new Set(listPoses(db).map((p) => p.name));
  let inserted = 0;
  let skipped = 0;
  for (const preset of POSE_PRESET_NAMES) {
    if (existing.has(preset.name)) {
      skipped += 1;
      continue;
    }
    const id = nanoid();
    const filePath = `poses/presets/${id}.png`;
    await storage.put(filePath, TINY_PNG);
    createPose(db, { name: preset.name, filePath, tags: preset.tags });
    existing.add(preset.name);
    inserted += 1;
  }
  return { inserted, skipped };
}
