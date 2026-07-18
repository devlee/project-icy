import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  notExists,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Platform, PublishStatus } from "@icy/shared";
import { PLATFORMS, PUBLISH_STATUSES } from "@icy/shared";
import type { IcyDb } from "../db/client";
import {
  assets,
  characters,
  pairSets,
  publishPlanAssets,
  publishPlans,
} from "../db/schema";
import { listAssetsByPairSet } from "../post/assets";

export type PlanAssetSummary = {
  id: string;
  filePath: string;
  platform: Platform;
  kind: string;
  width: number;
  height: number;
};

export type PublishPlanListItem = {
  id: string;
  date: string;
  platform: Platform;
  status: PublishStatus;
  caption: string;
  hashtags: string;
  notes: string;
  publishedAt: Date | null;
  createdAt: Date;
  assets: PlanAssetSummary[];
};

export type CreatePublishPlanInput = {
  date: string;
  platform: Platform;
  caption?: string;
  hashtags?: string;
  assetIds: string[];
};

export type UpdatePublishPlanInput = {
  caption?: string;
  hashtags?: string;
  notes?: string;
  status?: PublishStatus;
  date?: string;
};

export type InventoryPack = {
  id: string;
  characterId: string;
  characterName: string;
  seed: number;
  rating: number | null;
  animeImagePath: string;
  realImagePath: string;
  assetCount: number;
  createdAt: Date;
};

export type InventoryStats = {
  readyPacks: number;
  dailyBurn: number;
  days: number;
};

