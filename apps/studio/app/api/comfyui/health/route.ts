import { NextResponse } from "next/server";
import { getGeneration } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  const adapter = getGeneration();
  const result = await adapter.ping();
  return NextResponse.json({
    ...result,
    url: adapter.url,
    backend: adapter.mode,
    hasApiKey: adapter.hasApiKey,
  });
}
