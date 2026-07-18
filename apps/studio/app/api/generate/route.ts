import {
  createSingleGenerationTask,
  GenerationTaskError,
} from "@icy/core"
import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * Queue a single-image task. GPU work is performed by the companion worker;
 * this request never waits for ComfyUI.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求体须为对象" }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const characterId =
    typeof input.characterId === "string" ? input.characterId.trim() : ""
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : ""
  const workflowId =
    typeof input.workflowId === "string" && input.workflowId.trim()
      ? input.workflowId.trim()
      : undefined

  if (!characterId) {
    return NextResponse.json({ error: "characterId 不能为空" }, { status: 400 })
  }

  const seedStrategy =
    typeof input.seed === "number" && Number.isFinite(input.seed)
      ? { kind: "fixed" as const, seed: Math.trunc(input.seed) }
      : { kind: "random" as const, count: 1 }

  try {
    const task = createSingleGenerationTask(getDb(), {
      characterId,
      seedStrategy,
      animeWorkflowId: workflowId,
      extraPrompt: prompt,
      priority: 10,
    })
    return NextResponse.json(
      { ok: true, taskId: task.id, status: task.status },
      { status: 202 },
    )
  } catch (error) {
    if (error instanceof GenerationTaskError) {
      const status = error.code === "not_found" ? 404 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    throw error
  }
}
