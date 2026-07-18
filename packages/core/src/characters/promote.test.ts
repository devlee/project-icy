import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import type { StorageAdapter } from "../ports/storage";
import { createCharacter } from "./characters";
import { listCharacterImages } from "./images";
import { createSingleGenerationTask } from "../generation/tasks";
import { createPairSet } from "../generation/pair-sets";
import { promotePairSetImage } from "./promote";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;
let characterId: string;
let pairSetId: string;
let storage: StorageAdapter;
const files = new Map<string, Buffer>();

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
  characterId = createCharacter(db, { name: "Rin", slug: "rin" }).id;
  const taskId = createSingleGenerationTask(db, {
    characterId,
    seedStrategy: { kind: "fixed", seed: 1 },
  }).id;
  const pair = createPairSet(db, {
    taskId,
    characterId,
    seed: 7,
    animeImagePath: "raw/a-7.png",
    realImagePath: "raw/r-7.jpg",
  });
  pairSetId = pair.id;

  files.clear();
  files.set("raw/a-7.png", Buffer.from("anime-bytes"));
  files.set("raw/r-7.jpg", Buffer.from("real-bytes"));

  storage = {
    put: vi.fn(async (key, data) => {
      files.set(key, data);
    }),
    get: vi.fn(async (key) => {
      const buf = files.get(key);
      if (!buf) throw new Error(`missing ${key}`);
      return buf;
    }),
    exists: vi.fn(async (key) => files.has(key)),
    delete: vi.fn(async (key) => {
      files.delete(key);
    }),
    list: vi.fn(async () => [...files.keys()]),
    publicUrl: (k) => k,
    localPath: () => null,
  };
});

describe("promotePairSetImage", () => {
  it("copies anime side to characters/ as primary anchor when none exists", async () => {
    const result = await promotePairSetImage(db, storage, {
      pairSetId,
      side: "anime",
      kind: "anchor",
    });

    expect(result.created).toBe(true);
    expect(result.image.isPrimary).toBe(true);
    expect(result.image.kind).toBe("anchor");
    expect(result.image.form).toBe("anime");
    expect(result.image.filePath).toMatch(
      /^characters\/[^/]+\/anchors\/anime\/.+\.png$/,
    );
    expect(result.image.filePath.startsWith("/")).toBe(false);
    expect(files.get(result.image.filePath)?.toString()).toBe("anime-bytes");
    expect(storage.put).toHaveBeenCalledOnce();
  });

  it("sets isPrimary false when an anchor for that form already exists", async () => {
    await promotePairSetImage(db, storage, {
      pairSetId,
      side: "real",
      kind: "anchor",
    });

    const taskId = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 2 },
    }).id;
    const other = createPairSet(db, {
      taskId,
      characterId,
      seed: 8,
      animeImagePath: "raw/a-8.png",
      realImagePath: "raw/r-8.jpg",
    });
    files.set("raw/r-8.jpg", Buffer.from("real-2"));

    const second = await promotePairSetImage(db, storage, {
      pairSetId: other.id,
      side: "real",
      kind: "anchor",
    });

    expect(second.created).toBe(true);
    expect(second.image.isPrimary).toBe(false);
    const list = listCharacterImages(db, characterId).filter(
      (i) => i.kind === "anchor" && i.form === "real",
    );
    expect(list).toHaveLength(2);
    expect(list.filter((i) => i.isPrimary)).toHaveLength(1);
  });

  it("promotes faceid_ref and is idempotent for same pair+side+kind", async () => {
    const first = await promotePairSetImage(db, storage, {
      pairSetId,
      side: "real",
      kind: "faceid_ref",
    });
    expect(first.created).toBe(true);
    expect(first.image.kind).toBe("faceid_ref");
    expect(first.image.form).toBe("real");
    expect(first.image.isPrimary).toBe(false);
    expect(first.image.filePath).toMatch(
      /^characters\/[^/]+\/faceid\/real\/.+\.jpg$/,
    );

    const putCalls = vi.mocked(storage.put).mock.calls.length;
    const again = await promotePairSetImage(db, storage, {
      pairSetId,
      side: "real",
      kind: "faceid_ref",
    });
    expect(again.created).toBe(false);
    expect(again.image.id).toBe(first.image.id);
    expect(vi.mocked(storage.put).mock.calls.length).toBe(putCalls);
    expect(
      listCharacterImages(db, characterId).filter((i) => i.kind === "faceid_ref"),
    ).toHaveLength(1);
  });

  it("allows different sides and kinds from the same pair", async () => {
    await promotePairSetImage(db, storage, {
      pairSetId,
      side: "anime",
      kind: "anchor",
    });
    await promotePairSetImage(db, storage, {
      pairSetId,
      side: "real",
      kind: "anchor",
    });
    await promotePairSetImage(db, storage, {
      pairSetId,
      side: "real",
      kind: "faceid_ref",
    });
    expect(listCharacterImages(db, characterId)).toHaveLength(3);
  });
});
