import type { Platform } from "@icy/shared";

export type ComposedImage = {
  data: Buffer;
  width: number;
  height: number;
};

export type PlatformExport = ComposedImage & {
  platform: Platform;
  /** Distinguishes multiple exports on the same platform enum (e.g. square). */
  label: string;
};

export type ComposeSideBySideInput = {
  anime: Buffer;
  real: Buffer;
  /** Footer declaration, e.g. "AI Generated · 本内容由 AI 生成" */
  declaration: string;
};

export type ComposeSideBySideResult = {
  composite: ComposedImage;
  platforms: PlatformExport[];
};

/**
 * Image composition port (Sharp locally; cloud image worker later).
 * Produces a side-by-side pair composite plus platform-sized exports.
 */
export type EnhanceImageInput = {
  image: Buffer;
};

export type EnhanceImageResult = ComposedImage;

export interface ImageComposePort {
  composeSideBySide(
    input: ComposeSideBySideInput,
  ): Promise<ComposeSideBySideResult>;
  /**
   * Optional local enhance (sharpen/mild denoise). Not Comfy face-fix —
   * that remains deferred when InstantID/restore workflows are available.
   */
  enhanceImage(input: EnhanceImageInput): Promise<EnhanceImageResult>;
}
