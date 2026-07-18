import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkflowDefinition } from "./registry";

/** Absolute path to `packages/core/workflows` (JSON graphs, not under src/). */
export function defaultWorkflowsDir(): string {
  // …/packages/core/src/workflows/load.ts → …/packages/core/workflows
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../workflows");
}

export function resolveWorkflowFile(
  def: WorkflowDefinition,
  workflowsDir: string = defaultWorkflowsDir(),
): string {
  return path.join(workflowsDir, def.file);
}

export function loadWorkflowJson(
  def: WorkflowDefinition,
  workflowsDir: string = defaultWorkflowsDir(),
): Record<string, unknown> {
  const file = resolveWorkflowFile(def, workflowsDir);
  const raw = readFileSync(file, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`工作流 JSON 无效: ${file}`);
  }
  return parsed as Record<string, unknown>;
}
