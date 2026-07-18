import { and, asc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { FactorCategory } from "@icy/shared";
import { FACTOR_CATEGORIES } from "@icy/shared";
import type { IcyDb } from "../db/client";
import { factors, series } from "../db/schema";
import { FACTOR_PRESETS } from "./presets";

export type FactorListItem = {
  id: string;
  category: FactorCategory;
  name: string;
  promptFragment: string;
  negativeFragment: string;
  enabled: boolean;
  createdAt: Date;
};

export type CreateFactorInput = {
  category: FactorCategory;
  name: string;
  promptFragment: string;
  negativeFragment?: string;
  enabled?: boolean;
};

export type UpdateFactorInput = {
  category?: FactorCategory;
  name?: string;
  promptFragment?: string;
  negativeFragment?: string;
  enabled?: boolean;
};

export type ListFactorsOpts = {
  category?: FactorCategory;
  /** When true, only enabled; when false, only disabled; omit for all. */
  enabled?: boolean;
  /** Case-insensitive substring match on name / promptFragment. */
  search?: string;
};

export class FactorError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "not_found" | "conflict",
  ) {
    super(message);
    this.name = "FactorError";
  }
}

function assertCategory(category: string): asserts category is FactorCategory {
  if (!(FACTOR_CATEGORIES as readonly string[]).includes(category)) {
    throw new FactorError(`无效分类: ${category}`, "validation");
  }
}

function toListItem(row: typeof factors.$inferSelect): FactorListItem {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    promptFragment: row.promptFragment,
    negativeFragment: row.negativeFragment,
    enabled: row.enabled,
    createdAt: row.createdAt,
  };
}

function seriesReferencesFactor(db: IcyDb, factorId: string): boolean {
  const rows = db.select({ batchConfig: series.batchConfig }).from(series).all();
  return rows.some((row) => row.batchConfig?.factorIds.includes(factorId));
}

export function getFactor(db: IcyDb, id: string): FactorListItem | null {
  const row = db.select().from(factors).where(eq(factors.id, id)).get();
  return row ? toListItem(row) : null;
}

export function listFactors(db: IcyDb, opts: ListFactorsOpts = {}): FactorListItem[] {
  const filters = [];
  if (opts.category !== undefined) {
    assertCategory(opts.category);
    filters.push(eq(factors.category, opts.category));
  }
  if (opts.enabled !== undefined) {
    filters.push(eq(factors.enabled, opts.enabled));
  }

  const query = db.select().from(factors);
  let rows = (filters.length ? query.where(and(...filters)) : query)
    .orderBy(asc(factors.category), asc(factors.name))
    .all();

  const search = opts.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(search) ||
        row.promptFragment.toLowerCase().includes(search),
    );
  }

  return rows.map(toListItem);
}

export function createFactor(db: IcyDb, input: CreateFactorInput): FactorListItem {
  assertCategory(input.category);
  const name = input.name.trim();
  if (!name) throw new FactorError("名称不能为空", "validation");
  const promptFragment = input.promptFragment.trim();
  if (!promptFragment) throw new FactorError("提示词片段不能为空", "validation");

  const id = nanoid();
  db.insert(factors)
    .values({
      id,
      category: input.category,
      name,
      promptFragment,
      negativeFragment: input.negativeFragment?.trim() ?? "",
      enabled: input.enabled ?? true,
    })
    .run();

  return getFactor(db, id)!;
}

export function updateFactor(
  db: IcyDb,
  id: string,
  input: UpdateFactorInput,
): FactorListItem {
  const row = db.select().from(factors).where(eq(factors.id, id)).get();
  if (!row) throw new FactorError("因子不存在", "not_found");

  const patch: Partial<typeof factors.$inferInsert> = {};
  if (input.category !== undefined) {
    assertCategory(input.category);
    patch.category = input.category;
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new FactorError("名称不能为空", "validation");
    patch.name = name;
  }
  if (input.promptFragment !== undefined) {
    const promptFragment = input.promptFragment.trim();
    if (!promptFragment) throw new FactorError("提示词片段不能为空", "validation");
    patch.promptFragment = promptFragment;
  }
  if (input.negativeFragment !== undefined) {
    patch.negativeFragment = input.negativeFragment.trim();
  }
  if (input.enabled !== undefined) patch.enabled = input.enabled;

  if (Object.keys(patch).length === 0) return toListItem(row);

  db.update(factors).set(patch).where(eq(factors.id, id)).run();
  return getFactor(db, id)!;
}

export function setFactorEnabled(db: IcyDb, id: string, enabled: boolean): FactorListItem {
  return updateFactor(db, id, { enabled });
}

/**
 * Soft-disables when the factor is referenced by any series factor pool;
 * otherwise hard-deletes.
 */
export function deleteFactor(db: IcyDb, id: string): FactorListItem {
  const row = getFactor(db, id);
  if (!row) throw new FactorError("因子不存在", "not_found");

  if (seriesReferencesFactor(db, id)) {
    return setFactorEnabled(db, id, false);
  }

  db.delete(factors).where(eq(factors.id, id)).run();
  return row;
}

/** Resolve factor ids to display names (missing ids omitted). */
export function resolveFactorNames(db: IcyDb, factorIds: string[]): string[] {
  const ids = [...new Set(factorIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = db
    .select({ id: factors.id, name: factors.name })
    .from(factors)
    .where(inArray(factors.id, ids))
    .all();
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => nameById.get(id)).filter((n): n is string => Boolean(n));
}

/**
 * Insert common presets that are not already present (match by category + name).
 * Returns counts of inserted vs skipped.
 */
export function importFactorPresets(db: IcyDb): { inserted: number; skipped: number } {
  const existing = db
    .select({ category: factors.category, name: factors.name })
    .from(factors)
    .all();
  const keys = new Set(existing.map((r) => `${r.category}::${r.name}`));

  let inserted = 0;
  let skipped = 0;
  for (const preset of FACTOR_PRESETS) {
    const key = `${preset.category}::${preset.name}`;
    if (keys.has(key)) {
      skipped += 1;
      continue;
    }
    createFactor(db, preset);
    keys.add(key);
    inserted += 1;
  }
  return { inserted, skipped };
}

/** Validate factor ids exist; optionally require enabled. */
export function assertFactorIds(
  db: IcyDb,
  factorIds: string[],
  opts: { requireEnabled?: boolean } = {},
): string[] {
  if (!Array.isArray(factorIds) || factorIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new FactorError("因子 id 不能为空", "validation");
  }
  const ids = [...new Set(factorIds.map((id) => id.trim()))];
  if (ids.length === 0) return [];

  const found = db.select().from(factors).where(inArray(factors.id, ids)).all();
  if (found.length !== ids.length) {
    throw new FactorError("包含不存在的因子", "validation");
  }
  if (opts.requireEnabled) {
    const disabled = found.filter((f) => !f.enabled);
    if (disabled.length > 0) {
      throw new FactorError(
        `因子已禁用: ${disabled.map((f) => f.name).join(", ")}`,
        "validation",
      );
    }
  }
  return ids;
}
