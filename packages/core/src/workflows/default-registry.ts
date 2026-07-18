import type { WorkflowRegistry } from "./registry";

/**
 * Built-in registry. Default graphs target Comfy Cloud checkpoints
 * (`wai-illustrious-sdxl` anime / `realvisxlV50` real).
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
    {
      id: "real-txt2img-stub",
      name: "Real txt2img (RealVisXL)",
      form: "real",
      file: "real-txt2img.stub.json",
      injectionPoints: {
        positivePrompt: "6.text",
        negativePrompt: "7.text",
        seed: "3.seed",
      },
      basePrompt:
        "photorealistic, raw photo, natural skin texture, cinematic lighting, highly detailed",
      baseNegativePrompt:
        "anime, cartoon, illustration, drawing, painting, lowres, bad anatomy, worst quality, plastic skin",
    },
    {
      id: "real-txt2img-ipadapter",
      name: "Real + IP-Adapter (reference)",
      form: "real",
      file: "real-txt2img-ipadapter.json",
      injectionPoints: {
        positivePrompt: "6.text",
        negativePrompt: "7.text",
        seed: "3.seed",
        faceIdImage: "10.image",
      },
      basePrompt:
        "photorealistic, raw photo, natural skin texture, cinematic lighting, highly detailed",
      baseNegativePrompt:
        "anime, cartoon, illustration, drawing, painting, lowres, bad anatomy, worst quality, plastic skin",
    },
  ],
  pairConfigs: [
    {
      id: "default-pair",
      name: "Default anime ↔ real (IP-Adapter)",
      animeWorkflowId: "anime-txt2img-ipadapter",
      realWorkflowId: "real-txt2img-ipadapter",
      shared: { seed: true, pose: false, faceId: true },
    },
  ],
};

export function getWorkflowById(
  registry: WorkflowRegistry,
  id: string,
): WorkflowRegistry["workflows"][number] | undefined {
  return registry.workflows.find((w) => w.id === id);
}

export function getPairConfigById(
  registry: WorkflowRegistry,
  id: string,
): WorkflowRegistry["pairConfigs"][number] | undefined {
  return registry.pairConfigs.find((c) => c.id === id);
}
