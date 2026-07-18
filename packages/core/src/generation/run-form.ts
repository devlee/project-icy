import type { Form } from "@icy/shared";
import type { GenerationAdapter } from "../ports/generation";
import type { StorageAdapter } from "../ports/storage";
import type { CharacterImageRow } from "../characters/images";
import {
  defaultWorkflowRegistry,
  getWorkflowById,
} from "../workflows/default-registry";
import type { WorkflowDefinition } from "../workflows/registry";
import { injectWorkflow, mergePrompts } from "../workflows/inject";
import { loadWorkflowJson } from "../workflows/load";

export const WORKFLOW_ANIME_TXT2IMG = "anime-txt2img-stub";
export const WORKFLOW_ANIME_IPADAPTER = "anime-txt2img-ipadapter";
export const WORKFLOW_ANIME_CONTROLNET = "anime-txt2img-controlnet";
export const WORKFLOW_ANIME_IPADAPTER_CONTROLNET = "anime-txt2img-ipadapter-controlnet";
export const WORKFLOW_REAL_TXT2IMG = "real-txt2img-stub";
export const WORKFLOW_REAL_IPADAPTER = "real-txt2img-ipadapter";
export const WORKFLOW_REAL_CONTROLNET = "real-txt2img-controlnet";
export const WORKFLOW_REAL_IPADAPTER_CONTROLNET = "real-txt2img-ipadapter-controlnet";

/** Prompt fragments: tagline + extra only (never freeform profile notes). */
export function buildUserPrompt(tagline: string, extra?: string): string {
  const parts = [tagline.trim(), extra?.trim()].filter(Boolean);
  return parts.join(", ");
}

export function refUploadName(taskId: string, filePath: string, form: Form): string {
  const dot = filePath.lastIndexOf(".");
  const ext =
    dot > 0 &&
    [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(filePath.slice(dot).toLowerCase())
      ? filePath.slice(dot).toLowerCase()
      : ".png";
  return `icy-ref-${form}-${taskId}${ext}`;
}

export function poseUploadName(taskId: string, filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  const ext =
    dot > 0 &&
    [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(filePath.slice(dot).toLowerCase())
      ? filePath.slice(dot).toLowerCase()
      : ".png";
  return `icy-pose-${taskId}${ext}`;
}

/**
 * Pick workflow for form given anchor + pose presence.
 * Preferred id is ignored when it conflicts with required inputs (e.g. IP-Adapter w/o ref).
 */
export function resolveFormWorkflowId(
  form: Form,
  hasAnchor: boolean,
  preferredId?: string,
  hasPose = false,
): string {
  if (form === "anime") {
    if (hasPose && hasAnchor) return WORKFLOW_ANIME_IPADAPTER_CONTROLNET;
    if (hasPose) return WORKFLOW_ANIME_CONTROLNET;
    if (hasAnchor) return WORKFLOW_ANIME_IPADAPTER;
    if (
      preferredId &&
      preferredId !== WORKFLOW_ANIME_IPADAPTER &&
      preferredId !== WORKFLOW_ANIME_IPADAPTER_CONTROLNET &&
      preferredId !== WORKFLOW_ANIME_CONTROLNET
    ) {
      return preferredId;
    }
    return WORKFLOW_ANIME_TXT2IMG;
  }

  if (hasPose && hasAnchor) return WORKFLOW_REAL_IPADAPTER_CONTROLNET;
  if (hasPose) return WORKFLOW_REAL_CONTROLNET;
  if (hasAnchor) return WORKFLOW_REAL_IPADAPTER;
  if (
    preferredId &&
    preferredId !== WORKFLOW_REAL_IPADAPTER &&
    preferredId !== WORKFLOW_REAL_IPADAPTER_CONTROLNET &&
    preferredId !== WORKFLOW_REAL_CONTROLNET
  ) {
    return preferredId;
  }
  return WORKFLOW_REAL_TXT2IMG;
}

export type RunFormOnceDeps = {
  generation: GenerationAdapter;
  storage: StorageAdapter;
  workflowsDir?: string;
  signal?: AbortSignal;
};

export type RunFormOnceInput = {
  taskId: string;
  form: Form;
  workflowId: string;
  userPrompt: string;
  negativePrompt?: string;
  seed: number;
  anchor: CharacterImageRow | null;
  /** Content-relative path to OpenPose/skeleton image, if any. */
  poseFilePath?: string | null;
  /** Filename stem under raw/tasks/{taskId}/seed-{seed}/ */
  outputName: string;
};

/**
 * Run one Comfy workflow for a single form/seed and write the first image to storage.
 * Returns the content-relative output key.
 */
export async function runFormOnce(
  input: RunFormOnceInput,
  deps: RunFormOnceDeps,
): Promise<string> {
  const def = getWorkflowById(defaultWorkflowRegistry, input.workflowId);
  if (!def) throw new Error(`未知 workflow: ${input.workflowId}`);

  const { inputImages, faceIdImageName, poseImageName } = await prepareInputs(
    input.taskId,
    input.form,
    input.anchor,
    input.poseFilePath,
    deps.storage,
  );

  const graph = loadWorkflowJson(def, deps.workflowsDir);
  const workflow = injectWorkflow(graph, def.injectionPoints, {
    positivePrompt: mergePrompts(def.basePrompt, input.userPrompt || "1girl"),
    negativePrompt: mergePrompts(def.baseNegativePrompt, input.negativePrompt),
    seed: input.seed,
    faceIdImageName,
    poseImageName,
  });

  const result = await deps.generation.run(
    { workflow, inputImages },
    undefined,
    deps.signal,
  );
  const img = result.images[0];
  if (!img) throw new Error(`workflow ${input.workflowId} 未产出图片`);

  const ext = img.filename.includes(".")
    ? img.filename.slice(img.filename.lastIndexOf("."))
    : ".png";
  const key = `raw/tasks/${input.taskId}/seed-${input.seed}/${input.outputName}${ext}`;
  await deps.storage.put(key, img.data);
  return key;
}

export function getWorkflowDef(id: string): WorkflowDefinition | undefined {
  return getWorkflowById(defaultWorkflowRegistry, id);
}

async function prepareInputs(
  taskId: string,
  form: Form,
  anchor: CharacterImageRow | null,
  poseFilePath: string | null | undefined,
  storage: StorageAdapter,
): Promise<{
  inputImages: { name: string; data: Buffer }[];
  faceIdImageName?: string;
  poseImageName?: string;
}> {
  const inputImages: { name: string; data: Buffer }[] = [];
  let faceIdImageName: string | undefined;
  let poseImageName: string | undefined;

  if (anchor) {
    try {
      const data = await storage.get(anchor.filePath);
      const name = refUploadName(taskId, anchor.filePath, form);
      inputImages.push({ name, data });
      faceIdImageName = name;
    } catch {
      throw new Error(`无法读取角色参考图: ${anchor.filePath}`);
    }
  }

  const posePath = poseFilePath?.trim();
  if (posePath) {
    try {
      const data = await storage.get(posePath);
      const name = poseUploadName(taskId, posePath);
      inputImages.push({ name, data });
      poseImageName = name;
    } catch {
      throw new Error(`无法读取姿势骨架图: ${posePath}`);
    }
  }

  return { inputImages, faceIdImageName, poseImageName };
}
