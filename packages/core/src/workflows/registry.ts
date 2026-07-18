/**
 * Workflow registry (ported concept from DrawForge): ComfyUI API-format
 * workflows stored as JSON files with declared injection points.
 * A PairConfig binds an anime workflow and a real workflow with the
 * shared-parameter mapping that makes paired generation possible.
 */
import type { Form } from "@icy/shared";

/** Named slots a workflow can accept. Keys map to ComfyUI node inputs. */
export interface InjectionPoints {
  /** nodeId.inputName for the positive prompt text. */
  positivePrompt: string;
  negativePrompt?: string;
  seed: string;
  /** ControlNet pose image input, if the workflow supports it. */
  poseImage?: string;
  /** FaceID/IPAdapter reference image input, if supported. */
  faceIdImage?: string;
  /** LoRA loader node, if the workflow supports dynamic LoRA. */
  lora?: { node: string; nameInput: string; weightInput: string };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  form: Form;
  /** Path to the ComfyUI API-format JSON, relative to the workflows dir. */
  file: string;
  injectionPoints: InjectionPoints;
  /** Base prompt always prepended (quality tags etc.). */
  basePrompt?: string;
  baseNegativePrompt?: string;
}

/** Binds two workflows into a paired-generation configuration. */
export interface PairConfig {
  id: string;
  name: string;
  animeWorkflowId: string;
  realWorkflowId: string;
  /**
   * Parameters shared verbatim across both runs to keep the pair aligned.
   * seed and pose are always shared; faceId is shared when the character
   * has FaceID refs.
   */
  shared: { seed: true; pose: boolean; faceId: boolean };
}

export interface WorkflowRegistry {
  workflows: WorkflowDefinition[];
  pairConfigs: PairConfig[];
}
