import { eq, inArray } from "drizzle-orm";
import type { IcyDb } from "../db/client";
import { characterFactors, characters, factors } from "../db/schema";
import { assertFactorIds, FactorError, type FactorListItem } from "../factors/factors";

export function listCharacterFactorIds(db: IcyDb, characterId: string): string[] {
  return db
    .select({ factorId: characterFactors.factorId })
    .from(characterFactors)
    .where(eq(characterFactors.characterId, characterId))
    .all()
    .map((r) => r.factorId);
}

export function listCharacterFactors(db: IcyDb, characterId: string): FactorListItem[] {
  const ids = listCharacterFactorIds(db, characterId);
  if (ids.length === 0) return [];
  const rows = db.select().from(factors).where(inArray(factors.id, ids)).all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((row) => ({
      id: row.id,
      category: row.category,
      name: row.name,
      promptFragment: row.promptFragment,
      negativeFragment: row.negativeFragment,
      enabled: row.enabled,
      createdAt: row.createdAt,
    }));
}

/** Replace the character's default factor set (empty clears). */
export function setCharacterFactors(
  db: IcyDb,
  characterId: string,
  factorIds: string[],
): string[] {
  const id = characterId.trim();
  if (!id) throw new FactorError("须指定角色", "validation");
  const character = db.select().from(characters).where(eq(characters.id, id)).get();
  if (!character) throw new FactorError("角色不存在", "not_found");

  const ids = assertFactorIds(db, factorIds, { requireEnabled: false });
  db.delete(characterFactors).where(eq(characterFactors.characterId, id)).run();
  for (const factorId of ids) {
    db.insert(characterFactors).values({ characterId: id, factorId }).run();
  }
  return ids;
}

/** Merge enabled character defaults with explicit task factor ids (explicit wins order after defaults). */
export function mergeCharacterDefaultFactors(
  db: IcyDb,
  characterId: string,
  explicitIds: string[],
): string[] {
  const defaults = listCharacterFactorIds(db, characterId);
  const enabledDefaults = defaults.filter((fid) => {
    const row = db.select().from(factors).where(eq(factors.id, fid)).get();
    return row?.enabled;
  });
  return [...new Set([...enabledDefaults, ...explicitIds])];
}
