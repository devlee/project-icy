/** Expand seed strategy into concrete seed integers (max 24). */
export function expandSeeds(
  strategy: { kind: "fixed"; seed: number } | { kind: "random"; count: number },
): number[] {
  if (strategy.kind === "fixed") {
    return [Math.trunc(strategy.seed) >>> 0];
  }
  const count = Math.min(24, Math.max(1, Math.trunc(strategy.count)));
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push(Math.floor(Math.random() * 2 ** 32));
  }
  return seeds;
}
