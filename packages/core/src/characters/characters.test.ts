import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import {
  CharacterError,
  archiveCharacter,
  createCharacter,
  listCharacters,
  updateCharacter,
} from "./characters";
import { slugify } from "./slug";
import { characterImages, characterLoras, characters, pairSets, generationTasks } from "../db/schema";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
});

describe("slugify", () => {
  it("keeps ascii name fragments", () => {
    expect(slugify("凛冬 Rin")).toBe("rin");
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("falls back when name has no ascii", () => {
    expect(slugify("凛冬")).toMatch(/^char-/);
  });
});

describe("createCharacter", () => {
  it("creates a draft with auto slug", () => {
    const row = createCharacter(db, { name: "凛冬 Rin", tagline: "冷感银发" });
    expect(row).toMatchObject({
      name: "凛冬 Rin",
      slug: "rin",
      status: "draft",
      tagline: "冷感银发",
      origin: "original",
      ipSource: "",
    });
  });

  it("creates ip_reference with required ipSource", () => {
    const row = createCharacter(db, {
      name: "雷电将军",
      slug: "raiden",
      origin: "ip_reference",
      ipSource: "原神",
    });
    expect(row).toMatchObject({ origin: "ip_reference", ipSource: "原神" });
    expect(() =>
      createCharacter(db, { name: "X", slug: "x", origin: "ip_reference" }),
    ).toThrow(/所属作品/);
  });

  it("rejects empty name and duplicate slug", () => {
    expect(() => createCharacter(db, { name: "  " })).toThrow(CharacterError);
    createCharacter(db, { name: "A", slug: "icy" });
    expect(() => createCharacter(db, { name: "B", slug: "icy" })).toThrow(/已存在/);
  });
});

describe("listCharacters", () => {
  it("returns counts and dual-anchor flag", () => {
    const c = createCharacter(db, { name: "凛冬 Rin", status: "featured" });
    db.insert(characterImages)
      .values([
        { id: "a1", characterId: c.id, kind: "anchor", form: "anime", filePath: "a.png", isPrimary: true },
        { id: "a2", characterId: c.id, kind: "anchor", form: "real", filePath: "r.png", isPrimary: true },
        { id: "f1", characterId: c.id, kind: "faceid_ref", filePath: "f.png" },
      ])
      .run();
    db.insert(characterLoras)
      .values({ id: "l1", characterId: c.id, name: "rin", modelPath: "rin.safetensors" })
      .run();
    db.insert(generationTasks)
      .values({
        id: "t1",
        type: "pair",
        characterId: c.id,
        params: {
          seedStrategy: { kind: "fixed", seed: 1 },
          factorIds: [],
          animeWorkflowId: "a",
          realWorkflowId: "r",
        },
      })
      .run();
    db.insert(pairSets)
      .values({
        id: "p1",
        taskId: "t1",
        characterId: c.id,
        seed: 1,
        animeImagePath: "a.png",
        realImagePath: "r.png",
      })
      .run();

    const list = listCharacters(db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      faceIdRefCount: 1,
      loraCount: 1,
      pairSetCount: 1,
      hasDualAnchors: true,
      status: "featured",
    });
  });

  it("orders by updatedAt descending", () => {
    const a = createCharacter(db, { name: "A Rin", slug: "a" });
    createCharacter(db, { name: "B Mei", slug: "b" });
    updateCharacter(db, a.id, { tagline: "touched" });
    expect(listCharacters(db).map((c) => c.slug)).toEqual(["a", "b"]);
  });
});

describe("updateCharacter / archiveCharacter", () => {
  it("updates fields and archives", () => {
    const c = createCharacter(db, { name: "芽衣 Mei" });
    const updated = updateCharacter(db, c.id, { status: "growing", profile: "街拍" });
    expect(updated).toMatchObject({ status: "growing", profile: "街拍" });

    const archived = archiveCharacter(db, c.id);
    expect(archived.status).toBe("archived");
    expect(db.select().from(characters).get()?.status).toBe("archived");
  });

  it("throws not_found for missing id", () => {
    expect(() => updateCharacter(db, "missing", { name: "x" })).toThrow(/不存在/);
  });
});
