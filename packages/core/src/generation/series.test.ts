import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createCharacter } from "../characters/characters";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { factors, poses } from "../db/schema";
import {
  createSeries,
  deleteSeries,
  getSeries,
  listSeries,
  SeriesError,
  updateSeries,
} from "./series";
import { createBatchGenerationTask, hasActiveBatchTaskForSeries } from "./tasks";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;
let characterId: string;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
  characterId = createCharacter(db, { name: "凛冬 Rin", slug: "rin" }).id;
  db.insert(factors)
    .values({
      id: "factor-scene",
      category: "scene",
      name: "海边",
      promptFragment: "sunny beach",
      negativeFragment: "crowd",
    })
    .run();
  db.insert(poses)
    .values({ id: "pose-standing", name: "站立", filePath: "poses/standing.png" })
    .run();
});

describe("series", () => {
  it("creates, lists, and updates a validated batch series", () => {
    const created = createSeries(db, {
      characterId,
      name: " 夏日系列 ",
      theme: " 海边 ",
      batchConfig: {
        factorIds: ["factor-scene", "factor-scene"],
        poseIds: ["pose-standing"],
        perBatch: 3,
      },
      scheduleCron: " 0 4 * * * ",
    });

    expect(created).toMatchObject({
      characterId,
      name: "夏日系列",
      theme: "海边",
      scheduleCron: "0 4 * * *",
      active: true,
      batchConfig: {
        factorIds: ["factor-scene"],
        poseIds: ["pose-standing"],
        perBatch: 3,
      },
    });
    expect(listSeries(db, { active: true })).toHaveLength(1);

    const updated = updateSeries(db, created.id, { active: false, scheduleCron: null });
    expect(updated.active).toBe(false);
    expect(updated.scheduleCron).toBeNull();
  });

  it("rejects invalid references and batch sizes", () => {
    expect(() =>
      createSeries(db, {
        characterId,
        name: "bad",
        batchConfig: { factorIds: ["missing"], perBatch: 1 },
      }),
    ).toThrow(SeriesError);
    expect(() =>
      createSeries(db, {
        characterId,
        name: "bad count",
        batchConfig: { factorIds: [], perBatch: 25 },
      }),
    ).toThrow(/1–24/);
  });

  it("prevents deleting a series once generation tasks reference it", () => {
    const row = createSeries(db, {
      characterId,
      name: "夏日系列",
      batchConfig: { factorIds: ["factor-scene"], perBatch: 1 },
    });
    createBatchGenerationTask(db, { seriesId: row.id });

    expect(() => deleteSeries(db, row.id)).toThrow(/生成任务/);
    expect(getSeries(db, row.id)).not.toBeNull();
  });
});

describe("createBatchGenerationTask", () => {
  it("persists a low-priority batch task from the series configuration", () => {
    const row = createSeries(db, {
      characterId,
      name: "夏日系列",
      batchConfig: {
        factorIds: ["factor-scene"],
        poseIds: ["pose-standing"],
        perBatch: 2,
      },
    });

    const task = createBatchGenerationTask(db, { seriesId: row.id });
    expect(hasActiveBatchTaskForSeries(db, row.id)).toBe(true);
    expect(task).toMatchObject({
      type: "batch",
      status: "queued",
      characterId,
      seriesId: row.id,
      priority: 0,
      params: {
        seedStrategy: { kind: "random", count: 2 },
        factorIds: ["factor-scene"],
        poseId: "pose-standing",
      },
    });
  });
});
