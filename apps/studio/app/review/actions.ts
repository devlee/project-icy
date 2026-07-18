"use server";

import { PairSetError, reviewPairSet } from "@icy/core";
import type { ReviewStatus } from "@icy/shared";
import { REVIEW_STATUSES } from "@icy/shared";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

export type ActionResult =
  | {
      ok: true;
      pair: {
        id: string;
        reviewStatus: ReviewStatus;
        rating: number | null;
      };
    }
  | { ok: false; error: string };

export async function reviewPairSetAction(input: {
  id: string;
  status?: ReviewStatus;
  rating?: number | null;
}): Promise<ActionResult> {
  try {
    if (input.status !== undefined && !(REVIEW_STATUSES as readonly string[]).includes(input.status)) {
      return { ok: false, error: "无效状态" };
    }
    const row = reviewPairSet(getDb(), input.id, {
      status: input.status,
      rating: input.rating,
    });
    revalidatePath("/review");
    return {
      ok: true,
      pair: {
        id: row.id,
        reviewStatus: row.reviewStatus,
        rating: row.rating,
      },
    };
  } catch (e) {
    if (e instanceof PairSetError) return { ok: false, error: e.message };
    throw e;
  }
}
