import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, migrateDb, type IcyDb } from "./client";
import {
  characters,
  characterImages,
  factors,
  generationTasks,
  pairSets,
  type GenerationParams,
} from "./schema";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

const params: GenerationParams = {
  seedStrategy: { kind: "random", count: 4 },
  factorIds: [],
  animeWorkflowId: "anime-v1",
  realWorkflowId: "real-v1",
};

let db: IcyDb;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
});

describe("migrations", () => {
  it("provision a usable schema from checked-in SQL files", () => {
    expect(db.select().from(characters).all()).toEqual([]);
  });
});

describe("characters", () => {
  it("applies defaults for status, profile and timestamps", () => {
    db.insert(characters).values({ id: "c1", name: "Icy", slug: "icy" }).run();

    const row = db.select().from(characters).get();
    expect(row).toMatchObject({ status: "draft", profile: "", tagline: "" });
    expect(row!.createdAt).toBeInstanceOf(Date);
  });

  it("rejects duplicate slugs", () => {
    db.insert(characters).values({ id: "c1", name: "A", slug: "icy" }).run();
    expect(() =>
      db.insert(characters).values({ id: "c2", name: "B", slug: "icy" }).run(),
    ).toThrow(/UNIQUE/);
  });

  it("cascades deletion to reference images", () => {
    db.insert(characters).values({ id: "c1", name: "Icy", slug: "icy" }).run();
    db.insert(characterImages)
      .values({ id: "i1", characterId: "c1", kind: "anchor", form: "anime", filePath: "a.png" })
      .run();

    db.delete(characters).where(eq(characters.id, "c1")).run();
    expect(db.select().from(characterImages).all()).toEqual([]);
  });
});

describe("generation flow", () => {
  beforeEach(() => {
    db.insert(characters).values({ id: "c1", name: "Icy", slug: "icy" }).run();
    db.insert(generationTasks)
      .values({ id: "t1", type: "pair", characterId: "c1", params })
      .run();
  });

  it("round-trips JSON generation params", () => {
    const task = db.select().from(generationTasks).get();
    expect(task!.params).toEqual(params);
    expect(task!.status).toBe("queued");
  });

  it("rejects tasks referencing a missing character", () => {
    expect(() =>
      db
        .insert(generationTasks)
        .values({ id: "t2", type: "pair", characterId: "ghost", params })
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it("stores pair sets pending review with raw post-process state", () => {
    db.insert(pairSets)
      .values({
        id: "p1",
        taskId: "t1",
        characterId: "c1",
        seed: 42,
        animeImagePath: "raw/p1/anime.png",
        realImagePath: "raw/p1/real.png",
      })
      .run();

    const pair = db.select().from(pairSets).get();
    expect(pair).toMatchObject({
      reviewStatus: "pending",
      postProcessStatus: "raw",
      rating: null,
      seed: 42,
    });
  });

  it("cascades task deletion to its pair sets", () => {
    db.insert(pairSets)
      .values({
        id: "p1",
        taskId: "t1",
        characterId: "c1",
        seed: 1,
        animeImagePath: "a.png",
        realImagePath: "r.png",
      })
      .run();

    db.delete(generationTasks).where(eq(generationTasks.id, "t1")).run();
    expect(db.select().from(pairSets).all()).toEqual([]);
  });
});

describe("factors", () => {
  it("stores prompt fragments with enabled default", () => {
    db.insert(factors)
      .values({ id: "f1", category: "outfit", name: "泳装", promptFragment: "swimsuit" })
      .run();

    const row = db.select().from(factors).get();
    expect(row).toMatchObject({ enabled: true, negativeFragment: "" });
  });
});
