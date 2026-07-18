import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createCharacter } from "./characters";
import {
  addCharacterImage,
  CharacterImageError,
  deleteCharacterImage,
  getPrimaryAnimeAnchor,
  getPrimaryRealAnchor,
  listCharacterImages,
} from "./images";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;
let characterId: string;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
  characterId = createCharacter(db, { name: "Rin", slug: "rin" }).id;
});

describe("character images", () => {
  it("adds primary anime anchor and clears previous primary", () => {
    const a = addCharacterImage(db, {
      characterId,
      kind: "anchor",
      form: "anime",
      filePath: "characters/rin/a.png",
      isPrimary: true,
    });
    const b = addCharacterImage(db, {
      characterId,
      kind: "anchor",
      form: "anime",
      filePath: "characters/rin/b.png",
      isPrimary: true,
    });

    const list = listCharacterImages(db, characterId);
    expect(list).toHaveLength(2);
    expect(list.find((i) => i.id === a.id)?.isPrimary).toBe(false);
    expect(list.find((i) => i.id === b.id)?.isPrimary).toBe(true);
    expect(getPrimaryAnimeAnchor(db, characterId)?.filePath).toBe(
      "characters/rin/b.png",
    );
  });

  it("falls back to faceid_ref when no anime anchor", () => {
    addCharacterImage(db, {
      characterId,
      kind: "faceid_ref",
      filePath: "characters/rin/face.png",
    });
    expect(getPrimaryAnimeAnchor(db, characterId)?.filePath).toBe(
      "characters/rin/face.png",
    );
  });

  it("resolves primary real anchor", () => {
    addCharacterImage(db, {
      characterId,
      kind: "anchor",
      form: "real",
      filePath: "characters/rin/real.png",
      isPrimary: true,
    });
    expect(getPrimaryRealAnchor(db, characterId)?.filePath).toBe(
      "characters/rin/real.png",
    );
  });

  it("deletes and rejects missing character", () => {
    const img = addCharacterImage(db, {
      characterId,
      kind: "anchor",
      form: "anime",
      filePath: "characters/rin/x.png",
    });
    deleteCharacterImage(db, img.id);
    expect(listCharacterImages(db, characterId)).toHaveLength(0);
    expect(() =>
      addCharacterImage(db, {
        characterId: "missing",
        kind: "anchor",
        form: "anime",
        filePath: "x.png",
      }),
    ).toThrow(CharacterImageError);
  });
});
