import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createCharacter } from "../characters/characters";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createPairSet, reviewPairSet } from "../generation/pair-sets";
import {
  createSingleGenerationTask,
  markTaskDone,
  markTaskRunning,
} from "../generation/tasks";
import { createAsset, markPairPostStatus } from "../post/assets";
import { createPublishPlan } from "../publish/plans";
import { getStudioOverview } from "./overview";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
});

function createComposedPair(characterId: string, seed: number) {
  const task = createSingleGenerationTask(db, {
    characterId,
    seedStrategy: { kind: "fixed", seed },
  });
  markTaskRunning(db, task.id);
  markTaskDone(db, task.id, []);
  const pair = createPairSet(db, {
    taskId: task.id,
    characterId,
    seed,
    animeImagePath: `raw/${seed}/anime.png`,
    realImagePath: `raw/${seed}/real.png`,
  });
  reviewPairSet(db, pair.id, { status: "approved", rating: 5 });
  markPairPostStatus(db, pair.id, "composed");
  const asset = createAsset(db, {
    pairSetId: pair.id,
    kind: "composite",
    platform: "generic",
    filePath: `finished/${pair.id}/composite.png`,
    watermarked: true,
    width: 200,
    height: 100,
  });
  return { pair, asset };
}

describe("getStudioOverview", () => {
  it("returns an empty real-data summary", () => {
    expect(
      getStudioOverview(db, { now: new Date(2026, 6, 18, 9), dailyBurn: 2 }),
    ).toMatchObject({
      today: "2026-07-18",
      activeTaskCount: 0,
      activeTasks: [],
      todayReviewedCount: 0,
      inventory: { readyPacks: 0, dailyBurn: 2, days: 0 },
      characterStock: [],
      todayPlans: [],
      review: { pending: 0, approved: 0, rejected: 0, hold: 0, total: 0 },
    });
  });

  it("summarizes active work, today's review, inventory, and publish plans", () => {
    const character = createCharacter(db, { name: "凛冬 Rin", slug: "rin" });
    const stock = createComposedPair(character.id, 11);
    const scheduled = createComposedPair(character.id, 12);
    createPublishPlan(db, {
      date: new Date().toLocaleDateString("en-CA"),
      platform: "x",
      caption: "今日对照组",
      assetIds: [scheduled.asset.id],
    });

    createSingleGenerationTask(db, {
      characterId: character.id,
      seedStrategy: { kind: "fixed", seed: 21 },
    });
    const running = createSingleGenerationTask(db, {
      characterId: character.id,
      seedStrategy: { kind: "fixed", seed: 22 },
    });
    markTaskRunning(db, running.id);

    const overview = getStudioOverview(db, { now: new Date(), dailyBurn: 1 });
    expect(overview.activeTaskCount).toBe(2);
    expect(overview.activeTasks).toHaveLength(2);
    expect(overview.activeTasks.map((task) => task.status).sort()).toEqual([
      "queued",
      "running",
    ]);
    expect(overview.todayReviewedCount).toBe(2);
    expect(overview.inventory).toMatchObject({ readyPacks: 1, days: 1 });
    expect(overview.characterStock).toEqual([
      {
        characterId: character.id,
        characterName: "凛冬 Rin",
        count: 1,
      },
    ]);
    expect(overview.todayPlans).toEqual([
      expect.objectContaining({
        platform: "x",
        status: "ready",
        caption: "今日对照组",
        previewPath: scheduled.asset.filePath,
      }),
    ]);
    expect(overview.review).toMatchObject({ approved: 2, total: 2 });
    expect(stock.pair.id).not.toBe(scheduled.pair.id);
  });
});
