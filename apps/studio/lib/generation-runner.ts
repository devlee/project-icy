import {
  getGenerationTask,
  runPairGenerationTask,
  runSingleGenerationTask,
} from "@icy/core";
import { getDb } from "./db";
import { getGeneration, getQueue, getStorage } from "./services";

const enqueued = new Set<string>();

/** Enqueue a queued DB task onto the in-process GPU queue (idempotent per id). */
export function enqueueGenerationTask(taskId: string): void {
  if (enqueued.has(taskId)) return;
  enqueued.add(taskId);

  void getQueue()
    .add(
      async () => {
        try {
          const db = getDb();
          const task = getGenerationTask(db, taskId);
          if (!task) return;
          const deps = {
            db,
            generation: getGeneration(),
            storage: getStorage(),
          };
          if (task.type === "pair") {
            await runPairGenerationTask(taskId, deps);
          } else {
            await runSingleGenerationTask(taskId, deps);
          }
        } finally {
          enqueued.delete(taskId);
        }
      },
      { priority: 10 },
    )
    .catch(() => {
      enqueued.delete(taskId);
    });
}
