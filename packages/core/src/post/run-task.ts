import type { IcyDb } from "../db/client";
import type { ImageComposePort } from "../ports/image-compose";
import type { StorageAdapter } from "../ports/storage";
import { runComposePairSet } from "./run-compose";
import {
  getPostTask,
  markPostTaskDone,
  markPostTaskFailed,
  markPostTaskRunning,
  PostTaskError,
} from "./tasks";

export async function runPostTask(
  taskId: string,
  deps: { db: IcyDb; storage: StorageAdapter; compose: ImageComposePort },
): Promise<void> {
  const task = getPostTask(deps.db, taskId);
  if (!task) throw new PostTaskError("后期任务不存在", "not_found");
  if (task.status !== "queued") {
    throw new PostTaskError(`后期任务状态不可执行: ${task.status}`, "conflict");
  }
  markPostTaskRunning(deps.db, taskId);
  try {
    const outputKeys = await runComposePairSet(task.pairSetId, deps);
    markPostTaskDone(deps.db, taskId, outputKeys);
  } catch (error) {
    markPostTaskFailed(
      deps.db,
      taskId,
      error instanceof Error ? error.message : String(error),
    );
  }
}
