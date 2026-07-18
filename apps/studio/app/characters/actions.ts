"use server";

import { randomBytes } from "node:crypto";
import {
  CharacterError,
  CharacterImageError,
  FactorError,
  addCharacterImage,
  archiveCharacter,
  createCharacter,
  setCharacterFactors,
  updateCharacter,
} from "@icy/core";
import type { CharacterOrigin, CharacterStatus, Form } from "@icy/shared";
import { CHARACTER_ORIGINS, CHARACTER_STATUSES, FORMS } from "@icy/shared";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getStorage } from "@/lib/services";

export type ActionResult = { ok: true } | { ok: false; error: string };

function asStatus(value: FormDataEntryValue | null): CharacterStatus | undefined {
  if (value == null || value === "") return undefined;
  const s = String(value);
  if (!(CHARACTER_STATUSES as readonly string[]).includes(s)) return undefined;
  return s as CharacterStatus;
}

function asOrigin(value: FormDataEntryValue | null): CharacterOrigin | undefined {
  if (value == null || value === "") return undefined;
  const s = String(value);
  if (!(CHARACTER_ORIGINS as readonly string[]).includes(s)) return undefined;
  return s as CharacterOrigin;
}

export async function createCharacterAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    createCharacter(getDb(), {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? "") || undefined,
      tagline: String(formData.get("tagline") ?? ""),
      profile: String(formData.get("profile") ?? ""),
      status: asStatus(formData.get("status")) ?? "draft",
      origin: asOrigin(formData.get("origin")) ?? "original",
      ipSource: String(formData.get("ipSource") ?? ""),
    });
    revalidatePath("/characters");
    return { ok: true };
  } catch (e) {
    if (e instanceof CharacterError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateCharacterStatusAction(
  id: string,
  status: CharacterStatus,
): Promise<ActionResult> {
  try {
    updateCharacter(getDb(), id, { status });
    revalidatePath("/characters");
    return { ok: true };
  } catch (e) {
    if (e instanceof CharacterError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function archiveCharacterAction(id: string): Promise<ActionResult> {
  try {
    archiveCharacter(getDb(), id);
    revalidatePath("/characters");
    return { ok: true };
  } catch (e) {
    if (e instanceof CharacterError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function uploadCharacterAnchorAction(
  characterId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "请选择图片文件" };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "仅支持图片文件" };
    }
    if (file.size > 100 * 1024 * 1024) {
      return { ok: false, error: "图片不能超过 100MB" };
    }

    const ext =
      file.name.includes(".") && file.name.lastIndexOf(".") > 0
        ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
        : ".png";
    const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)
      ? ext
      : ".png";
    const formRaw = String(formData.get("form") ?? "anime");
    if (!(FORMS as readonly string[]).includes(formRaw)) {
      return { ok: false, error: "无效形态" };
    }
    const form = formRaw as Form;

    const key = `characters/${characterId}/anchors/${form}/${randomBytes(10).toString("hex")}${safeExt}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await getStorage().put(key, bytes);

    addCharacterImage(getDb(), {
      characterId,
      kind: "anchor",
      form,
      filePath: key,
      isPrimary: true,
      note: file.name,
    });

    revalidatePath("/characters");
    revalidatePath("/generate");
    return { ok: true };
  } catch (e) {
    if (e instanceof CharacterImageError || e instanceof CharacterError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}

export async function setCharacterFactorsAction(
  characterId: string,
  factorIds: string[],
): Promise<ActionResult> {
  try {
    setCharacterFactors(getDb(), characterId.trim(), factorIds);
    revalidatePath("/characters");
    revalidatePath("/generate");
    return { ok: true };
  } catch (e) {
    if (e instanceof FactorError || e instanceof CharacterError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}
