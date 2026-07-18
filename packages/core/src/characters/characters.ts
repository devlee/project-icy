import { and, count, desc, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { CharacterOrigin, CharacterStatus } from "@icy/shared";
import { CHARACTER_ORIGINS, CHARACTER_STATUSES } from "@icy/shared";
import type { IcyDb } from "../db/client";
import {
  characterImages,
  characterLoras,
  characters,
  pairSets,
} from "../db/schema";
import { slugify } from "./slug";

export type CharacterListItem = {
  id: string;
  name: string;
  slug: string;
  status: CharacterStatus;
  origin: CharacterOrigin;
  ipSource: string;
  profile: string;
  tagline: string;
  faceIdRefCount: number;
  loraCount: number;
  pairSetCount: number;
  /** True when both anime and real anchors exist. */
  hasDualAnchors: boolean;
};

export type CreateCharacterInput = {
  name: string;
  slug?: string;
  tagline?: string;
  profile?: string;
  status?: CharacterStatus;
  origin?: CharacterOrigin;
  ipSource?: string;
};

export type UpdateCharacterInput = {
  name?: string;
  slug?: string;
  tagline?: string;
  profile?: string;
  status?: CharacterStatus;
  origin?: CharacterOrigin;
  ipSource?: string;
};

export class CharacterError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "conflict" | "not_found",
  ) {
    super(message);
    this.name = "CharacterError";
  }
}

function assertStatus(status: string): asserts status is CharacterStatus {
  if (!(CHARACTER_STATUSES as readonly string[]).includes(status)) {
    throw new CharacterError(`无效状态: ${status}`, "validation");
  }
}

function assertOrigin(origin: string): asserts origin is CharacterOrigin {
  if (!(CHARACTER_ORIGINS as readonly string[]).includes(origin)) {
    throw new CharacterError(`无效来源: ${origin}`, "validation");
  }
}

function normalizeIpSource(origin: CharacterOrigin, ipSource: string | undefined): string {
  const source = (ipSource ?? "").trim();
  if (origin === "ip_reference" && !source) {
    throw new CharacterError("IP 参考角色须填写所属作品", "validation");
  }
  return origin === "original" ? "" : source;
}

function normalizeSlug(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new CharacterError("slug 不能为空", "validation");
  return slug;
}

function countMap(
  rows: { characterId: string; n: number }[],
): Map<string, number> {
  return new Map(rows.map((r) => [r.characterId, r.n]));
}

export function listCharacters(db: IcyDb): CharacterListItem[] {
  const rows = db.select().from(characters).orderBy(desc(characters.updatedAt)).all();
  if (rows.length === 0) return [];

  const faceIds = countMap(
    db
      .select({ characterId: characterImages.characterId, n: count() })
      .from(characterImages)
      .where(eq(characterImages.kind, "faceid_ref"))
      .groupBy(characterImages.characterId)
      .all(),
  );
  const loras = countMap(
    db
      .select({ characterId: characterLoras.characterId, n: count() })
      .from(characterLoras)
      .groupBy(characterLoras.characterId)
      .all(),
  );
  const pairs = countMap(
    db
      .select({ characterId: pairSets.characterId, n: count() })
      .from(pairSets)
      .groupBy(pairSets.characterId)
      .all(),
  );
  const animeAnchors = countMap(
    db
      .select({ characterId: characterImages.characterId, n: count() })
      .from(characterImages)
      .where(and(eq(characterImages.kind, "anchor"), eq(characterImages.form, "anime")))
      .groupBy(characterImages.characterId)
      .all(),
  );
  const realAnchors = countMap(
    db
      .select({ characterId: characterImages.characterId, n: count() })
      .from(characterImages)
      .where(and(eq(characterImages.kind, "anchor"), eq(characterImages.form, "real")))
      .groupBy(characterImages.characterId)
      .all(),
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    origin: r.origin,
    ipSource: r.ipSource,
    profile: r.profile,
    tagline: r.tagline,
    faceIdRefCount: faceIds.get(r.id) ?? 0,
    loraCount: loras.get(r.id) ?? 0,
    pairSetCount: pairs.get(r.id) ?? 0,
    hasDualAnchors: (animeAnchors.get(r.id) ?? 0) > 0 && (realAnchors.get(r.id) ?? 0) > 0,
  }));
}

export function createCharacter(db: IcyDb, input: CreateCharacterInput) {
  const name = input.name.trim();
  if (!name) throw new CharacterError("名称不能为空", "validation");

  const slug = normalizeSlug(input.slug?.trim() ? input.slug : slugify(name));
  const status = input.status ?? "draft";
  assertStatus(status);
  const origin = input.origin ?? "original";
  assertOrigin(origin);
  const ipSource = normalizeIpSource(origin, input.ipSource);

  const existing = db.select().from(characters).where(eq(characters.slug, slug)).get();
  if (existing) throw new CharacterError(`slug「${slug}」已存在`, "conflict");

  const id = nanoid();
  db.insert(characters)
    .values({
      id,
      name,
      slug,
      status,
      origin,
      ipSource,
      tagline: input.tagline?.trim() ?? "",
      profile: input.profile?.trim() ?? "",
    })
    .run();

  return db.select().from(characters).where(eq(characters.id, id)).get()!;
}

export function updateCharacter(db: IcyDb, id: string, input: UpdateCharacterInput) {
  const row = db.select().from(characters).where(eq(characters.id, id)).get();
  if (!row) throw new CharacterError("角色不存在", "not_found");

  const patch: Partial<typeof characters.$inferInsert> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new CharacterError("名称不能为空", "validation");
    patch.name = name;
  }
  if (input.slug !== undefined) {
    const slug = normalizeSlug(input.slug);
    const clash = db
      .select()
      .from(characters)
      .where(and(eq(characters.slug, slug), ne(characters.id, id)))
      .get();
    if (clash) throw new CharacterError(`slug「${slug}」已存在`, "conflict");
    patch.slug = slug;
  }
  if (input.tagline !== undefined) patch.tagline = input.tagline.trim();
  if (input.profile !== undefined) patch.profile = input.profile.trim();
  if (input.status !== undefined) {
    assertStatus(input.status);
    patch.status = input.status;
  }
  if (input.origin !== undefined || input.ipSource !== undefined) {
    const origin = input.origin ?? row.origin;
    assertOrigin(origin);
    patch.origin = origin;
    patch.ipSource = normalizeIpSource(
      origin,
      input.ipSource !== undefined ? input.ipSource : row.ipSource,
    );
  }

  if (Object.keys(patch).length === 0) return row;

  patch.updatedAt = new Date();
  db.update(characters).set(patch).where(eq(characters.id, id)).run();
  return db.select().from(characters).where(eq(characters.id, id)).get()!;
}

export function archiveCharacter(db: IcyDb, id: string) {
  return updateCharacter(db, id, { status: "archived" });
}

export function countCharactersByStatus(db: IcyDb) {
  const rows = db
    .select({ status: characters.status, n: count() })
    .from(characters)
    .groupBy(characters.status)
    .all();
  const result: Record<CharacterStatus, number> = {
    draft: 0,
    growing: 0,
    featured: 0,
    archived: 0,
  };
  for (const r of rows) result[r.status] = r.n;
  return result;
}
