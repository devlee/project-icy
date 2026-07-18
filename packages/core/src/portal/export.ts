import { and, desc, eq, inArray } from "drizzle-orm";
import type { PortalContentPack, PortalGalleryItem } from "@icy/shared";
import type { IcyDb } from "../db/client";
import {
  assets,
  characters,
  pairSets,
  publishPlanAssets,
  publishPlans,
} from "../db/schema";
import type { StorageAdapter } from "../ports/storage";

export type ExportPortalPackResult = {
  pack: PortalContentPack;
  /** Content-relative path written, e.g. portal/pack.json */
  packPath: string;
};

/**
 * Build a PortalContentPack from original featured/growing characters and
 * recently published plans (or composed approved pairs as fallback gallery).
 * Image URLs use StorageAdapter.publicUrl (Studio /api/content locally).
 */
export function buildPortalContentPack(
  db: IcyDb,
  storage: StorageAdapter,
): PortalContentPack {
  const charRows = db
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.origin, "original"),
        inArray(characters.status, ["featured", "growing"]),
      ),
    )
    .all();

  const portalCharacters = charRows.map((c) => {
    const hero = db
      .select()
      .from(pairSets)
      .where(
        and(
          eq(pairSets.characterId, c.id),
          eq(pairSets.reviewStatus, "approved"),
          eq(pairSets.postProcessStatus, "composed"),
        ),
      )
      .orderBy(desc(pairSets.createdAt))
      .limit(1)
      .get();

    const composite = hero
      ? db
          .select()
          .from(assets)
          .where(
            and(eq(assets.pairSetId, hero.id), eq(assets.kind, "composite")),
          )
          .limit(1)
          .get()
      : null;

    return {
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      profile: c.profile,
      featured: c.status === "featured",
      heroPair: {
        animeUrl: hero ? storage.publicUrl(hero.animeImagePath) : "",
        realUrl: hero ? storage.publicUrl(hero.realImagePath) : "",
        compositeUrl: composite ? storage.publicUrl(composite.filePath) : undefined,
        width: composite?.width ?? 832,
        height: composite?.height ?? 1216,
      },
    };
  });

  const published = db
    .select()
    .from(publishPlans)
    .where(eq(publishPlans.status, "published"))
    .orderBy(desc(publishPlans.publishedAt))
    .limit(48)
    .all();

  const galleryItems: PortalGalleryItem[] = [];
  for (const plan of published) {
    const linked = db
      .select({
        filePath: assets.filePath,
        width: assets.width,
        height: assets.height,
        kind: assets.kind,
        pairSetId: assets.pairSetId,
      })
      .from(publishPlanAssets)
      .innerJoin(assets, eq(publishPlanAssets.assetId, assets.id))
      .where(eq(publishPlanAssets.planId, plan.id))
      .all();

    const pairSetId = linked[0]?.pairSetId;
    if (!pairSetId) continue;
    const pair = db.select().from(pairSets).where(eq(pairSets.id, pairSetId)).get();
    if (!pair) continue;
    const character = db
      .select()
      .from(characters)
      .where(eq(characters.id, pair.characterId))
      .get();
    if (!character || character.origin !== "original") continue;

    const composite = linked.find((a) => a.kind === "composite") ?? linked[0];
    galleryItems.push({
      id: plan.id,
      characterSlug: character.slug,
      title: plan.caption.slice(0, 80) || `${character.name} · ${plan.platform}`,
      pair: {
        animeUrl: storage.publicUrl(pair.animeImagePath),
        realUrl: storage.publicUrl(pair.realImagePath),
        compositeUrl: composite
          ? storage.publicUrl(composite.filePath)
          : undefined,
        width: composite?.width ?? 832,
        height: composite?.height ?? 1216,
      },
      publishedAt: (plan.publishedAt ?? plan.createdAt).toISOString(),
      tags: plan.hashtags
        .split(/[\s,#]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8),
    });
  }

  // Fallback gallery from composed pairs when nothing published yet
  if (galleryItems.length === 0) {
    const composed = db
      .select()
      .from(pairSets)
      .where(
        and(
          eq(pairSets.reviewStatus, "approved"),
          eq(pairSets.postProcessStatus, "composed"),
        ),
      )
      .orderBy(desc(pairSets.createdAt))
      .limit(24)
      .all();
    for (const pair of composed) {
      const character = db
        .select()
        .from(characters)
        .where(eq(characters.id, pair.characterId))
        .get();
      if (!character || character.origin !== "original") continue;
      const composite = db
        .select()
        .from(assets)
        .where(and(eq(assets.pairSetId, pair.id), eq(assets.kind, "composite")))
        .limit(1)
        .get();
      galleryItems.push({
        id: pair.id,
        characterSlug: character.slug,
        title: `${character.name} · seed ${pair.seed}`,
        pair: {
          animeUrl: storage.publicUrl(pair.animeImagePath),
          realUrl: storage.publicUrl(pair.realImagePath),
          compositeUrl: composite
            ? storage.publicUrl(composite.filePath)
            : undefined,
          width: composite?.width ?? 832,
          height: composite?.height ?? 1216,
        },
        publishedAt: pair.createdAt.toISOString(),
        tags: [],
      });
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    characters: portalCharacters,
    galleryItems,
  };
}

export async function exportPortalContentPack(
  db: IcyDb,
  storage: StorageAdapter,
): Promise<ExportPortalPackResult> {
  const pack = buildPortalContentPack(db, storage);
  const packPath = "portal/pack.json";
  await storage.put(packPath, Buffer.from(JSON.stringify(pack, null, 2), "utf8"));
  return { pack, packPath };
}
