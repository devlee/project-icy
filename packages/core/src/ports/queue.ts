/**
 * QueueAdapter abstracts task execution ordering.
 * Local impl: in-process priority queue, GPU-serial (concurrency 1).
 * Cloud impl (phase 4): Redis-backed queue.
 */
export interface QueueAdapter {
  /**
   * Enqueue a job. Higher priority runs earlier (interactive tasks preempt
   * scheduled batches in queue order; a running job is never interrupted).
   */
  add<T>(job: () => Promise<T>, opts?: { priority?: number }): Promise<T>;
  /** Jobs waiting + running. */
  size(): number;
  /** Resolves when the queue is fully drained. */
  onIdle(): Promise<void>;
}
