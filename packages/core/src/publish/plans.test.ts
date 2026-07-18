import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createCharacter, updateCharacter } from "../characters/characters";
import { createPairSet, reviewPairSet } from "../generation/pair-sets";
import { createSingleGenerationTask } from "../generation/tasks";
import { createAsset, markPairPostStatus } from "../post/assets";
import {
  createPublishPlan,
  getInventoryStats,
  listInventoryPacks,
  listPublishPlans,
  markPlanPublished,
  pickAssetsForPlatform,
  PublishPlanError,
  todayLocalDate,
  updatePublishPlan,
} from "./plans";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;
let pairSetId: string;
let characterId: string;
let assetXhs: string;
let assetComposite: string;

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
    animeImagePath: "raw/a.png",
    realImagePath: "raw/r.png",
  });
  reviewPairSet(db, pair.id, { status: "approved", rating: 5 });
  markPairPostStatus(db, pair.id, "composed");
  pairSetId = pair.id;

  assetComposite = createAsset(db, {
    pairSetId,
    kind: "composite",
    platform: "generic",
    filePath: "finished/p/composite.png",
    width: 200,
    height: 100,
  }).id;
  assetXhs = createAsset(db, {
    pairSetId,
    kind: "platform-sized",
    platform: "xiaohongshu",
    filePath: "finished/p/xhs.png",
    width: 1080,
    height: 1440,
  }).id;
});

describe("publish plans", () => {
  it("creates plan with assets and lists by date", () => {
    const date = todayLocalDate();
    const plan = createPublishPlan(db, {
      date,
      platform: "xiaohongshu",
      caption: "hello",
      hashtags: "#icy",
      assetIds: pickAssetsForPlatform(db, pairSetId, "xiaohongshu"),
    });
    expect(plan.status).toBe("ready");
    expect(plan.assets.map((a) => a.id)).toContain(assetXhs);
    expect(plan.assets.map((a) => a.id)).not.toContain(assetComposite);

    const today = listPublishPlans(db, { date });
    expect(today).toHaveLength(1);
    expect(today[0]!.caption).toBe("hello");
  });

  it("marks published and updates caption", () => {
    const plan = createPublishPlan(db, {
      date: "2026-07-18",
      platform: "x",
      assetIds: [assetComposite],
    });
    updatePublishPlan(db, plan.id, { caption: "updated" });
    const published = markPlanPublished(db, plan.id, { notes: "https://x.com/1" });
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeTruthy();
    expect(published.notes).toContain("x.com");
    expect(published.caption).toBe("updated");

    expect(() => markPlanPublished(db, plan.id)).toThrow(PublishPlanError);
  });

  it("inventory packs and stats", () => {
    const packs = listInventoryPacks(db);
    expect(packs).toHaveLength(1);
    expect(packs[0]!.assetCount).toBe(2);
    const stats = getInventoryStats(db, { dailyBurn: 1 });
    expect(stats.readyPacks).toBe(1);
    expect(stats.days).toBe(1);
  });

  it("removes packs from available inventory once scheduled", () => {
    createPublishPlan(db, {
      date: "2026-07-18",
      platform: "xiaohongshu",
      assetIds: [assetXhs],
    });
    expect(listInventoryPacks(db)).toHaveLength(0);
    expect(getInventoryStats(db)).toMatchObject({ readyPacks: 0, days: 0 });
  });

  it("rejects bad date or empty assets", () => {
    expect(() =>
      createPublishPlan(db, {
        date: "18-07-2026",
        platform: "x",
        assetIds: [assetComposite],
      }),
    ).toThrow(/YYYY-MM-DD/);
    expect(() =>
      createPublishPlan(db, {
        date: "2026-07-18",
        platform: "x",
        assetIds: [],
      }),
    ).toThrow(/素材/);
  });

  it("keeps IP reference assets out of inventory and blocks publishing", () => {
    const plan = createPublishPlan(db, {
      date: "2026-07-18",
      platform: "x",
      assetIds: [assetComposite],
    });

    updateCharacter(db, characterId, {
      origin: "ip_reference",
      ipSource: "研究作品",
    });

    expect(listInventoryPacks(db)).toHaveLength(0);
    expect(getInventoryStats(db).readyPacks).toBe(0);
    expect(() => pickAssetsForPlatform(db, pairSetId, "x")).toThrow(/仅限研究/);
    expect(() =>
      createPublishPlan(db, {
        date: "2026-07-19",
        platform: "x",
        assetIds: [assetComposite],
      }),
    ).toThrow(/仅限研究/);
    expect(() => markPlanPublished(db, plan.id)).toThrow(/仅限研究/);
    expect(() => updatePublishPlan(db, plan.id, { status: "published" })).toThrow(
      /仅限研究/,
    );
  });
});
