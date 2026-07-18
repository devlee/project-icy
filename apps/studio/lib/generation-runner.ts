import { runSingleGenerationTask } from "@icy/core";
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
          await runSingleGenerationTask(taskId, {
            db: getDb(),
            generation: getGeneration(),
            storage: getStorage(),
          });
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
