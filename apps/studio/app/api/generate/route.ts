import { ComfyUIGenerationError } from "@icy/adapters";
import {
  defaultWorkflowRegistry,
  getWorkflowById,
  injectWorkflow,
  loadWorkflowJson,
  mergePrompts,
  WorkflowInjectError,
} from "@icy/core";
import { NextResponse } from "next/server";
import { getGeneration, getQueue, getStorage } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * Smoke path for single-image generation (PairSet orchestration comes later).
 *
 * POST body:
 * {
 *   "prompt": string,
 *   "negativePrompt"?: string,
 *   "seed"?: number,
 *   "workflowId"?: string  // default anime-txt2img-stub
 * }
 */
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
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
  }

  const workflowId =
    typeof input.workflowId === "string" && input.workflowId
      ? input.workflowId
      : "anime-txt2img-stub";
  const def = getWorkflowById(defaultWorkflowRegistry, workflowId);
  if (!def) {
    return NextResponse.json({ error: `未知 workflowId: ${workflowId}` }, { status: 400 });
  }

  const seed =
    typeof input.seed === "number" && Number.isFinite(input.seed)
      ? Math.trunc(input.seed)
      : Math.floor(Math.random() * 2 ** 32);
  const negativePrompt =
    typeof input.negativePrompt === "string" ? input.negativePrompt : undefined;

  try {
    const graph = loadWorkflowJson(def);
    const workflow = injectWorkflow(graph, def.injectionPoints, {
      positivePrompt: mergePrompts(def.basePrompt, prompt),
      negativePrompt: mergePrompts(def.baseNegativePrompt, negativePrompt),
      seed,
    });

    const result = await getQueue().add(
      () =>
        getGeneration().run({
          workflow,
          inputImages: [],
        }),
      { priority: 10 },
    );

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = `raw/singles/${stamp}_seed-${seed}`;
    const saved: { key: string; filename: string }[] = [];
    for (let i = 0; i < result.images.length; i++) {
      const img = result.images[i]!;
      const ext = img.filename.includes(".")
        ? img.filename.slice(img.filename.lastIndexOf("."))
        : ".png";
      const key = `${dir}/${String(i).padStart(2, "0")}${ext}`;
      await getStorage().put(key, img.data);
      saved.push({ key, filename: img.filename });
    }

    return NextResponse.json({
      ok: true,
      seed,
      workflowId,
      durationMs: result.durationMs,
      images: saved,
    });
  } catch (e) {
    if (e instanceof WorkflowInjectError || e instanceof ComfyUIGenerationError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    throw e;
  }
}