export class PublishPlanError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "not_found" | "conflict",
  ) {
    super(message);
    this.name = "PublishPlanError";
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(date: string) {
  if (!DATE_RE.test(date)) {
    throw new PublishPlanError("日期须为 YYYY-MM-DD", "validation");
  }
}

function assertPlatform(platform: string): asserts platform is Platform {
  if (!(PLATFORMS as readonly string[]).includes(platform)) {
    throw new PublishPlanError(`无效平台: ${platform}`, "validation");
  }
}

function assertStatus(status: string): asserts status is PublishStatus {
  if (!(PUBLISH_STATUSES as readonly string[]).includes(status)) {
    throw new PublishPlanError(`无效状态: ${status}`, "validation");
  }
}

function assertAssetsPublishable(db: IcyDb, assetIds: string[]) {
  const rows = db
    .select({
      id: assets.id,
      origin: characters.origin,
      reviewStatus: pairSets.reviewStatus,
      postProcessStatus: pairSets.postProcessStatus,
    })
    .from(assets)
    .innerJoin(pairSets, eq(assets.pairSetId, pairSets.id))
    .innerJoin(characters, eq(pairSets.characterId, characters.id))
    .where(inArray(assets.id, assetIds))
    .all();

  if (rows.length !== assetIds.length) {
    throw new PublishPlanError("存在无效素材 id", "validation");
  }
  if (rows.some((row) => row.origin !== "original")) {
    throw new PublishPlanError(
      "IP 参考内容仅限研究，不可加入发布计划",
      "conflict",
    );
  }
  if (
    rows.some(
      (row) =>
        row.reviewStatus !== "approved" || row.postProcessStatus !== "composed",
    )
  ) {
    throw new PublishPlanError(
      "仅已通过并完成后期的内容可加入发布计划",
      "conflict",
    );
  }
}

function isUnscheduledPack(db: IcyDb) {
  return notExists(
    db
      .select({ planId: publishPlanAssets.planId })
      .from(publishPlanAssets)
      .innerJoin(assets, eq(publishPlanAssets.assetId, assets.id))
      .where(eq(assets.pairSetId, pairSets.id)),
  );
}

function assertPlanPublishable(db: IcyDb, planId: string) {
  const rows = db
    .select({ assetId: publishPlanAssets.assetId })
    .from(publishPlanAssets)
    .where(eq(publishPlanAssets.planId, planId))
    .all();
  assertAssetsPublishable(
    db,
    rows.map((row) => row.assetId),
  );
}

/** Local calendar date YYYY-MM-DD. */
export function todayLocalDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Pick assets for a platform from a composed PairSet:
 * platform-sized matching platform first, else composite, else all.
 */
export function pickAssetsForPlatform(
  db: IcyDb,
  pairSetId: string,
  platform: Platform,
): string[] {
  const pair = db
    .select({ origin: characters.origin })
    .from(pairSets)
    .innerJoin(characters, eq(pairSets.characterId, characters.id))
    .where(eq(pairSets.id, pairSetId))
    .get();
  if (!pair) throw new PublishPlanError("PairSet 不存在", "not_found");
  if (pair.origin !== "original") {
    throw new PublishPlanError(
      "IP 参考内容仅限研究，不可加入发布计划",
      "conflict",
    );
  }

  const list = listAssetsByPairSet(db, pairSetId);
  const sized = list.filter(
    (a) => a.kind === "platform-sized" && a.platform === platform,
  );
  if (sized.length) return sized.map((a) => a.id);
  const composite = list.filter((a) => a.kind === "composite");
  if (composite.length) return composite.map((a) => a.id);
  return list.map((a) => a.id);
}

export function createPublishPlan(db: IcyDb, input: CreatePublishPlanInput) {
  assertDate(input.date);
  assertPlatform(input.platform);

  const assetIds = [...new Set(input.assetIds.map((id) => id.trim()).filter(Boolean))];
  if (assetIds.length === 0) {
    throw new PublishPlanError("须至少绑定一个素材", "validation");
  }

  assertAssetsPublishable(db, assetIds);

  const id = nanoid();
  const status: PublishStatus = "ready";
  db.insert(publishPlans)
    .values({
      id,
      date: input.date,
      platform: input.platform,
      status,
      caption: input.caption?.trim() ?? "",
      hashtags: input.hashtags?.trim() ?? "",
      notes: "",
    })
    .run();

  assetIds.forEach((assetId, i) => {
    db.insert(publishPlanAssets)
      .values({ planId: id, assetId, sortOrder: i })
      .run();
  });

  return getPublishPlan(db, id)!;
}

export function getPublishPlan(db: IcyDb, id: string): PublishPlanListItem | null {
  const row = db.select().from(publishPlans).where(eq(publishPlans.id, id)).get();
  if (!row) return null;
  const linked = loadPlanAssets(db, [id]);
  return {
    id: row.id,
    date: row.date,
    platform: row.platform,
    status: row.status,
    caption: row.caption,
    hashtags: row.hashtags,
    notes: row.notes,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    assets: linked.get(id) ?? [],
  };
}

function loadPlanAssets(db: IcyDb, planIds: string[]) {
  const map = new Map<string, PlanAssetSummary[]>();
  if (planIds.length === 0) return map;

  const rows = db
    .select({
      planId: publishPlanAssets.planId,
      sortOrder: publishPlanAssets.sortOrder,
      id: assets.id,
      filePath: assets.filePath,
      platform: assets.platform,
      kind: assets.kind,
      width: assets.width,
      height: assets.height,
    })
    .from(publishPlanAssets)
    .innerJoin(assets, eq(publishPlanAssets.assetId, assets.id))
    .where(inArray(publishPlanAssets.planId, planIds))
    .orderBy(asc(publishPlanAssets.sortOrder))
    .all();

  for (const r of rows) {
    const list = map.get(r.planId) ?? [];
    list.push({
      id: r.id,
      filePath: r.filePath,
      platform: r.platform,
      kind: r.kind,
      width: r.width,
      height: r.height,
    });
    map.set(r.planId, list);
  }
  return map;
}

export function listPublishPlans(
  db: IcyDb,
  opts: {
    date?: string;
    status?: PublishStatus;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  } = {},
): PublishPlanListItem[] {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  if (opts.date) assertDate(opts.date);
  if (opts.fromDate) assertDate(opts.fromDate);
  if (opts.toDate) assertDate(opts.toDate);
  if (opts.status) assertStatus(opts.status);

  const filters = [];
  if (opts.date) filters.push(eq(publishPlans.date, opts.date));
  if (opts.status) filters.push(eq(publishPlans.status, opts.status));
  if (opts.fromDate) filters.push(gte(publishPlans.date, opts.fromDate));
  if (opts.toDate) filters.push(lte(publishPlans.date, opts.toDate));

  const query = db.select().from(publishPlans);
  const rows = (
    filters.length ? query.where(and(...filters)) : query
  )
    .orderBy(asc(publishPlans.date), desc(publishPlans.createdAt))
    .limit(limit)
    .all();

  const assetMap = loadPlanAssets(
    db,
    rows.map((r) => r.id),
  );

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    platform: r.platform,
    status: r.status,
    caption: r.caption,
    hashtags: r.hashtags,
    notes: r.notes,
    publishedAt: r.publishedAt,
    createdAt: r.createdAt,
    assets: assetMap.get(r.id) ?? [],
  }));
}

