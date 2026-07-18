import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createCharacter } from "../characters/characters";
import type { GenerationAdapter } from "../ports/generation";
import type { StorageAdapter } from "../ports/storage";
import { expandSeeds } from "./seeds";
import { runSingleGenerationTask } from "./run-single";
import {
  cancelGenerationTask,
  createSingleGenerationTask,
  GenerationTaskError,
  getGenerationTask,
  listGenerationTasks,
  markTaskFailed,
  markTaskRunning,
  retryGenerationTask,
} from "./tasks";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;
let characterId: string;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
  characterId = createCharacter(db, {
    name: "凛冬 Rin",
    slug: "rin",
    tagline: "cold silver hair",
    profile: "研究备注不应进入 prompt",
  }).id;
});

describe("expandSeeds", () => {
  it("returns fixed seed and clamps random count", () => {
    expect(expandSeeds({ kind: "fixed", seed: 42 })).toEqual([42]);
    expect(expandSeeds({ kind: "random", count: 3 })).toHaveLength(3);
    expect(expandSeeds({ kind: "random", count: 100 })).toHaveLength(24);
  });
});

describe("createSingleGenerationTask", () => {
  it("creates a queued single task", () => {
    const task = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 7 },
      extraPrompt: "silver hair",
    });
    expect(task).toMatchObject({
      type: "single",
      status: "queued",
      characterId,
      params: {
        animeWorkflowId: "anime-txt2img-stub",
        realWorkflowId: "",
        extraPrompt: "silver hair",
        seedStrategy: { kind: "fixed", seed: 7 },
      },
    });
  });

  it("rejects missing character and bad count", () => {
    expect(() =>
      createSingleGenerationTask(db, {
        characterId: "missing",
        seedStrategy: { kind: "fixed", seed: 1 },
      }),
    ).toThrow(GenerationTaskError);

    expect(() =>
      createSingleGenerationTask(db, {
        characterId,
        seedStrategy: { kind: "random", count: 0 },
      }),
    ).toThrow(/1–24/);
  });
});

describe("list / cancel", () => {
  it("lists with character name and cancels queued only", () => {
    const a = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 1 },
    });
    const list = listGenerationTasks(db);
    expect(list[0]).toMatchObject({ id: a.id, characterName: "凛冬 Rin" });

    cancelGenerationTask(db, a.id);
    expect(getGenerationTask(db, a.id)?.status).toBe("cancelled");

    const b = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 2 },
    });
    markTaskRunning(db, b.id);
    expect(() => cancelGenerationTask(db, b.id)).toThrow(/排队中/);
  });
});

describe("retryGenerationTask", () => {
  it("re-queues a failed task and clears error/outputs", () => {
    const task = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 3 },
    });
    markTaskRunning(db, task.id);
    markTaskFailed(db, task.id, "boom", ["raw/tasks/x/00.png"]);

    const retried = retryGenerationTask(db, task.id);
    expect(retried).toMatchObject({
      status: "queued",
      error: null,
      startedAt: null,
      finishedAt: null,
    });
    expect(retried.params.outputKeys).toBeUndefined();
    expect(retried.params.seedStrategy).toEqual({ kind: "fixed", seed: 3 });
  });

  it("rejects retry of running tasks", () => {
    const task = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 4 },
    });
    markTaskRunning(db, task.id);
    expect(() => retryGenerationTask(db, task.id)).toThrow(/失败或已取消/);
  });
});

describe("runSingleGenerationTask", () => {
  it("runs adapter, stores images, marks done", async () => {
    const task = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 99 },
      extraPrompt: "1girl",
    });

    const put = vi.fn(async () => undefined);
    const storage: StorageAdapter = {
      put,
      get: async () => Buffer.from([]),
      exists: async () => false,
      delete: async () => undefined,
      list: async () => [],
      publicUrl: (k) => k,
      localPath: () => null,
    };

    const generation: GenerationAdapter = {
      ping: async () => ({ ok: true }),
      run: async (req) => {
        const text = (req.workflow["6"] as { inputs: { text: string } }).inputs.text;
        expect(text).toContain("cold silver hair");
        expect(text).toContain("1girl");
        expect(text).not.toContain("研究备注");
        expect(req.inputImages).toHaveLength(0);
        return {
          images: [{ filename: "out.png", data: Buffer.from([1, 2, 3]) }],
          durationMs: 12,
        };
      },
    };

    await runSingleGenerationTask(task.id, { db, generation, storage });

    const done = getGenerationTask(db, task.id)!;
    expect(done.status).toBe("done");
    expect(done.params.outputKeys?.[0]).toMatch(/^raw\/tasks\//);
    expect(put).toHaveBeenCalledOnce();
  });

  it("uses IP-Adapter workflow when anime anchor exists", async () => {
    const { addCharacterImage } = await import("../characters/images");
    addCharacterImage(db, {
      characterId,
      kind: "anchor",
      form: "anime",
      filePath: "characters/rin/ref.png",
      isPrimary: true,
    });

    const task = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 1 },
    });

    const refBytes = Buffer.from([9, 9, 9]);
    const storage: StorageAdapter = {
      put: async () => undefined,
      get: async (key) => {
        expect(key).toBe("characters/rin/ref.png");
        return refBytes;
      },
      exists: async () => true,
      delete: async () => undefined,
      list: async () => [],
      publicUrl: (k) => k,
      localPath: () => null,
    };

    const generation: GenerationAdapter = {
      ping: async () => ({ ok: true }),
      run: async (req) => {
        expect(req.inputImages).toEqual([{ name: `icy-ref-${task.id}.png`, data: refBytes }]);
        expect(
          (req.workflow["10"] as { inputs: { image: string } }).inputs.image,
        ).toBe(`icy-ref-${task.id}.png`);
        expect(req.workflow["12"]).toBeTruthy();
        return {
          images: [{ filename: "out.png", data: Buffer.from([1]) }],
          durationMs: 1,
        };
      },
    };

    await runSingleGenerationTask(task.id, { db, generation, storage });
    expect(getGenerationTask(db, task.id)?.status).toBe("done");
  });

  it("marks failed when adapter throws", async () => {
    const task = createSingleGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 1 },
    });

    const storage: StorageAdapter = {
      put: async () => undefined,
      get: async () => Buffer.from([]),
      exists: async () => false,
      delete: async () => undefined,
      list: async () => [],
      publicUrl: (k) => k,
      localPath: () => null,
    };

    const generation: GenerationAdapter = {
      ping: async () => ({ ok: true }),
      run: async () => {
        throw new Error("cloud boom");
      },
    };

    await runSingleGenerationTask(task.id, { db, generation, storage });
    const failed = getGenerationTask(db, task.id)!;
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatch(/cloud boom/);
  });
});
