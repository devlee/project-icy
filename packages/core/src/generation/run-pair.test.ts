import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { factors, pairSets } from "../db/schema";
import { createCharacter } from "../characters/characters";
import { addCharacterImage } from "../characters/images";
import type { GenerationAdapter } from "../ports/generation";
import type { StorageAdapter } from "../ports/storage";
import { listPairSets } from "./pair-sets";
import { runPairGenerationTask } from "./run-pair";
import {
  createBatchGenerationTask,
  createPairGenerationTask,
  getGenerationTask,
} from "./tasks";
import { createSeries } from "./series";

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
  }).id;
});

describe("createPairGenerationTask", () => {
  it("creates a queued pair task with default pairConfig workflows", () => {
    const task = createPairGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 7 },
    });
    expect(task.type).toBe("pair");
    expect(task.status).toBe("queued");
    expect(task.params.animeWorkflowId).toBe("anime-txt2img-ipadapter");
    expect(task.params.realWorkflowId).toBe("real-txt2img-ipadapter");
  });
});

describe("runPairGenerationTask", () => {
  it("runs anime then real with shared seed and writes PairSet", async () => {
    addCharacterImage(db, {
      characterId,
      kind: "anchor",
      form: "anime",
      filePath: "characters/rin/a.png",
      isPrimary: true,
    });
    addCharacterImage(db, {
      characterId,
      kind: "anchor",
      form: "real",
      filePath: "characters/rin/r.png",
      isPrimary: true,
    });

    const task = createPairGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 11 },
      extraPrompt: "standing",
    });

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

    const seeds: number[] = [];
    const forms: string[] = [];
    const generation: GenerationAdapter = {
      ping: async () => ({ ok: true }),
      run: async (req) => {
        const seed = (req.workflow["3"] as { inputs: { seed: number } }).inputs.seed;
        seeds.push(seed);
        const hasIp = Boolean(req.workflow["12"]);
        forms.push(hasIp ? (req.inputImages[0]?.name.includes("anime") ? "anime" : "real") : "plain");
        const text = (req.workflow["6"] as { inputs: { text: string } }).inputs.text;
        expect(text).toContain("cold silver hair");
        expect(text).toContain("standing");
        return {
          images: [{ filename: "out.png", data: Buffer.from([1]) }],
          durationMs: 1,
        };
      },
    };

    await runPairGenerationTask(task.id, { db, generation, storage });

    const done = getGenerationTask(db, task.id)!;
    expect(done.status).toBe("done");
    expect(seeds).toEqual([11, 11]);
    expect(forms).toEqual(["anime", "real"]);
    expect(done.params.outputKeys).toHaveLength(2);
    expect(done.params.outputKeys?.[0]).toMatch(/\/anime\.png$/);
    expect(done.params.outputKeys?.[1]).toMatch(/\/real\.png$/);

    const pairs = listPairSets(db);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.seed).toBe(11);
    expect(pairs[0]!.reviewStatus).toBe("pending");
    expect(put).toHaveBeenCalledTimes(2);
  });

  it("uses stub real workflow when no real anchor", async () => {
    const task = createPairGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 3 },
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

    let realHadIp = false;
    const generation: GenerationAdapter = {
      ping: async () => ({ ok: true }),
      run: async (req) => {
        if (!req.workflow["12"]) {
          // stub path for both without anchors
        } else {
          realHadIp = true;
        }
        return {
          images: [{ filename: "out.png", data: Buffer.from([1]) }],
          durationMs: 1,
        };
      },
    };

    await runPairGenerationTask(task.id, { db, generation, storage });
    expect(getGenerationTask(db, task.id)?.status).toBe("done");
    expect(realHadIp).toBe(false);
    expect(listPairSets(db)).toHaveLength(1);
  });

  it("skips a seed that already has a PairSet when retrying", async () => {
    const task = createPairGenerationTask(db, {
      characterId,
      seedStrategy: { kind: "fixed", seed: 77 },
    });
    const { createPairSet } = await import("./pair-sets");
    createPairSet(db, {
      taskId: task.id,
      characterId,
      seed: 77,
      animeImagePath: "raw/existing/anime.png",
      realImagePath: "raw/existing/real.png",
    });
    const run = vi.fn(async () => ({
      images: [{ filename: "out.png", data: Buffer.from([1]) }],
      durationMs: 1,
    }));

    await runPairGenerationTask(task.id, {
      db,
      generation: { ping: async () => ({ ok: true }), run },
      storage: {
        put: async () => undefined,
        get: async () => Buffer.from([]),
        exists: async () => true,
        delete: async () => undefined,
        list: async () => [],
        publicUrl: (key) => key,
        localPath: () => null,
      },
    });

    expect(run).not.toHaveBeenCalled();
    expect(listPairSets(db)).toHaveLength(1);
    expect(getGenerationTask(db, task.id)?.params.outputKeys).toEqual([
      "raw/existing/anime.png",
      "raw/existing/real.png",
    ]);
  });

  it("runs a batch with factor prompts and preserves its series", async () => {
    db.insert(factors)
      .values({
        id: "factor-scene",
        category: "scene",
        name: "海边",
        promptFragment: "sunny beach",
        negativeFragment: "crowd",
      })
      .run();
    const seriesRow = createSeries(db, {
      characterId,
      name: "夏日系列",
      batchConfig: { factorIds: ["factor-scene"], perBatch: 1 },
    });
    const task = createBatchGenerationTask(db, { seriesId: seriesRow.id });

    const storage: StorageAdapter = {
      put: async () => undefined,
      get: async () => Buffer.from([]),
      exists: async () => false,
      delete: async () => undefined,
      list: async () => [],
      publicUrl: (key) => key,
      localPath: () => null,
    };
    const generation: GenerationAdapter = {
      ping: async () => ({ ok: true }),
      run: async (request) => {
        const positive = (request.workflow["6"] as { inputs: { text: string } }).inputs.text;
        const negative = (request.workflow["7"] as { inputs: { text: string } }).inputs.text;
        expect(positive).toContain("sunny beach");
        expect(negative).toContain("crowd");
        return {
          images: [{ filename: "out.png", data: Buffer.from([1]) }],
          durationMs: 1,
        };
      },
    };

    await runPairGenerationTask(task.id, { db, generation, storage });

    const pair = listPairSets(db)[0]!;
    expect(pair.taskId).toBe(task.id);
    expect(db.select().from(pairSets).get()?.seriesId).toBe(seriesRow.id);
    expect(getGenerationTask(db, task.id)?.status).toBe("done");
  });
});
