import { listGenerationTasks, resolveFactorNames } from "@icy/core";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 40);
  const db = getDb();
  const tasks = listGenerationTasks(db, {
    limit: Number.isFinite(limit) ? limit : 40,
  }).map((t) => ({
    id: t.id,
    type: t.type,
    status: t.status,
    characterName: t.characterName,
    error: t.error,
    params: {
      seedStrategy: t.params.seedStrategy,
      animeWorkflowId: t.params.animeWorkflowId,
      realWorkflowId: t.params.realWorkflowId,
      extraPrompt: t.params.extraPrompt,
      outputKeys: t.params.outputKeys,
      factorIds: t.params.factorIds,
      factorNames: resolveFactorNames(db, t.params.factorIds ?? []),
    },
    createdAt: t.createdAt.toISOString(),
  }));
  return NextResponse.json({ tasks });
}
