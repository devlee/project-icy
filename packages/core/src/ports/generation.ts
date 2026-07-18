/**
 * GenerationAdapter abstracts the image-generation backend.
 * Local impl (v1): ComfyUI over HTTP + WebSocket on this machine/LAN.
 * Cloud impl (phase 4): serverless GPU (RunPod/Modal).
 *
 * The adapter executes ONE workflow run; pairing (anime + real with shared
 * seed/pose/FaceID) is orchestrated inside @icy/core, above this port.
 */

export interface GenerationRequest {
  /** ComfyUI API-format workflow JSON with injection points already filled. */
  workflow: Record<string, unknown>;
  /** Input images referenced by the workflow (pose skeleton, FaceID refs). */
  inputImages: { name: string; data: Buffer }[];
}

export interface GenerationProgress {
  /** 0–1 overall progress if determinable. */
  fraction: number | null;
  currentNode: string | null;
}

export interface GenerationResult {
  images: { filename: string; data: Buffer }[];
  durationMs: number;
}

export interface GenerationAdapter {
  /** Health check: is the backend reachable and ready? */
  ping(): Promise<{ ok: boolean; detail?: string }>;
  run(
    request: GenerationRequest,
    onProgress?: (p: GenerationProgress) => void,
    signal?: AbortSignal,
  ): Promise<GenerationResult>;
}
