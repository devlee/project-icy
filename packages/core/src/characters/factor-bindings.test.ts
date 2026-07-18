import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createCharacter } from "./characters";
import { createFactor } from "../factors/factors";
import {
  listCharacterFactorIds,
  mergeCharacterDefaultFactors,
  setCharacterFactors,
} from "./factor-bindings";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
});

describe("character factor bindings", () => {
  it("sets and merges defaults with explicit ids", () => {
    const characterId = createCharacter(db, { name: "A", slug: "a" }).id;
    const f1 = createFactor(db, {
      category: "scene",
      name: "beach",
      promptFragment: "beach",
    }).id;
    const f2 = createFactor(db, {
      category: "outfit",
      name: "dress",
      promptFragment: "dress",
    }).id;
    setCharacterFactors(db, characterId, [f1]);
    expect(listCharacterFactorIds(db, characterId)).toEqual([f1]);
    expect(mergeCharacterDefaultFactors(db, characterId, [f2])).toEqual([f1, f2]);
  });
});
