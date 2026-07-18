import { existsSync } from "node:fs";
import path from "node:path";

/** Monorepo root (…/project-icy). Prefer ICY_ROOT; else walk up for pnpm-workspace.yaml. */
export function monorepoRoot(): string {
  if (process.env.ICY_ROOT) return process.env.ICY_ROOT;
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback when cwd is apps/studio
  return path.resolve(process.cwd(), "../..");
}

export function contentRoot(): string {
  return process.env.ICY_CONTENT_ROOT ?? path.join(monorepoRoot(), "content");
}

export function dbPath(): string {
  return process.env.ICY_DB_PATH ?? path.join(contentRoot(), "icy.db");
}

export function migrationsFolder(): string {
  return path.join(monorepoRoot(), "packages/core/drizzle");
}
