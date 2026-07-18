import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Form } from "@icy/shared";
import type { IcyDb } from "../db/client";
import { characterImages, pairSets } from "../db/schema";
import type { StorageAdapter } from "../ports/storage";
import {
  addCharacterImage,
  CharacterImageError,
  type CharacterImageKind,
  type CharacterImageRow,
  listCharacterImages,
} from "./images";

export type PromoteSide = Form;

export type PromotePairSetImageInput = {
  pairSetId: string;
  side: PromoteSide;
  kind: CharacterImageKind;
};

export type PromotePairSetImageResult = {
  image: CharacterImageRow;
  /** False when the same PairSet+side+kind was already promoted. */
  created: boolean;
};

function extOf(key: string): string {
  const base = key.split("/").pop() ?? key;
  const i = base.lastIndexOf(".");
  if (i <= 0) return ".png";
  const ext = base.slice(i).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".png";
}

function findExistingPromote(
  db: IcyDb,
  pairSetId: string,
  kind: CharacterImageKind,
  form: Form,
): CharacterImageRow | null {
  const row = db
    .select()
    .from(characterImages)
    .where(
      and(
        eq(characterImages.sourcePairSetId, pairSetId),
        eq(characterImages.kind, kind),
        eq(characterImages.form, form),
      ),
    )
    .get();
  if (!row) return null;
  return {
    id: row.id,
    characterId: row.characterId,
    kind: row.kind,
    form: row.form,
    filePath: row.filePath,
    isPrimary: row.isPrimary,
    note: row.note,
    createdAt: row.createdAt,
  };
}

/**
 * Copy a PairSet side into `characters/...` and register it as an anchor or
 * FaceID ref. Same pairSetId+side+kind is idempotent (returns existing row).
 */
export async function promotePairSetImage(
  db: IcyDb,
  storage: StorageAdapter,
  input: PromotePairSetImageInput,
): Promise<PromotePairSetImageResult> {
  const pairSetId = input.pairSetId.trim();
  if (!pairSetId) {
    throw new CharacterImageError("须指定 PairSet", "validation");
  }
  if (input.side !== "anime" && input.side !== "real") {
    throw new CharacterImageError("无效形态侧", "validation");
  }
  if (input.kind !== "anchor" && input.kind !== "faceid_ref") {
    throw new CharacterImageError("无效提升类型", "validation");
  }

  const pair = db.select().from(pairSets).where(eq(pairSets.id, pairSetId)).get();
  if (!pair) throw new CharacterImageError("PairSet 不存在", "not_found");

  const form = input.side;
  const existing = findExistingPromote(db, pairSetId, input.kind, form);
  if (existing) {
    return { image: existing, created: false };
  }

  const sourcePath =
    form === "anime" ? pair.animeImagePath.trim() : pair.realImagePath.trim();
  if (!sourcePath) {
    throw new CharacterImageError("源图路径为空", "validation");
  }
  if (!(await storage.exists(sourcePath))) {
    throw new CharacterImageError("源图文件不存在", "not_found");
  }

  const ext = extOf(sourcePath);
  const folder = input.kind === "anchor" ? "anchors" : "faceid";
  const destKey = `characters/${pair.characterId}/${folder}/${form}/${nanoid(12)}${ext}`;

  const bytes = await storage.get(sourcePath);
  await storage.put(destKey, bytes);

  let isPrimary = false;
  if (input.kind === "anchor") {
    const hasAnchor = listCharacterImages(db, pair.characterId).some(
      (i) => i.kind === "anchor" && i.form === form,
    );
    isPrimary = !hasAnchor;
  }

  const image = addCharacterImage(db, {
    characterId: pair.characterId,
    kind: input.kind,
    form,
    filePath: destKey,
    isPrimary,
    note: `promoted from pair ${pairSetId} (${form})`,
    sourcePairSetId: pairSetId,
  });

  return { image, created: true };
}
