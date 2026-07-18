import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createCharacter } from "../characters/characters";
import { createSingleGenerationTask } from "./tasks";
import {
  createPairSet,
  getReviewStats,
  listPairSets,
  PairSetError,
  reviewPairSet,
} from "./pair-sets";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;
let characterId: string;
let taskId: string;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
  characterId = createCharacter(db, { name: "Rin", slug: "rin" }).id;
  taskId = createSingleGenerationTask(db, {
    characterId,
    seedStrategy: { kind: "fixed", seed: 1 },
  }).id;
});

function makePair(seed: number) {
  return createPairSet(db, {
    taskId,
    characterId,
    seed,
    animeImagePath: `raw/a-${seed}.png`,
    realImagePath: `raw/r-${seed}.png`,
  });
}

describe("pairSets", () => {
  it("creates and lists pending pairs", () => {
    const pair = makePair(42);
    expect(pair.reviewStatus).toBe("pending");
    expect(pair.animeImagePath).toBe("raw/a-42.png");

    const list = listPairSets(db, { reviewStatus: "pending" });
    expect(list).toHaveLength(1);
    expect(list[0]!.characterName).toBe("Rin");
    expect(list[0]!.seed).toBe(42);
  });

  it("rejects missing task or empty paths", () => {
    expect(() =>
      createPairSet(db, {
        taskId: "missing",
        characterId,
        seed: 1,
        animeImagePath: "a.png",
        realImagePath: "r.png",
      }),
    ).toThrow(PairSetError);

    expect(() =>
      createPairSet(db, {
        taskId,
        characterId,
        seed: 1,
        animeImagePath: "",
        realImagePath: "r.png",
      }),
    ).toThrow(/路径/);
  });

  it("reviews status and rating without deleting paths", () => {
    const pair = makePair(1);
    const rated = reviewPairSet(db, pair.id, { rating: 4 });
    expect(rated.rating).toBe(4);
    expect(rated.reviewStatus).toBe("pending");
    expect(rated.animeImagePath).toBe("raw/a-1.png");

    const approved = reviewPairSet(db, pair.id, { status: "approved" });
    expect(approved.reviewStatus).toBe("approved");
    expect(approved.rating).toBe(4);
    expect(approved.reviewedAt).toBeTruthy();
    expect(approved.realImagePath).toBe("raw/r-1.png");

    expect(listPairSets(db, { reviewStatus: "pending" })).toHaveLength(0);
    expect(listPairSets(db, { reviewStatus: "approved" })).toHaveLength(1);
  });

  it("rejects invalid rating and missing id", () => {
    const pair = makePair(2);
    expect(() => reviewPairSet(db, pair.id, { rating: 0 })).toThrow(/1–5/);
    expect(() => reviewPairSet(db, "missing", { status: "hold" })).toThrow(PairSetError);
  });

  it("aggregates review stats", () => {
    const a = makePair(1);
    const b = makePair(2);
    const c = makePair(3);
    reviewPairSet(db, a.id, { status: "approved", rating: 5 });
    reviewPairSet(db, b.id, { status: "rejected", rating: 2 });
    reviewPairSet(db, c.id, { status: "hold", rating: 5 });

    const stats = getReviewStats(db);
    expect(stats.total).toBe(3);
    expect(stats.reviewed).toBe(3);
    expect(stats.byStatus.approved).toBe(1);
    expect(stats.byStatus.rejected).toBe(1);
    expect(stats.byStatus.hold).toBe(1);
    expect(stats.ratingCounts[5]).toBe(2);
    expect(stats.ratingCounts[2]).toBe(1);
    expect(stats.ratedTotal).toBe(3);
  });
});
