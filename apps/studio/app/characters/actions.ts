"use server";

import {
  CharacterError,
  archiveCharacter,
  createCharacter,
  updateCharacter,
} from "@icy/core";
import type { CharacterOrigin, CharacterStatus } from "@icy/shared";
import { CHARACTER_ORIGINS, CHARACTER_STATUSES } from "@icy/shared";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

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
