export const CHARACTER_STATUSES = ["draft", "growing", "featured", "archived"] as const;
export type CharacterStatus = (typeof CHARACTER_STATUSES)[number];

export const FACTOR_CATEGORIES = [
  "style",
  "scene",
  "outfit",
  "lighting",
  "pose",
  "expression",
  "composition",
  "other",
] as const;
export type FactorCategory = (typeof FACTOR_CATEGORIES)[number];

export const TASK_TYPES = ["pair", "single", "batch"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ["queued", "running", "done", "failed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const REVIEW_STATUSES = ["pending", "approved", "rejected", "hold"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const POST_PROCESS_STATUSES = ["raw", "enhanced", "composed"] as const;
export type PostProcessStatus = (typeof POST_PROCESS_STATUSES)[number];

export const ASSET_KINDS = ["enhanced", "composite", "platform-sized"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const PLATFORMS = ["xiaohongshu", "x", "bilibili", "generic"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PUBLISH_STATUSES = ["planned", "ready", "published"] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

/** Image form within a pair: anime (2D) or real (photorealistic). */
export const FORMS = ["anime", "real"] as const;
export type Form = (typeof FORMS)[number];
