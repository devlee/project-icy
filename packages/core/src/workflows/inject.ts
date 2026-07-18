import type { InjectionPoints } from "./registry";

export class WorkflowInjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowInjectError";
  }
}

export type InjectionValues = {
  positivePrompt?: string;
  negativePrompt?: string;
  seed?: number;
  /** Filename already uploaded to ComfyUI (or present in input dir). */
  poseImageName?: string;
  faceIdImageName?: string;
  loraName?: string;
  loraWeight?: number;
};

/** Parse `nodeId.inputName` injection path. */
export function parseInjectionPath(path: string): { nodeId: string; inputName: string } {
  const dot = path.indexOf(".");
  if (dot <= 0 || dot === path.length - 1) {
    throw new WorkflowInjectError(`无效注入路径: ${path}`);
  }
  return { nodeId: path.slice(0, dot), inputName: path.slice(dot + 1) };
}

function deepCloneWorkflow(workflow: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(workflow);
}

function setNodeInput(
  workflow: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const { nodeId, inputName } = parseInjectionPath(path);
  const node = workflow[nodeId];
  if (!node || typeof node !== "object") {
    throw new WorkflowInjectError(`工作流缺少节点 ${nodeId}（路径 ${path}）`);
  }
  const record = node as { inputs?: Record<string, unknown> };
  if (!record.inputs || typeof record.inputs !== "object") {
    throw new WorkflowInjectError(`节点 ${nodeId} 缺少 inputs`);
  }
  record.inputs[inputName] = value;
}

/**
 * Fill declared injection points on a ComfyUI API-format workflow.
 * Returns a deep clone; the original graph is never mutated.
 */
export function injectWorkflow(
  workflow: Record<string, unknown>,
  points: InjectionPoints,
  values: InjectionValues,
): Record<string, unknown> {
  const next = deepCloneWorkflow(workflow);

  if (values.positivePrompt !== undefined) {
    const base = values.positivePrompt;
    setNodeInput(next, points.positivePrompt, base);
  }
  if (values.negativePrompt !== undefined && points.negativePrompt) {
    setNodeInput(next, points.negativePrompt, values.negativePrompt);
  }
  if (values.seed !== undefined) {
    setNodeInput(next, points.seed, values.seed);
  }
  if (values.poseImageName !== undefined && points.poseImage) {
    setNodeInput(next, points.poseImage, values.poseImageName);
  }
  if (values.faceIdImageName !== undefined && points.faceIdImage) {
    setNodeInput(next, points.faceIdImage, values.faceIdImageName);
  }
  if (points.lora) {
    if (values.loraName !== undefined) {
      setNodeInput(next, `${points.lora.node}.${points.lora.nameInput}`, values.loraName);
    }
    if (values.loraWeight !== undefined) {
      setNodeInput(next, `${points.lora.node}.${points.lora.weightInput}`, values.loraWeight);
    }
  }

  return next;
}

/** Prepend base prompts from a workflow definition onto user prompts. */
export function mergePrompts(
  base: string | undefined,
  user: string | undefined,
): string | undefined {
  const b = base?.trim() ?? "";
  const u = user?.trim() ?? "";
  if (!b && !u) return undefined;
  if (!b) return u;
  if (!u) return b;
  return `${b}, ${u}`;
}
