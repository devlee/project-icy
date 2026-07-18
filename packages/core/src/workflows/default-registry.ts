import type { WorkflowRegistry } from "./registry";

/**
 * Built-in registry. Default graph targets Comfy Cloud's
 * `wai-illustrious-sdxl.safetensors` (replace via exporting your own API JSON
 * when you want a different model / node graph).
 */
export const defaultWorkflowRegistry: WorkflowRegistry = {
  workflows: [
    {
      id: "anime-txt2img-stub",
      name: "Anime txt2img (Illustrious SDXL)",
      form: "anime",
      file: "anime-txt2img.stub.json",
      injectionPoints: {
        positivePrompt: "6.text",
        negativePrompt: "7.text",
        seed: "3.seed",
      },
      basePrompt: "masterpiece, best quality, anime style",
      baseNegativePrompt: "lowres, bad anatomy, bad hands, text, error, worst quality",
    },
    {
      id: "anime-txt2img-ipadapter",
      name: "Anime + IP-Adapter (reference)",
      form: "anime",
      file: "anime-txt2img-ipadapter.json",
      injectionPoints: {
        positivePrompt: "6.text",
        negativePrompt: "7.text",
        seed: "3.seed",
        faceIdImage: "10.image",
      },
      basePrompt: "masterpiece, best quality, anime style",
      baseNegativePrompt: "lowres, bad anatomy, bad hands, text, error, worst quality",
    },
  ],
  pairConfigs: [],
};

export function getWorkflowById(
  registry: WorkflowRegistry,
  id: string,
): WorkflowRegistry["workflows"][number] | undefined {
  return registry.workflows.find((w) => w.id === id);
}
