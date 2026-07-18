import { and, count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  AssetKind,
  CharacterOrigin,
  Form,
  Platform,
  PostProcessStatus,
} from "@icy/shared";
import {
  ASSET_KINDS,
  PLATFORMS,
  POST_PROCESS_STATUSES,
} from "@icy/shared";
import type { IcyDb } from "../db/client";
import { assets, characters, pairSets } from "../db/schema";

export type AssetRow = {
  id: string;
  pairSetId: string;
  kind: AssetKind;
  form: Form | null;
  platform: Platform;
  filePath: string;
  watermarked: boolean;
  width: number;
  height: number;
  createdAt: Date;
};

export type CreateAssetInput = {
  pairSetId: string;
  kind: AssetKind;
  form?: Form | null;
  platform: Platform;
  filePath: string;
  watermarked?: boolean;
  width: number;
  height: number;
};

export type PostQueueItem = {
  id: string;
  characterId: string;
  characterName: string;
  characterOrigin: CharacterOrigin;
  seed: number;
  rating: number | null;
  animeImagePath: string;
  realImagePath: string;
  postProcessStatus: PostProcessStatus;
  reviewStatus: string;
  assetCount: number;
  createdAt: Date;
};

export class AssetError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "not_found" | "conflict",
  ) {
    super(message);
    this.name = "AssetError";
  }
}

export function createAsset(db: IcyDb, input: CreateAssetInput): AssetRow {
  const pairSetId = input.pairSetId.trim();
  const filePath = input.filePath.trim();
  if (!pairSetId) throw new AssetError("须指定 PairSet", "validation");
  if (!filePath) throw new AssetError("文件路径不能为空", "validation");
  if (!(ASSET_KINDS as readonly string[]).includes(input.kind)) {
    throw new AssetError(`无效 asset kind: ${input.kind}`, "validation");
  }
  if (!(PLATFORMS as readonly string[]).includes(input.platform)) {
    throw new AssetError(`无效 platform: ${input.platform}`, "validation");
  }
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height)) {
    throw new AssetError("宽高无效", "validation");
  }

  const pair = db.select().from(pairSets).where(eq(pairSets.id, pairSetId)).get();
  if (!pair) throw new AssetError("PairSet 不存在", "not_found");

  const existing = db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.pairSetId, pairSetId),
        eq(assets.kind, input.kind),
        eq(assets.platform, input.platform),
        eq(assets.filePath, filePath),
      ),
    )
    .get();
  if (existing) {
    return {
      id: existing.id,
      pairSetId: existing.pairSetId,
      kind: existing.kind,
      form: existing.form,
      platform: existing.platform,
      filePath: existing.filePath,
      watermarked: existing.watermarked,
      width: existing.width,
      height: existing.height,
      createdAt: existing.createdAt,
    };
  }

  const id = nanoid();
  db.insert(assets)
    .values({
      id,
      pairSetId,
      kind: input.kind,
      form: input.form ?? null,
      platform: input.platform,
      filePath,
      watermarked: input.watermarked ?? true,
      width: Math.trunc(input.width),
      height: Math.trunc(input.height),
    })
    .run();

  return listAssetsByPairSet(db, pairSetId).find((a) => a.id === id)!;
}

export function listAssetsByPairSet(db: IcyDb, pairSetId: string): AssetRow[] {
  return db
    .select()
    .from(assets)
    .where(eq(assets.pairSetId, pairSetId))
    .orderBy(desc(assets.createdAt))
    .all()
    .map((r) => ({
      id: r.id,
      pairSetId: r.pairSetId,
      kind: r.kind,
      form: r.form,
      platform: r.platform,
      filePath: r.filePath,
      watermarked: r.watermarked,
      width: r.width,
      height: r.height,
      createdAt: r.createdAt,
    }));
}

export function markPairPostStatus(
  db: IcyDb,
  id: string,
  status: PostProcessStatus,
) {
  if (!(POST_PROCESS_STATUSES as readonly string[]).includes(status)) {
    throw new AssetError(`无效后期状态: ${status}`, "validation");
  }
  const row = db.select().from(pairSets).where(eq(pairSets.id, id)).get();
  if (!row) throw new AssetError("PairSet 不存在", "not_found");
  db.update(pairSets)
    .set({ postProcessStatus: status })
    .where(eq(pairSets.id, id))
    .run();
  return db.select().from(pairSets).where(eq(pairSets.id, id)).get()!;
}

/**
 * Approved pairs for the post workshop.
 * `raw` = awaiting compose; `composed` = ready pack.
 */
export function listApprovedForPost(
  db: IcyDb,
  opts: { postProcessStatus?: PostProcessStatus; limit?: number } = {},
): PostQueueItem[] {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 100));
  if (
    opts.postProcessStatus !== undefined &&
    !(POST_PROCESS_STATUSES as readonly string[]).includes(opts.postProcessStatus)
  ) {
    throw new AssetError(`无效后期状态: ${opts.postProcessStatus}`, "validation");
  }

  const filters = [eq(pairSets.reviewStatus, "approved")];
  if (opts.postProcessStatus) {
    filters.push(eq(pairSets.postProcessStatus, opts.postProcessStatus));
  }

  const rows = db
    .select({
      id: pairSets.id,
      characterId: pairSets.characterId,
      characterName: characters.name,
      characterOrigin: characters.origin,
      seed: pairSets.seed,
      rating: pairSets.rating,
      animeImagePath: pairSets.animeImagePath,
      realImagePath: pairSets.realImagePath,
      postProcessStatus: pairSets.postProcessStatus,
      reviewStatus: pairSets.reviewStatus,
      createdAt: pairSets.createdAt,
    })
    .from(pairSets)
    .innerJoin(characters, eq(pairSets.characterId, characters.id))
    .where(and(...filters))
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
    characterOrigin: r.characterOrigin,
    seed: r.seed,
    rating: r.rating,
    animeImagePath: r.animeImagePath,
    realImagePath: r.realImagePath,
    postProcessStatus: r.postProcessStatus,
    reviewStatus: r.reviewStatus,
    assetCount: counts.get(r.id) ?? 0,
    createdAt: r.createdAt,
  }));
}
