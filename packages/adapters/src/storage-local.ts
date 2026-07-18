import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageAdapter } from "@icy/core";

export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly rootDir: string,
    /** Route prefix the studio app serves content from, e.g. "/content". */
    private readonly urlPrefix = "/content",
  ) {}

  private resolve(key: string): string {
    const abs = path.resolve(this.rootDir, key);
    if (!abs.startsWith(path.resolve(this.rootDir) + path.sep)) {
      throw new Error(`Storage key escapes root: ${key}`);
    }
    return abs;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const abs = this.resolve(key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.resolve(prefix);
    try {
      const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
      return entries
        .filter((e) => e.isFile())
        .map((e) => path.relative(this.rootDir, path.join(e.parentPath, e.name)));
    } catch {
      return [];
    }
  }

  publicUrl(key: string): string {
    return `${this.urlPrefix}/${key}`;
  }

  localPath(key: string): string {
    return this.resolve(key);
  }
}
