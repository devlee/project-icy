import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createCharacter } from "../characters/characters";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createSeries } from "../generation/series";
import { FACTOR_PRESETS } from "./presets";
import {
  assertFactorIds,
  createFactor,
  deleteFactor,
  FactorError,
  getFactor,
  importFactorPresets,
  listFactors,
  resolveFactorNames,
  setFactorEnabled,
  updateFactor,
} from "./factors";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
});

describe("factors CRUD", () => {
  it("creates, lists, updates, and toggles enabled", () => {
    const created = createFactor(db, {
      category: "scene",
      name: " 海边 ",
      promptFragment: " sunny beach ",
      negativeFragment: " crowd ",
    });
    expect(created).toMatchObject({
      category: "scene",
      name: "海边",
      promptFragment: "sunny beach",
      negativeFragment: "crowd",
      enabled: true,
    });

    expect(listFactors(db)).toHaveLength(1);
    expect(listFactors(db, { category: "scene", enabled: true })).toHaveLength(1);
    expect(listFactors(db, { search: "beach" })).toHaveLength(1);
    expect(listFactors(db, { search: "nope" })).toHaveLength(0);

    const updated = updateFactor(db, created.id, {
      name: "沙滩",
      category: "lighting",
      promptFragment: "soft sand light",
    });
    expect(updated).toMatchObject({
      name: "沙滩",
      category: "lighting",
      promptFragment: "soft sand light",
    });

    const disabled = setFactorEnabled(db, created.id, false);
    expect(disabled.enabled).toBe(false);
    expect(listFactors(db, { enabled: true })).toHaveLength(0);
    expect(listFactors(db, { enabled: false })).toHaveLength(1);
  });

  it("rejects invalid category and empty fields", () => {
    expect(() =>
      createFactor(db, {
        category: "nope" as "scene",
        name: "x",
        promptFragment: "y",
      }),
    ).toThrow(FactorError);
    expect(() =>
      createFactor(db, { category: "scene", name: "  ", promptFragment: "y" }),
    ).toThrow(/名称/);
    expect(() =>
      createFactor(db, { category: "scene", name: "x", promptFragment: "  " }),
    ).toThrow(/提示词/);
  });

  it("soft-disables when referenced by series pool, hard-deletes otherwise", () => {
    const factor = createFactor(db, {
      category: "outfit",
      name: "校服",
      promptFragment: "school uniform",
    });
    const other = createFactor(db, {
      category: "style",
      name: "清透",
      promptFragment: "clean style",
    });

    const character = createCharacter(db, { name: "凛冬", slug: "rin" });
    createSeries(db, {
      characterId: character.id,
      name: "夏日",
      batchConfig: { factorIds: [factor.id], perBatch: 2 },
    });

    const soft = deleteFactor(db, factor.id);
    expect(soft.enabled).toBe(false);
    expect(getFactor(db, factor.id)).not.toBeNull();

    deleteFactor(db, other.id);
    expect(getFactor(db, other.id)).toBeNull();
  });

  it("assertFactorIds validates existence and enabled", () => {
    const on = createFactor(db, {
      category: "scene",
      name: "A",
      promptFragment: "a",
    });
    const off = createFactor(db, {
      category: "scene",
      name: "B",
      promptFragment: "b",
      enabled: false,
    });

    expect(assertFactorIds(db, [on.id, on.id])).toEqual([on.id]);
    expect(() => assertFactorIds(db, ["missing"])).toThrow(/不存在/);
    expect(() => assertFactorIds(db, [off.id], { requireEnabled: true })).toThrow(/已禁用/);
  });

  it("resolveFactorNames keeps input order and skips missing", () => {
    const a = createFactor(db, { category: "scene", name: "甲", promptFragment: "a" });
    const b = createFactor(db, { category: "scene", name: "乙", promptFragment: "b" });
    expect(resolveFactorNames(db, [b.id, "gone", a.id])).toEqual(["乙", "甲"]);
  });

  it("importFactorPresets inserts once and skips duplicates", () => {
    expect(FACTOR_PRESETS.length).toBeGreaterThanOrEqual(20);
    expect(FACTOR_PRESETS.length).toBeLessThanOrEqual(50);

    const first = importFactorPresets(db);
    expect(first.inserted).toBe(FACTOR_PRESETS.length);
    expect(first.skipped).toBe(0);
    expect(listFactors(db)).toHaveLength(FACTOR_PRESETS.length);

    const second = importFactorPresets(db);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(FACTOR_PRESETS.length);
  });
});
