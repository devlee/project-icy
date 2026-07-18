"use server";

import { exportPortalContentPack } from "@icy/core";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getStorage } from "@/lib/services";

export type ExportPortalResult =
  | { ok: true; packPath: string; characters: number; galleryItems: number }
  | { ok: false; error: string };

export async function exportPortalPackAction(): Promise<ExportPortalResult> {
  try {
    const result = await exportPortalContentPack(getDb(), getStorage());
    revalidatePath("/schedule");
    return {
      ok: true,
      packPath: result.packPath,
      characters: result.pack.characters.length,
      galleryItems: result.pack.galleryItems.length,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
