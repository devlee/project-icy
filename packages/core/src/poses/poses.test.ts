import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type IcyDb } from "../db/client";
import type { StorageAdapter } from "../ports/storage";
import {
  assertPoseIds,
  createPose,
  deletePose,
  importPosePresets,
  listPoses,
  PoseError,
  updatePose,
} from "./poses";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

let db: IcyDb;
let tmp: string;
const blobs = new Map<string, Buffer>();

const storage: StorageAdapter = {
  async put(key, data) {
    blobs.set(key, Buffer.from(data));
  },
  async get(key) {
    const b = blobs.get(key);
    if (!b) throw new Error(`missing ${key}`);
    return b;
  },
  async exists(key) {
    return blobs.has(key);
  },
  async delete(key) {
    blobs.delete(key);
  },
  async list(prefix) {
    return [...blobs.keys()].filter((k) => k.startsWith(prefix));
  },
  publicUrl(key) {
    return `/api/content/${key}`;
  },
  localPath(key) {
    return path.join(tmp, key);
  },
};

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db, migrationsFolder);
  tmp = mkdtempSync(path.join(tmpdir(), "icy-pose-"));
  mkdirSync(tmp, { recursive: true });
  blobs.clear();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("poses", () => {
  it("creates lists and updates", () => {
    const pose = createPose(db, {
      name: "站立",
      filePath: "poses/a.png",
      tags: "standing",
    });
    expect(listPoses(db)).toHaveLength(1);
    const updated = updatePose(db, pose.id, { name: "站立正面" });
    expect(updated.name).toBe("站立正面");
    expect(assertPoseIds(db, [pose.id])).toEqual([pose.id]);
  });

  it("imports presets idempotently", async () => {
    const first = await importPosePresets(db, storage);
    expect(first.inserted).toBe(20);
    const second = await importPosePresets(db, storage);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(20);
    expect(listPoses(db)).toHaveLength(20);
  });

  it("deletes unused pose", () => {
    const pose = createPose(db, { name: "x", filePath: "poses/x.png" });
    deletePose(db, pose.id);
    expect(listPoses(db)).toHaveLength(0);
    expect(() => deletePose(db, pose.id)).toThrow(PoseError);
  });
});
