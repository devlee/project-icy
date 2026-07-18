import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "./storage-local";

let root: string;
let storage: LocalStorageAdapter;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "icy-storage-"));
  storage = new LocalStorageAdapter(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("LocalStorageAdapter", () => {
  it("round-trips bytes, creating parent directories", async () => {
    const data = Buffer.from("pair-image");
    await storage.put("raw/2026-07/p1/anime.png", data);

    expect(await storage.get("raw/2026-07/p1/anime.png")).toEqual(data);
    expect(await storage.exists("raw/2026-07/p1/anime.png")).toBe(true);
  });

  it("lists keys under a prefix relative to the root", async () => {
    await storage.put("raw/p1/anime.png", Buffer.from("a"));
    await storage.put("raw/p1/real.png", Buffer.from("b"));
    await storage.put("assets/c.png", Buffer.from("c"));

    const keys = await storage.list("raw");
    expect(keys.sort()).toEqual(["raw/p1/anime.png", "raw/p1/real.png"]);
    expect(await storage.list("missing")).toEqual([]);
  });

  it("deletes objects and tolerates missing keys", async () => {
    await storage.put("a.png", Buffer.from("a"));
    await storage.delete("a.png");
    expect(await storage.exists("a.png")).toBe(false);
    await expect(storage.delete("a.png")).resolves.toBeUndefined();
  });

  it("rejects keys escaping the content root", async () => {
    await expect(storage.put("../evil.png", Buffer.from("x"))).rejects.toThrow(/escapes root/);
    expect(() => storage.localPath("../../etc/passwd")).toThrow(/escapes root/);
  });

  it("builds public URLs from the configured prefix", () => {
    expect(storage.publicUrl("assets/a.png")).toBe("/content/assets/a.png");
    expect(new LocalStorageAdapter(root, "/files").publicUrl("a.png")).toBe("/files/a.png");
  });
});
