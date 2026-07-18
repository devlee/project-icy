import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createCharacter } from "../characters/characters";
import { createPairSet, reviewPairSet } from "../generation/pair-sets";
import { createSingleGenerationTask } from "../generation/tasks";
import {
  AssetError,
  createAsset,
  listApprovedForPost,
  listAssetsByPairSet,
  markPairPostStatus,
} from "./assets";

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
    seed: 9,
    animeImagePath: "raw/a.png",
    realImagePath: "raw/r.png",
  });
  reviewPairSet(db, pair.id, { status: "approved", rating: 5 });
  pairSetId = pair.id;
});

describe("assets / post queue", () => {
  it("lists approved raw pairs and creates assets", () => {
    const pending = listApprovedForPost(db, { postProcessStatus: "raw" });
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe(pairSetId);
    expect(pending[0]!.assetCount).toBe(0);

    createAsset(db, {
      pairSetId,
      kind: "composite",
      platform: "generic",
      filePath: "finished/x/composite.png",
      width: 100,
      height: 100,
    });
    expect(listAssetsByPairSet(db, pairSetId)).toHaveLength(1);

    createAsset(db, {
      pairSetId,
      kind: "composite",
      platform: "generic",
      filePath: "finished/x/composite.png",
      width: 100,
      height: 100,
    });
    expect(listAssetsByPairSet(db, pairSetId)).toHaveLength(1);

    markPairPostStatus(db, pairSetId, "composed");
    expect(listApprovedForPost(db, { postProcessStatus: "raw" })).toHaveLength(0);
    expect(listApprovedForPost(db, { postProcessStatus: "composed" })[0]!.assetCount).toBe(1);
  });

  it("rejects invalid platform and missing pair", () => {
    expect(() =>
      createAsset(db, {
        pairSetId: "missing",
        kind: "composite",
        platform: "generic",
        filePath: "a.png",
        width: 1,
        height: 1,
      }),
    ).toThrow(AssetError);
  });
});
