"use server";

import { AssetError, createPostTask, PostTaskError, runEnhancePairSet } from "@icy/core";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getImageCompose, getStorage } from "@/lib/services";

export type ActionResult =
  | { ok: true; queued: number }
  | { ok: false; error: string };

export async function composePairSetAction(id: string): Promise<ActionResult> {
  try {
    const pairSetId = id.trim();
    if (!pairSetId) return { ok: false, error: "须指定 PairSet" };
    createPostTask(getDb(), { pairSetId });
    revalidatePath("/post");
    return { ok: true, queued: 1 };
  } catch (e) {
    if (e instanceof PostTaskError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function composeSelectedAction(ids: string[]): Promise<ActionResult> {
  try {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) return { ok: false, error: "请先勾选待处理项" };
    const db = getDb();
    for (const pairSetId of unique) createPostTask(db, { pairSetId });
    revalidatePath("/post");
    return { ok: true, queued: unique.length };
  } catch (e) {
    if (e instanceof PostTaskError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Optional local Sharp enhance (not Comfy face-fix). */
export async function enhancePairSetAction(id: string): Promise<ActionResult> {
  try {
    const pairSetId = id.trim();
    if (!pairSetId) return { ok: false, error: "须指定 PairSet" };
    await runEnhancePairSet(pairSetId, {
      db: getDb(),
      storage: getStorage(),
      compose: getImageCompose(),
    });
    revalidatePath("/post");
    return { ok: true, queued: 1 };
  } catch (e) {
    if (e instanceof AssetError) return { ok: false, error: e.message };
    throw e;
  }
}
