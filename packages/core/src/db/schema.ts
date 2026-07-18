/**
 * project-icy core data model (see docs/product-design.md §2.1).
 *
 * Conventions:
 * - Primary keys are nanoid strings.
 * - Timestamps are integer epoch milliseconds (SQLite-compatible, Postgres-portable).
 * - Enum-like columns are TEXT constrained by TypeScript unions from @icy/shared.
 * - File columns store paths relative to the content root (resolved via StorageAdapter).
 */
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import type {
  AssetKind,
  CharacterOrigin,
  CharacterStatus,
  FactorCategory,
  Form,
  Platform,
  PostProcessStatus,
  PublishStatus,
  ReviewStatus,
  TaskStatus,
  TaskType,
} from "@icy/shared";

const id = () => text("id").primaryKey();
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// ---------------------------------------------------------------------------
// Characters — the single source of truth for "what a character looks like"
// ---------------------------------------------------------------------------

export const characters = sqliteTable("characters", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").$type<CharacterStatus>().notNull().default("draft"),
  /** original = OC (commercial-safe); ip_reference = research only. */
  origin: text("origin").$type<CharacterOrigin>().notNull().default("original"),
  /** IP franchise name when origin is ip_reference (e.g. 原神、鬼灭之刃). */
  ipSource: text("ip_source").notNull().default(""),
  /** Persona, backstory, personality — freeform markdown. */
  profile: text("profile").notNull().default(""),
  /** Short one-liner used on portal and lists. */
  tagline: text("tagline").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Reference images attached to a character: dual-form anchors and FaceID refs.
 * Promoted from generation results or uploaded manually.
 */
export const characterImages = sqliteTable(
  "character_images",
  {
    id: id(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"anchor" | "faceid_ref">().notNull(),
    /** Which form this reference belongs to (anchors only; FaceID refs are real-form by nature). */
    form: text("form").$type<Form>(),
    filePath: text("file_path").notNull(),
    /** Primary anchor is the canonical look for its form. */
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    /** Freeform usability notes, e.g. "frontal", "side profile", "smiling". */
    note: text("note").notNull().default(""),
    /** Set when promoted from a generation result. */
    sourcePairSetId: text("source_pair_set_id"),
    createdAt: createdAt(),
  },
  (t) => [index("character_images_character_idx").on(t.characterId, t.kind)],
);

export const characterLoras = sqliteTable(
  "character_loras",
  {
    id: id(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Path to the model file, relative to the ComfyUI models dir. */
    modelPath: text("model_path").notNull(),
    triggerWords: text("trigger_words").notNull().default(""),
    recommendedWeight: real("recommended_weight").notNull().default(0.8),
    /** Which form's workflow this LoRA applies to; null = both. */
    form: text("form").$type<Form>(),
    createdAt: createdAt(),
  },
  (t) => [index("character_loras_character_idx").on(t.characterId)],
);

// ---------------------------------------------------------------------------
// Factor library — ported from the 300-factor library
// ---------------------------------------------------------------------------

export const factors = sqliteTable(
  "factors",
  {
    id: id(),
    category: text("category").$type<FactorCategory>().notNull(),
    name: text("name").notNull(),
    /** Prompt fragment injected into workflows. */
    promptFragment: text("prompt_fragment").notNull(),
    /** Optional negative-prompt fragment. */
    negativeFragment: text("negative_fragment").notNull().default(""),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("factors_category_idx").on(t.category)],
);

/** A character's default factors (e.g. fixed hair color, eye color, build). */
export const characterFactors = sqliteTable(
  "character_factors",
  {
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    factorId: text("factor_id")
      .notNull()
      .references(() => factors.id, { onDelete: "cascade" }),
  },
  (t) => [index("character_factors_pk").on(t.characterId, t.factorId)],
);

// ---------------------------------------------------------------------------
// Poses — ControlNet skeleton inputs
// ---------------------------------------------------------------------------

export const poses = sqliteTable("poses", {
  id: id(),
  name: text("name").notNull(),
  /** OpenPose/skeleton image path. */
  filePath: text("file_path").notNull(),
  tags: text("tags").notNull().default(""),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Series & generation tasks
// ---------------------------------------------------------------------------

export const series = sqliteTable(
  "series",
  {
    id: id(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    theme: text("theme").notNull().default(""),
    /** Factor pool for batch sampling, JSON: { factorIds: string[], perBatch: number }. */
    batchConfig: text("batch_config", { mode: "json" }).$type<SeriesBatchConfig | null>(),
    /** Cron expression for scheduled batches; null = manual only. */
    scheduleCron: text("schedule_cron"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("series_character_idx").on(t.characterId)],
);

export interface SeriesBatchConfig {
  factorIds: string[];
  /** Pair sets to generate per batch run. */
  perBatch: number;
  poseIds?: string[];
}

export const generationTasks = sqliteTable(
  "generation_tasks",
  {
    id: id(),
    type: text("type").$type<TaskType>().notNull(),
    status: text("status").$type<TaskStatus>().notNull().default("queued"),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id),
    seriesId: text("series_id").references(() => series.id),
    /** Full generation parameters, JSON — see GenerationParams. */
    params: text("params", { mode: "json" }).$type<GenerationParams>().notNull(),
    /** Interactive tasks preempt scheduled batch tasks. */
    priority: integer("priority").notNull().default(0),
    error: text("error"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("generation_tasks_status_idx").on(t.status, t.priority),
    index("generation_tasks_character_idx").on(t.characterId),
  ],
);

export interface GenerationParams {
  /** Fixed seed for reproduction, or count of random seeds. */
  seedStrategy: { kind: "fixed"; seed: number } | { kind: "random"; count: number };
  /** Concrete seeds materialized when the task is created; preserved across retries. */
  seeds?: number[];
  poseId?: string;
  factorIds: string[];
  /** Workflow registry ids for each form. */
  animeWorkflowId: string;
  /**
   * Real-form workflow id for pair tasks.
   * Single-image tasks leave this empty and only use animeWorkflowId.
   */
  realWorkflowId: string;
  /** Extra prompt text appended after factor fragments / character tags. */
  extraPrompt?: string;
  /** Relative storage keys written by a completed (or partial) run. */
  outputKeys?: string[];
}

// ---------------------------------------------------------------------------
// PairSet — the fundamental content unit (an anime/real pair, never split)
// ---------------------------------------------------------------------------

export const pairSets = sqliteTable(
  "pair_sets",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => generationTasks.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id),
    seriesId: text("series_id").references(() => series.id),
    seed: integer("seed").notNull(),
    poseId: text("pose_id").references(() => poses.id),
    animeImagePath: text("anime_image_path").notNull(),
    realImagePath: text("real_image_path").notNull(),
    reviewStatus: text("review_status").$type<ReviewStatus>().notNull().default("pending"),
    /** 1–5, set during review. */
    rating: integer("rating"),
    postProcessStatus: text("post_process_status")
      .$type<PostProcessStatus>()
      .notNull()
      .default("raw"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("pair_sets_review_idx").on(t.reviewStatus),
    index("pair_sets_character_idx").on(t.characterId),
    index("pair_sets_task_idx").on(t.taskId),
  ],
);

// ---------------------------------------------------------------------------
// Post tasks — persistent Sharp/Comfy post-processing work for the worker
// ---------------------------------------------------------------------------

export const postTasks = sqliteTable(
  "post_tasks",
  {
    id: id(),
    pairSetId: text("pair_set_id")
      .notNull()
      .references(() => pairSets.id, { onDelete: "cascade" }),
    status: text("status").$type<TaskStatus>().notNull().default("queued"),
    priority: integer("priority").notNull().default(5),
    error: text("error"),
    outputKeys: text("output_keys", { mode: "json" }).$type<string[]>(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("post_tasks_status_idx").on(t.status, t.priority),
    index("post_tasks_pair_idx").on(t.pairSetId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Assets — publishable outputs derived from approved pair sets
// ---------------------------------------------------------------------------

export const assets = sqliteTable(
  "assets",
  {
    id: id(),
    pairSetId: text("pair_set_id")
      .notNull()
      .references(() => pairSets.id, { onDelete: "cascade" }),
    kind: text("kind").$type<AssetKind>().notNull(),
    /** Which form for enhanced singles; null for composites. */
    form: text("form").$type<Form>(),
    platform: text("platform").$type<Platform>().notNull().default("generic"),
    filePath: text("file_path").notNull(),
    watermarked: integer("watermarked", { mode: "boolean" }).notNull().default(false),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("assets_pair_set_idx").on(t.pairSetId)],
);

// ---------------------------------------------------------------------------
// Publish plans — the calendar (semi-automated by design; final post is manual)
// ---------------------------------------------------------------------------

export const publishPlans = sqliteTable(
  "publish_plans",
  {
    id: id(),
    /** Target date, YYYY-MM-DD (local). */
    date: text("date").notNull(),
    platform: text("platform").$type<Platform>().notNull(),
    status: text("status").$type<PublishStatus>().notNull().default("planned"),
    caption: text("caption").notNull().default(""),
    hashtags: text("hashtags").notNull().default(""),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    /** Post URL and early metrics, filled in after manual publishing. */
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("publish_plans_date_idx").on(t.date, t.platform)],
);

export const publishPlanAssets = sqliteTable(
  "publish_plan_assets",
  {
    planId: text("plan_id")
      .notNull()
      .references(() => publishPlans.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("publish_plan_assets_pk").on(t.planId, t.assetId)],
);
