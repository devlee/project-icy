import PQueue from "p-queue";
import type { QueueAdapter } from "@icy/core";

export class InProcessQueue implements QueueAdapter {
  private readonly queue: PQueue;

  constructor(concurrency = 1) {
    this.queue = new PQueue({ concurrency });
  }

  add<T>(job: () => Promise<T>, opts?: { priority?: number }): Promise<T> {
    return this.queue.add(job, { priority: opts?.priority ?? 0, throwOnTimeout: true });
  }

  size(): number {
    return this.queue.size + this.queue.pending;
  }

  onIdle(): Promise<void> {
    return this.queue.onIdle();
  }
}
