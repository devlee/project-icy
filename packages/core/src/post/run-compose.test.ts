import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createCharacter } from "../characters/characters";
import { createPairSet, getPairSet, reviewPairSet } from "../generation/pair-sets";
import { createSingleGenerationTask } from "../generation/tasks";
import type { ImageComposePort } from "../ports/image-compose";
import type { StorageAdapter } from "../ports/storage";
import { listAssetsByPairSet } from "./assets";
import { runComposePairSet } from "./run-compose";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;
let pairSetId: string;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
  const characterId = createCharacter(db, { name: "Rin", slug: "rin" }).id;
  const taskId = createSingleGenerationTask(db, {
    characterId,
    seedStrategy: { kind: "fixed", seed: 1 },
  }).id;
  const pair = createPairSet(db, {
    taskId,
    characterId,
    seed: 3,
    animeImagePath: "raw/a.png",
    realImagePath: "raw/r.png",
  });
  reviewPairSet(db, pair.id, { status: "approved" });
  pairSetId = pair.id;
});

describe("runComposePairSet", () => {
  it("writes finished assets and marks composed", async () => {
    const put = vi.fn(async () => undefined);
    const storage: StorageAdapter = {
      put,
      get: async (key) => Buffer.from(key),
      exists: async () => true,
      delete: async () => undefined,
      list: async () => [],
      publicUrl: (k) => k,
      localPath: () => null,
    };

    const compose: ImageComposePort = {
      enhanceImage: async ({ image }) => ({ data: image, width: 8, height: 8 }),
      composeSideBySide: async () => ({
        composite: { data: Buffer.from("c"), width: 200, height: 100 },
        platforms: [
          {
            platform: "xiaohongshu",
            label: "3x4",
            data: Buffer.from("xhs"),
            width: 1080,
            height: 1440,
          },
          {
            platform: "x",
            label: "16x9",
            data: Buffer.from("x"),
            width: 1600,
            height: 900,
          },
          {
            platform: "generic",
            label: "1x1",
            data: Buffer.from("sq"),
            width: 1080,
            height: 1080,
          },
          {
            platform: "bilibili",
            label: "16x10",
            data: Buffer.from("b"),
            width: 1920,
            height: 1200,
          },
        ],
      }),
    };

    const keys = await runComposePairSet(pairSetId, { db, storage, compose });
    expect(keys.length).toBe(5);
    expect(getPairSet(db, pairSetId)?.postProcessStatus).toBe("composed");
    expect(listAssetsByPairSet(db, pairSetId)).toHaveLength(5);
    expect(put).toHaveBeenCalled();
  });

  it("rejects non-approved pairs", async () => {
    const characterId = createCharacter(db, { name: "Mei", slug: "mei" }).id;
    const taskId = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 2 },
    }).id;
    const pending = createPairSet(db, {
      taskId,
      characterId,
      seed: 1,
      animeImagePath: "a.png",
      realImagePath: "r.png",
    });

    await expect(
      runComposePairSet(pending.id, {
        db,
        storage: {
          put: async () => undefined,
          get: async () => Buffer.from([]),
          exists: async () => false,
          delete: async () => undefined,
          list: async () => [],
          publicUrl: (k) => k,
          localPath: () => null,
        },
        compose: {
          enhanceImage: async ({ image }) => ({ data: image, width: 8, height: 8 }),
          composeSideBySide: async () => ({
            composite: { data: Buffer.from([]), width: 1, height: 1 },
            platforms: [],
          }),
        },
      }),
    ).rejects.toThrow(/已通过/);
  });
});
