"use server";

import {
  CharacterImageError,
  PairSetError,
  promotePairSetImage,
  reviewPairSet,
} from "@icy/core";
import type { Form, ReviewStatus } from "@icy/shared";
import { FORMS, REVIEW_STATUSES } from "@icy/shared";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getStorage } from "@/lib/services";

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

export type PromoteActionResult =
  | {
      ok: true;
      created: boolean;
      kind: "anchor" | "faceid_ref";
      side: Form;
      filePath: string;
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

export async function promotePairSetImageAction(input: {
  pairSetId: string;
  side: Form;
  kind: "anchor" | "faceid_ref";
}): Promise<PromoteActionResult> {
  try {
    if (!(FORMS as readonly string[]).includes(input.side)) {
      return { ok: false, error: "无效形态侧" };
    }
    if (input.kind !== "anchor" && input.kind !== "faceid_ref") {
      return { ok: false, error: "无效提升类型" };
    }
    const result = await promotePairSetImage(getDb(), getStorage(), {
      pairSetId: input.pairSetId,
      side: input.side,
      kind: input.kind,
    });
    revalidatePath("/review");
    revalidatePath("/characters");
    revalidatePath("/generate");
    return {
      ok: true,
      created: result.created,
      kind: input.kind,
      side: input.side,
      filePath: result.image.filePath,
    };
  } catch (e) {
    if (e instanceof CharacterImageError) return { ok: false, error: e.message };
    throw e;
  }
}
