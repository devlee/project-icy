import { getLatestPostTaskForPairSet, listApprovedForPost } from "@icy/core";
import type { CharacterOrigin, TaskStatus } from "@icy/shared";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function mapRow(db: ReturnType<typeof getDb>, p: {
  id: string;
  characterName: string;
  characterOrigin: CharacterOrigin;
  seed: number;
  rating: number | null;
  animeImagePath: string;
  realImagePath: string;
  assetCount: number;
}) {
  const task = getLatestPostTaskForPairSet(db, p.id);
  return {
    id: p.id,
    characterName: p.characterName,
    characterOrigin: p.characterOrigin,
    seed: p.seed,
    rating: p.rating,
    animeImagePath: p.animeImagePath,
    realImagePath: p.realImagePath,
    assetCount: p.assetCount,
    taskStatus: (task?.status ?? null) as TaskStatus | null,
    taskError: task?.error ?? null,
  };
}

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    pending: listApprovedForPost(db, { postProcessStatus: "raw" }).map((row) => mapRow(db, row)),
    ready: listApprovedForPost(db, { postProcessStatus: "composed" }).map((row) => mapRow(db, row)),
  });
}
