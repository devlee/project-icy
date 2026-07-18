import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import { createCharacter } from "../characters/characters";
import type { StorageAdapter } from "../ports/storage";
import { buildPortalContentPack } from "./export";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;
const storage: StorageAdapter = {
  async put() {},
  async get() {
    return Buffer.from([]);
  },
  async exists() {
    return false;
  },
  async delete() {},
  async list() {
    return [];
  },
  publicUrl(key) {
    return `/api/content/${key}`;
  },
  localPath() {
    return null;
  },
};

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
});

describe("portal export", () => {
  it("builds empty pack when no content", () => {
    const pack = buildPortalContentPack(db, storage);
    expect(pack.schemaVersion).toBe(1);
    expect(pack.characters).toEqual([]);
    expect(pack.galleryItems).toEqual([]);
  });

  it("includes original featured characters", () => {
    createCharacter(db, {
      name: "Rin",
      slug: "rin",
      status: "featured",
      origin: "original",
    });
    const pack = buildPortalContentPack(db, storage);
    expect(pack.characters).toHaveLength(1);
    expect(pack.characters[0]!.slug).toBe("rin");
  });
});
