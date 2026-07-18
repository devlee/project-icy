import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type IcyDb = ReturnType<typeof createDb>;

/** Pass ":memory:" as dbPath for tests. */
export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  if (dbPath !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

/**
 * Apply checked-in SQL migrations (packages/core/drizzle).
 * Call on app startup and in tests; the single schema-provisioning path.
 */
export function migrateDb(db: IcyDb, migrationsFolder: string) {
  migrate(db, { migrationsFolder });
}
