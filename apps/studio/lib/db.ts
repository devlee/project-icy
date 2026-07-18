import { mkdirSync } from "node:fs";
import { createDb, migrateDb, type IcyDb } from "@icy/core";
import { contentRoot, dbPath, migrationsFolder } from "./paths";

const globalForDb = globalThis as unknown as { __icyDb?: IcyDb };

/** Process-wide SQLite handle; migrates on first use. */
export function getDb(): IcyDb {
  if (!globalForDb.__icyDb) {
    mkdirSync(contentRoot(), { recursive: true });
    const db = createDb(dbPath());
    migrateDb(db, migrationsFolder());
    globalForDb.__icyDb = db;
  }
  return globalForDb.__icyDb;
}
