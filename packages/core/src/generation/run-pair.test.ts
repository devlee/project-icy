import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createCharacter } from "../characters/characters";
import { addCharacterImage } from "../characters/images";
import type { GenerationAdapter } from "../ports/generation";
import type { StorageAdapter } from "../ports/storage";
import { listPairSets } from "./pair-sets";
import { runPairGenerationTask } from "./run-pair";
import {
  createPairGenerationTask,
  getGenerationTask,
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
});
