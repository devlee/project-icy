import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PortalContentPack } from "@icy/shared";

const EMPTY: PortalContentPack = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  characters: [],
  galleryItems: [],
};

/** Resolve content/portal/pack.json from monorepo or ICY_CONTENT_ROOT. */
export function loadPortalPack(): PortalContentPack {
  const candidates = [
    process.env.ICY_PORTAL_PACK,
    process.env.ICY_CONTENT_ROOT
      ? path.join(process.env.ICY_CONTENT_ROOT, "portal/pack.json")
      : null,
    path.join(process.cwd(), "../../content/portal/pack.json"),
    path.join(process.cwd(), "content/portal/pack.json"),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      return JSON.parse(readFileSync(file, "utf8")) as PortalContentPack;
    } catch {
      /* try next */
    }
  }
  return EMPTY;
}

export const BRAND = process.env.ICY_PORTAL_BRAND ?? "project-icy";
export const AI_NOTICE = "本站展示内容含 AI 生成图像，仅供艺术与研究展示。";
