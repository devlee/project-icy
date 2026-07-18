import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createCharacter } from "../characters/characters";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createPairSet, reviewPairSet } from "../generation/pair-sets";
import { createSingleGenerationTask } from "../generation/tasks";
import type { ImageComposePort } from "../ports/image-compose";
import type { StorageAdapter } from "../ports/storage";
import { listAssetsByPairSet } from "./assets";
import { runPostTask } from "./run-task";
import {
  createPostTask,
  failInterruptedPostTasks,
  getLatestPostTaskForPairSet,
  getPostTask,
  listQueuedPostTasks,
  markPostTaskRunning,
  retryPostTask,
} from "./tasks";

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
  const generationTask = createSingleGenerationTask(db, {
    characterId,
    seedStrategy: { kind: "fixed", seed: 1 },
  });
  const pair = createPairSet(db, {
    taskId: generationTask.id,
    characterId,
    seed: 1,
    animeImagePath: "raw/a.png",
    realImagePath: "raw/r.png",
  });
  reviewPairSet(db, pair.id, { status: "approved" });
  pairSetId = pair.id;
});

describe("post tasks", () => {
  it("creates one active task per PairSet and recovers interrupted work", () => {
    const first = createPostTask(db, { pairSetId });
    expect(createPostTask(db, { pairSetId }).id).toBe(first.id);
    expect(listQueuedPostTasks(db)).toHaveLength(1);

    markPostTaskRunning(db, first.id);
    expect(failInterruptedPostTasks(db)).toEqual([first.id]);
    expect(getPostTask(db, first.id)).toMatchObject({
      status: "failed",
      error: expect.stringContaining("worker 已重启"),
    });
    expect(retryPostTask(db, first.id).status).toBe("queued");
  });

  it("runs compose through the persistent task and records outputs", async () => {
    const task = createPostTask(db, { pairSetId });
    const storage: StorageAdapter = {
      put: async () => undefined,
      get: async (key) => Buffer.from(key),
      exists: async () => true,
      delete: async () => undefined,
      list: async () => [],
      publicUrl: (key) => key,
      localPath: () => null,
    };
    const compose: ImageComposePort = {
      composeSideBySide: async () => ({
        composite: { data: Buffer.from("c"), width: 2, height: 1 },
        platforms: [],
      }),
    };

    await runPostTask(task.id, { db, storage, compose });

    expect(getPostTask(db, task.id)).toMatchObject({
      status: "done",
      outputKeys: [`finished/${pairSetId}/composite.png`],
    });
    expect(getLatestPostTaskForPairSet(db, pairSetId)?.id).toBe(task.id);
    expect(listAssetsByPairSet(db, pairSetId)).toHaveLength(1);
  });

  it("stores compose failures for the UI", async () => {
    const task = createPostTask(db, { pairSetId });
    await runPostTask(task.id, {
      db,
      storage: {
        put: async () => undefined,
        get: async () => {
          throw new Error("missing image");
        },
        exists: async () => false,
        delete: async () => undefined,
        list: async () => [],
        publicUrl: (key) => key,
        localPath: () => null,
      },
      compose: {
        composeSideBySide: async () => ({
          composite: { data: Buffer.from([]), width: 1, height: 1 },
          platforms: [],
        }),
      },
    });

    expect(getPostTask(db, task.id)).toMatchObject({
      status: "failed",
      error: expect.stringContaining("无法读取成对原图"),
    });
  });
});
