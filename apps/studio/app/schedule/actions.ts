"use server";

import {
  createPublishPlan,
  markPlanPublished,
  pickAssetsForPlatform,
  PublishPlanError,
  todayLocalDate,
  updatePublishPlan,
} from "@icy/core";
import { PLATFORMS, type Platform } from "@icy/shared";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

function isPlatform(v: string): v is Platform {
  return (PLATFORMS as readonly string[]).includes(v);
}

export async function createPlanAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const pairSetId = String(formData.get("pairSetId") ?? "").trim();
    const platformRaw = String(formData.get("platform") ?? "").trim();
    const date = String(formData.get("date") ?? "").trim() || todayLocalDate();
    const caption = String(formData.get("caption") ?? "");
    const hashtags = String(formData.get("hashtags") ?? "");

    if (!pairSetId) return { ok: false, error: "请选择成品包" };
    if (!isPlatform(platformRaw) || platformRaw === "generic") {
      return { ok: false, error: "请选择发布平台" };
    }

    const db = getDb();
    const assetIds = pickAssetsForPlatform(db, pairSetId, platformRaw);
    if (assetIds.length === 0) {
      return { ok: false, error: "该成品包尚无可用素材，请先完成后期拼版" };
    }

    createPublishPlan(db, {
      date,
      platform: platformRaw,
      caption,
      hashtags,
      assetIds,
    });
    revalidatePath("/schedule");
    return { ok: true };
  } catch (e) {
    if (e instanceof PublishPlanError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function markPublishedAction(
  planId: string,
  notes?: string,
): Promise<ActionResult> {
  try {
    const id = planId.trim();
    if (!id) return { ok: false, error: "须指定排期" };
    markPlanPublished(getDb(), id, { notes });
    revalidatePath("/schedule");
    return { ok: true };
  } catch (e) {
    if (e instanceof PublishPlanError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updatePlanCaptionAction(
  planId: string,
  caption: string,
  hashtags: string,
): Promise<ActionResult> {
  try {
    const id = planId.trim();
    if (!id) return { ok: false, error: "须指定排期" };
    updatePublishPlan(getDb(), id, { caption, hashtags });
    revalidatePath("/schedule");
    return { ok: true };
  } catch (e) {
    if (e instanceof PublishPlanError) return { ok: false, error: e.message };
    throw e;
  }
}
