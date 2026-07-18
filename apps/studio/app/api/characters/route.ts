import { CharacterError, createCharacter, listCharacters } from "@icy/core";
import type { CharacterOrigin, CharacterStatus } from "@icy/shared";
import { CHARACTER_ORIGINS, CHARACTER_STATUSES } from "@icy/shared";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function asStatus(value: unknown): CharacterStatus | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  if (!(CHARACTER_STATUSES as readonly string[]).includes(value)) return undefined;
  return value as CharacterStatus;
}

function asOrigin(value: unknown): CharacterOrigin | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  if (!(CHARACTER_ORIGINS as readonly string[]).includes(value)) return undefined;
  return value as CharacterOrigin;
}

export async function GET() {
  const rows = listCharacters(getDb());
  return NextResponse.json({ characters: rows });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求体须为对象" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  try {
    const row = createCharacter(getDb(), {
      name: String(input.name ?? ""),
      slug: typeof input.slug === "string" && input.slug ? input.slug : undefined,
      tagline: typeof input.tagline === "string" ? input.tagline : "",
      profile: typeof input.profile === "string" ? input.profile : "",
      status: asStatus(input.status) ?? "draft",
      origin: asOrigin(input.origin) ?? "original",
      ipSource: typeof input.ipSource === "string" ? input.ipSource : "",
    });
    return NextResponse.json({ character: row }, { status: 201 });
  } catch (e) {
    if (e instanceof CharacterError) {
      const status = e.code === "conflict" ? 409 : e.code === "not_found" ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
