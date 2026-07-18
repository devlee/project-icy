import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ReviewStatus } from "@icy/shared";
import { REVIEW_STATUSES } from "@icy/shared";
import type { IcyDb } from "../db/client";
import { characters, generationTasks, pairSets } from "../db/schema";

export type PairSetListItem = {
  id: string;
  taskId: string;
  characterId: string;
  characterName: string;
  seed: number;
  animeImagePath: string;
  realImagePath: string;
  reviewStatus: ReviewStatus;
  rating: number | null;
  createdAt: Date;
};

export type CreatePairSetInput = {
  taskId: string;
  characterId: string;
  seed: number;
  animeImagePath: string;
  realImagePath: string;
  seriesId?: string | null;
  poseId?: string | null;
};

export type ReviewPairSetInput = {
  status?: ReviewStatus;
  /** 1–5, or null to clear. */
  rating?: number | null;
};

export type ReviewStats = {
  byStatus: Record<ReviewStatus, number>;
  total: number;
  reviewed: number;
  /** Counts for ratings 1–5 among rows that have a rating. */
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  ratedTotal: number;
};

export class PairSetError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "not_found",
  ) {
    super(message);
    this.name = "PairSetError";
  }
}

export function createPairSet(db: IcyDb, input: CreatePairSetInput) {
  const taskId = input.taskId.trim();
  const characterId = input.characterId.trim();
  const animeImagePath = input.animeImagePath.trim();
  const realImagePath = input.realImagePath.trim();

  if (!taskId) throw new PairSetError("须指定任务", "validation");
  if (!characterId) throw new PairSetError("须指定角色", "validation");
  if (!animeImagePath || !realImagePath) {
    throw new PairSetError("成对图路径不能为空", "validation");
  }
  if (!Number.isFinite(input.seed)) {
    throw new PairSetError("seed 无效", "validation");
  }

  const task = db.select().from(generationTasks).where(eq(generationTasks.id, taskId)).get();
  if (!task) throw new PairSetError("任务不存在", "not_found");

  const character = db.select().from(characters).where(eq(characters.id, characterId)).get();
  if (!character) throw new PairSetError("角色不存在", "not_found");

  const id = nanoid();
  db.insert(pairSets)
    .values({
      id,
      taskId,
      characterId,
      seriesId: input.seriesId ?? null,
      seed: Math.trunc(input.seed),
      poseId: input.poseId ?? null,
      animeImagePath,
      realImagePath,
      reviewStatus: "pending",
      postProcessStatus: "raw",
    })
    .run();

  return getPairSet(db, id)!;
}

export function getPairSet(db: IcyDb, id: string) {
  return db.select().from(pairSets).where(eq(pairSets.id, id)).get() ?? null;
}

export function listPairSets(
  db: IcyDb,
  opts: {
    limit?: number;
    reviewStatus?: ReviewStatus;
    characterId?: string;
  } = {},
): PairSetListItem[] {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 40));
  if (
    opts.reviewStatus !== undefined &&
    !(REVIEW_STATUSES as readonly string[]).includes(opts.reviewStatus)
  ) {
    throw new PairSetError(`无效筛选状态: ${opts.reviewStatus}`, "validation");
  }

  const filters = [];
  if (opts.reviewStatus !== undefined) {
    filters.push(eq(pairSets.reviewStatus, opts.reviewStatus));
  }
  if (opts.characterId?.trim()) {
    filters.push(eq(pairSets.characterId, opts.characterId.trim()));
  }

  const query = db
    .select({
      id: pairSets.id,
      taskId: pairSets.taskId,
      characterId: pairSets.characterId,
      characterName: characters.name,
      seed: pairSets.seed,
      animeImagePath: pairSets.animeImagePath,
      realImagePath: pairSets.realImagePath,
      reviewStatus: pairSets.reviewStatus,
      rating: pairSets.rating,
      createdAt: pairSets.createdAt,
    })
    .from(pairSets)
    .innerJoin(characters, eq(pairSets.characterId, characters.id));

  const rows = (
    filters.length > 0 ? query.where(and(...filters)) : query
  )
    .orderBy(desc(pairSets.createdAt))
    .limit(limit)
    .all();

  return rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    characterId: r.characterId,
    characterName: r.characterName,
    seed: r.seed,
    animeImagePath: r.animeImagePath,
    realImagePath: r.realImagePath,
    reviewStatus: r.reviewStatus,
    rating: r.rating,
    createdAt: r.createdAt,
  }));
}

/**
 * Update review status and/or rating. Does not delete image files.
 * Setting status to approved/rejected/hold stamps reviewedAt.
 */
export function reviewPairSet(db: IcyDb, id: string, input: ReviewPairSetInput) {
  const row = getPairSet(db, id);
  if (!row) throw new PairSetError("PairSet 不存在", "not_found");
  if (input.status === undefined && input.rating === undefined) {
    throw new PairSetError("须指定 status 或 rating", "validation");
  }

  const patch: {
    reviewStatus?: ReviewStatus;
    rating?: number | null;
    reviewedAt?: Date;
  } = {};

  if (input.status !== undefined) {
    if (!(REVIEW_STATUSES as readonly string[]).includes(input.status)) {
      throw new PairSetError(`无效状态: ${input.status}`, "validation");
    }
    patch.reviewStatus = input.status;
    if (input.status === "approved" || input.status === "rejected" || input.status === "hold") {
      patch.reviewedAt = new Date();
    }
  }

  if (input.rating !== undefined) {
    if (input.rating === null) {
      patch.rating = null;
    } else {
      const r = Math.trunc(input.rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) {
        throw new PairSetError("评分须为 1–5", "validation");
      }
      patch.rating = r;
    }
  }

  db.update(pairSets).set(patch).where(eq(pairSets.id, id)).run();
  return getPairSet(db, id)!;
}

export function getReviewStats(db: IcyDb): ReviewStats {
  const byStatus: Record<ReviewStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    hold: 0,
  };

  const statusRows = db
    .select({
      status: pairSets.reviewStatus,
      n: count(),
    })
    .from(pairSets)
    .groupBy(pairSets.reviewStatus)
    .all();

  for (const row of statusRows) {
    if ((REVIEW_STATUSES as readonly string[]).includes(row.status)) {
      byStatus[row.status as ReviewStatus] = row.n;
    }
  }

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const reviewed = byStatus.approved + byStatus.rejected + byStatus.hold;

  const ratingCounts: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  const ratingRows = db
    .select({
      rating: pairSets.rating,
      n: count(),
    })
    .from(pairSets)
    .where(isNotNull(pairSets.rating))
    .groupBy(pairSets.rating)
    .all();

  let ratedTotal = 0;
  for (const row of ratingRows) {
    const r = row.rating;
    if (r === 1 || r === 2 || r === 3 || r === 4 || r === 5) {
      ratingCounts[r] = row.n;
      ratedTotal += row.n;
    }
  }

  return { byStatus, total, reviewed, ratingCounts, ratedTotal };
}
