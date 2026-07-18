import { and, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { Platform, PublishStatus, TaskStatus, TaskType } from "@icy/shared";
import type { IcyDb } from "../db/client";
import { characters, generationTasks, pairSets } from "../db/schema";
import { getReviewStats } from "../generation/pair-sets";
import { getInventoryStats, listInventoryPacks, listPublishPlans, todayLocalDate } from "../publish/plans";

export type StudioOverviewTask = {
  id: string;
  type: TaskType;
  status: Extract<TaskStatus, "queued" | "running">;
  characterName: string;
  createdAt: Date;
};

export type StudioOverviewPlan = {
  id: string;
  platform: Platform;
  status: PublishStatus;
  caption: string;
  previewPath: string | null;
};

export type StudioOverview = {
  today: string;
  activeTaskCount: number;
  activeTasks: StudioOverviewTask[];
  todayReviewedCount: number;
  inventory: {
    readyPacks: number;
    dailyBurn: number;
    days: number;
  };
  characterStock: Array<{
    characterId: string;
    characterName: string;
    count: number;
  }>;
  todayPlans: StudioOverviewPlan[];
  review: {
    pending: number;
    approved: number;
    rejected: number;
    hold: number;
    total: number;
  };
};

export type StudioOverviewOptions = {
  now?: Date;
  dailyBurn?: number;
  taskLimit?: number;
};

function localDayBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Read-only summary used by the Studio shell and dashboard. */
export function getStudioOverview(
  db: IcyDb,
  options: StudioOverviewOptions = {},
): StudioOverview {
  const now = options.now ?? new Date();
  const today = todayLocalDate(now);
  const taskLimit = Math.min(20, Math.max(1, Math.trunc(options.taskLimit ?? 3)));
  const activeStatuses = ["queued", "running"] as const;

  const activeTaskCount =
    db
      .select({ n: count() })
      .from(generationTasks)
      .where(inArray(generationTasks.status, activeStatuses))
      .get()?.n ?? 0;

  const activeTasks = db
    .select({
      id: generationTasks.id,
      type: generationTasks.type,
      status: generationTasks.status,
      characterName: characters.name,
      createdAt: generationTasks.createdAt,
    })
    .from(generationTasks)
    .innerJoin(characters, eq(generationTasks.characterId, characters.id))
    .where(inArray(generationTasks.status, activeStatuses))
    .orderBy(desc(generationTasks.priority), desc(generationTasks.createdAt))
    .limit(taskLimit)
    .all()
    .map((task) => ({
      ...task,
      status: task.status as StudioOverviewTask["status"],
    }));

  const { start, end } = localDayBounds(now);
  const todayReviewedCount =
    db
      .select({ n: count() })
      .from(pairSets)
      .where(
        and(
          gte(pairSets.reviewedAt, start),
          lt(pairSets.reviewedAt, end),
        ),
      )
      .get()?.n ?? 0;

  const inventory = getInventoryStats(db, { dailyBurn: options.dailyBurn });
  const stockByCharacter = new Map<
    string,
    { characterId: string; characterName: string; count: number }
  >();
  for (const pack of listInventoryPacks(db, { limit: 200 })) {
    const current = stockByCharacter.get(pack.characterId);
    if (current) {
      current.count += 1;
    } else {
      stockByCharacter.set(pack.characterId, {
        characterId: pack.characterId,
        characterName: pack.characterName,
        count: 1,
      });
    }
  }
  const characterStock = [...stockByCharacter.values()].sort(
    (a, b) => b.count - a.count || a.characterName.localeCompare(b.characterName),
  );

  const todayPlans = listPublishPlans(db, { date: today, limit: 20 }).map(
    (plan) => ({
      id: plan.id,
      platform: plan.platform,
      status: plan.status,
      caption: plan.caption,
      previewPath: plan.assets[0]?.filePath ?? null,
    }),
  );

  const reviewStats = getReviewStats(db);
  return {
    today,
    activeTaskCount,
    activeTasks,
    todayReviewedCount,
    inventory,
    characterStock,
    todayPlans,
    review: {
      pending: reviewStats.byStatus.pending,
      approved: reviewStats.byStatus.approved,
      rejected: reviewStats.byStatus.rejected,
      hold: reviewStats.byStatus.hold,
      total: reviewStats.total,
    },
  };
}
