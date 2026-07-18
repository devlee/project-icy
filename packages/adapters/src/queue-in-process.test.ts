import { describe, expect, it } from "vitest";
import { InProcessQueue } from "./queue-in-process";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("InProcessQueue", () => {
  it("runs jobs serially with concurrency 1", async () => {
    const queue = new InProcessQueue(1);
    const order: string[] = [];

    const slow = queue.add(async () => {
      await tick();
      order.push("slow");
    });
    const fast = queue.add(async () => {
      order.push("fast");
    });

    await Promise.all([slow, fast]);
    expect(order).toEqual(["slow", "fast"]);
  });

  it("runs higher-priority jobs first (interactive preempts batch)", async () => {
    const queue = new InProcessQueue(1);
    const order: string[] = [];
    const jobs: Promise<unknown>[] = [];

    // Occupy the worker so subsequent adds stay queued and can be reordered.
    jobs.push(queue.add(() => tick()));
    jobs.push(queue.add(async () => void order.push("batch-1"), { priority: 0 }));
    jobs.push(queue.add(async () => void order.push("batch-2"), { priority: 0 }));
    jobs.push(queue.add(async () => void order.push("interactive"), { priority: 10 }));

    await Promise.all(jobs);
    expect(order).toEqual(["interactive", "batch-1", "batch-2"]);
  });

  it("returns job results and propagates failures", async () => {
    const queue = new InProcessQueue(1);

    await expect(queue.add(async () => "ok")).resolves.toBe("ok");
    await expect(
      queue.add(async () => {
        throw new Error("comfyui down");
      }),
    ).rejects.toThrow("comfyui down");
  });

  it("reports size and drains via onIdle", async () => {
    const queue = new InProcessQueue(1);
    void queue.add(() => tick());
    void queue.add(() => tick());

    expect(queue.size()).toBeGreaterThan(0);
    await queue.onIdle();
    expect(queue.size()).toBe(0);
  });
});