export function updatePublishPlan(
  db: IcyDb,
  id: string,
  input: UpdatePublishPlanInput,
) {
  const row = db.select().from(publishPlans).where(eq(publishPlans.id, id)).get();
  if (!row) throw new PublishPlanError("排期不存在", "not_found");

  const patch: {
    caption?: string;
    hashtags?: string;
    notes?: string;
    status?: PublishStatus;
    date?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.caption !== undefined) patch.caption = input.caption.trim();
  if (input.hashtags !== undefined) patch.hashtags = input.hashtags.trim();
  if (input.notes !== undefined) patch.notes = input.notes.trim();
  if (input.status !== undefined) {
    assertStatus(input.status);
    if (input.status === "published") assertPlanPublishable(db, id);
    patch.status = input.status;
  }
  if (input.date !== undefined) {
    assertDate(input.date);
    patch.date = input.date;
  }

  db.update(publishPlans).set(patch).where(eq(publishPlans.id, id)).run();
  return getPublishPlan(db, id)!;
}

export function markPlanPublished(
  db: IcyDb,
  id: string,
  opts: { notes?: string } = {},
) {
  const row = db.select().from(publishPlans).where(eq(publishPlans.id, id)).get();
  if (!row) throw new PublishPlanError("排期不存在", "not_found");
  if (row.status === "published") {
    throw new PublishPlanError("已发布", "conflict");
  }
  assertPlanPublishable(db, id);

  db.update(publishPlans)
    .set({
      status: "published",
      publishedAt: new Date(),
      notes: opts.notes !== undefined ? opts.notes.trim() : row.notes,
      updatedAt: new Date(),
    })
    .where(eq(publishPlans.id, id))
    .run();

  return getPublishPlan(db, id)!;
}

export function listInventoryPacks(db: IcyDb, opts: { limit?: number } = {}): InventoryPack[] {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 100));
  const rows = db
    .select({
      id: pairSets.id,
      characterId: pairSets.characterId,
      characterName: characters.name,
      seed: pairSets.seed,
      rating: pairSets.rating,
      animeImagePath: pairSets.animeImagePath,
      realImagePath: pairSets.realImagePath,
      createdAt: pairSets.createdAt,
    })
    .from(pairSets)
    .innerJoin(characters, eq(pairSets.characterId, characters.id))
    .where(
      and(
        eq(pairSets.reviewStatus, "approved"),
        eq(pairSets.postProcessStatus, "composed"),
        eq(characters.origin, "original"),
        isUnscheduledPack(db),
      ),
    )
    .orderBy(desc(pairSets.createdAt))
    .limit(limit)
    .all();

  const counts = new Map(
    db
      .select({ pairSetId: assets.pairSetId, n: count() })
      .from(assets)
      .groupBy(assets.pairSetId)
      .all()
      .map((r) => [r.pairSetId, r.n] as const),
  );

  return rows.map((r) => ({
    id: r.id,
    characterId: r.characterId,
    characterName: r.characterName,
    seed: r.seed,
    rating: r.rating,
    animeImagePath: r.animeImagePath,
    realImagePath: r.realImagePath,
    assetCount: counts.get(r.id) ?? 0,
    createdAt: r.createdAt,
  }));
}

export function getInventoryStats(
  db: IcyDb,
  opts: { dailyBurn?: number } = {},
): InventoryStats {
  const dailyBurn = Math.max(1, Math.trunc(opts.dailyBurn ?? 1));
  const row = db
    .select({ n: count() })
    .from(pairSets)
    .innerJoin(characters, eq(pairSets.characterId, characters.id))
    .where(
      and(
        eq(pairSets.reviewStatus, "approved"),
        eq(pairSets.postProcessStatus, "composed"),
        eq(characters.origin, "original"),
        isUnscheduledPack(db),
      ),
    )
    .get();
  const readyPacks = row?.n ?? 0;
  return {
    readyPacks,
    dailyBurn,
    days: Math.floor(readyPacks / dailyBurn),
  };
}
