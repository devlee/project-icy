import { describe, expect, it } from "vitest";
import { injectWorkflow, mergePrompts, parseInjectionPath, WorkflowInjectError } from "./inject";
import { defaultWorkflowRegistry } from "./default-registry";
import { loadWorkflowJson } from "./load";

describe("parseInjectionPath", () => {
  it("splits nodeId.inputName", () => {
    expect(parseInjectionPath("6.text")).toEqual({ nodeId: "6", inputName: "text" });
  });

  it("rejects bad paths", () => {
    expect(() => parseInjectionPath("noseed")).toThrow(WorkflowInjectError);
  });
});

describe("injectWorkflow", () => {
  it("fills prompt and seed on the stub graph without mutating the original", () => {
    const def = defaultWorkflowRegistry.workflows[0]!;
    const original = loadWorkflowJson(def);
    const seedBefore = (original["3"] as { inputs: { seed: number } }).inputs.seed;

    const filled = injectWorkflow(original, def.injectionPoints, {
      positivePrompt: "1girl, silver hair",
      negativePrompt: "blurry",
      seed: 42,
    });

    expect((original["3"] as { inputs: { seed: number } }).inputs.seed).toBe(seedBefore);
    expect((filled["6"] as { inputs: { text: string } }).inputs.text).toBe("1girl, silver hair");
    expect((filled["7"] as { inputs: { text: string } }).inputs.text).toBe("blurry");
    expect((filled["3"] as { inputs: { seed: number } }).inputs.seed).toBe(42);
  });
});

describe("mergePrompts", () => {
  it("joins base and user", () => {
    expect(mergePrompts("masterpiece", "1girl")).toBe("masterpiece, 1girl");
    expect(mergePrompts("masterpiece", "")).toBe("masterpiece");
    expect(mergePrompts(undefined, "1girl")).toBe("1girl");
  });
});
