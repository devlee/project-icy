import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Form } from "@icy/shared";
import type { IcyDb } from "../db/client";
import { characterImages, characters } from "../db/schema";

export type CharacterImageKind = "anchor" | "faceid_ref";

export type CharacterImageRow = {
  id: string;
  characterId: string;
  kind: CharacterImageKind;
  form: Form | null;
  filePath: string;
  isPrimary: boolean;
  note: string;
  createdAt: Date;
};

export type AddCharacterImageInput = {
  characterId: string;
  kind: CharacterImageKind;
  form?: Form | null;
  filePath: string;
  isPrimary?: boolean;
  note?: string;
  /** Set when promoted from a PairSet generation result. */
  sourcePairSetId?: string | null;
};

export class CharacterImageError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "not_found",
  ) {
    super(message);
    this.name = "CharacterImageError";
  }
}

export function listCharacterImages(
  db: IcyDb,
  characterId: string,
): CharacterImageRow[] {
  return db
    .select()
    .from(characterImages)
    .where(eq(characterImages.characterId, characterId))
    .orderBy(desc(characterImages.isPrimary), asc(characterImages.createdAt))
    .all()
    .map((r) => ({
      id: r.id,
      characterId: r.characterId,
      kind: r.kind,
      form: r.form,
      filePath: r.filePath,
      isPrimary: r.isPrimary,
      note: r.note,
      createdAt: r.createdAt,
    }));
}

export function addCharacterImage(db: IcyDb, input: AddCharacterImageInput) {
  const characterId = input.characterId.trim();
  if (!characterId) throw new CharacterImageError("须指定角色", "validation");
  const filePath = input.filePath.trim();
  if (!filePath) throw new CharacterImageError("文件路径不能为空", "validation");

  const character = db.select().from(characters).where(eq(characters.id, characterId)).get();
  if (!character) throw new CharacterImageError("角色不存在", "not_found");

  const kind = input.kind;
  const form = input.form ?? (kind === "faceid_ref" ? "real" : "anime");
  const isPrimary = input.isPrimary ?? true;

  if (isPrimary && kind === "anchor" && form) {
    db.update(characterImages)
      .set({ isPrimary: false })
      .where(
        and(
          eq(characterImages.characterId, characterId),
          eq(characterImages.kind, "anchor"),
          eq(characterImages.form, form),
        ),
      )
      .run();
  }

  const id = nanoid();
  db.insert(characterImages)
    .values({
      id,
      characterId,
      kind,
      form,
      filePath,
      isPrimary,
      note: input.note?.trim() ?? "",
      sourcePairSetId: input.sourcePairSetId?.trim() || null,
    })
    .run();

  return listCharacterImages(db, characterId).find((i) => i.id === id)!;
}

/**
 * Reference image for anime generation: primary anime anchor, else first anime
 * anchor, else any faceid_ref.
 */
export function getPrimaryAnimeAnchor(
  db: IcyDb,
  characterId: string,
): CharacterImageRow | null {
  const images = listCharacterImages(db, characterId);
  const primary = images.find(
    (i) => i.kind === "anchor" && i.form === "anime" && i.isPrimary,
  );
  if (primary) return primary;
  const anime = images.find((i) => i.kind === "anchor" && i.form === "anime");
  if (anime) return anime;
  return images.find((i) => i.kind === "faceid_ref") ?? null;
}

/**
 * Reference image for real-form generation.
 * Prefer FaceID refs promoted from review (`F`) when present, else real anchors.
 * (InstantID graph still deferred — refs feed IP-Adapter today.)
 */
export function getPrimaryRealAnchor(
  db: IcyDb,
  characterId: string,
): CharacterImageRow | null {
  const images = listCharacterImages(db, characterId);
  const faceId =
    images.find((i) => i.kind === "faceid_ref" && i.form === "real" && i.isPrimary) ??
    images.find((i) => i.kind === "faceid_ref" && (i.form === "real" || i.form === null)) ??
    images.find((i) => i.kind === "faceid_ref");
  if (faceId) return faceId;
  const primary = images.find(
    (i) => i.kind === "anchor" && i.form === "real" && i.isPrimary,
  );
  if (primary) return primary;
  return images.find((i) => i.kind === "anchor" && i.form === "real") ?? null;
}

export function deleteCharacterImage(db: IcyDb, id: string) {
  const row = db.select().from(characterImages).where(eq(characterImages.id, id)).get();
  if (!row) throw new CharacterImageError("图片不存在", "not_found");
  db.delete(characterImages).where(eq(characterImages.id, id)).run();
  return row;
}
