import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { TaskStatus } from "@icy/shared";
import type { IcyDb } from "../db/client";
import { pairSets, postTasks } from "../db/schema";

export class PostTaskError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "not_found" | "conflict",
  ) {
    super(message);
    this.name = "PostTaskError";
  }
}

export function getPostTask(db: IcyDb, id: string) {
  return db.select().from(postTasks).where(eq(postTasks.id, id)).get() ?? null;
}

export function getLatestPostTaskForPairSet(db: IcyDb, pairSetId: string) {
  return (
    db
      .select()
      .from(postTasks)
      .where(eq(postTasks.pairSetId, pairSetId))
      .orderBy(desc(postTasks.createdAt))
      .limit(1)
      .get() ?? null
  );
}

export function createPostTask(
  db: IcyDb,
  input: { pairSetId: string; priority?: number },
) {
  const pairSetId = input.pairSetId.trim();
  if (!pairSetId) throw new PostTaskError("须指定 PairSet", "validation");
  const pair = db.select().from(pairSets).where(eq(pairSets.id, pairSetId)).get();
  if (!pair) throw new PostTaskError("PairSet 不存在", "not_found");
  if (pair.reviewStatus !== "approved") {
    throw new PostTaskError("仅已通过的 PairSet 可后期处理", "conflict");
  }
  if (pair.postProcessStatus === "composed") {
    throw new PostTaskError("该 PairSet 已完成拼版", "conflict");
  }

  const active = db
    .select()
    .from(postTasks)
    .where(
      and(
        eq(postTasks.pairSetId, pairSetId),
        inArray(postTasks.status, ["queued", "running"]),
      ),
    )
    .orderBy(desc(postTasks.createdAt))
    .limit(1)
    .get();
  if (active) return active;

  const id = nanoid();
  db.insert(postTasks)
    .values({
      id,
      pairSetId,
      status: "queued",
      priority: input.priority ?? 5,
    })
    .run();
  return getPostTask(db, id)!;
}

export function listQueuedPostTasks(db: IcyDb, opts: { limit?: number } = {}) {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  return db
    .select()
    .from(postTasks)
    .where(eq(postTasks.status, "queued"))
    .orderBy(desc(postTasks.priority), asc(postTasks.createdAt))
    .limit(limit)
    .all();
}

export function markPostTaskRunning(db: IcyDb, id: string) {
  const row = getPostTask(db, id);
  if (!row) throw new PostTaskError("后期任务不存在", "not_found");
  if (row.status !== "queued") {
    throw new PostTaskError(`后期任务状态不可开始: ${row.status}`, "conflict");
  }
  db.update(postTasks)
    .set({ status: "running", error: null, startedAt: new Date(), updatedAt: new Date() })
    .where(eq(postTasks.id, id))
    .run();
  return getPostTask(db, id)!;
}

export function markPostTaskDone(db: IcyDb, id: string, outputKeys: string[]) {
  db.update(postTasks)
    .set({
      status: "done",
      error: null,
      outputKeys,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(postTasks.id, id))
    .run();
  return getPostTask(db, id)!;
}

export function markPostTaskFailed(db: IcyDb, id: string, error: string) {
  db.update(postTasks)
    .set({ status: "failed", error, finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(postTasks.id, id))
    .run();
  return getPostTask(db, id)!;
}

export function failInterruptedPostTasks(
  db: IcyDb,
  message = "worker 已重启；上次后期处理状态未知，请重试",
): string[] {
  const rows = db
    .select({ id: postTasks.id })
    .from(postTasks)
    .where(eq(postTasks.status, "running"))
    .all();
  if (rows.length === 0) return [];
  db.update(postTasks)
    .set({ status: "failed", error: message, finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(postTasks.status, "running"))
    .run();
  return rows.map((row) => row.id);
}

export function retryPostTask(db: IcyDb, id: string) {
  const row = getPostTask(db, id);
  if (!row) throw new PostTaskError("后期任务不存在", "not_found");
  if (!(new Set<TaskStatus>(["failed", "cancelled"])).has(row.status)) {
    throw new PostTaskError("仅失败或已取消的后期任务可重试", "conflict");
  }
  db.update(postTasks)
    .set({
      status: "queued",
      error: null,
      outputKeys: null,
      startedAt: null,
      finishedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(postTasks.id, id))
    .run();
  return getPostTask(db, id)!;
}
