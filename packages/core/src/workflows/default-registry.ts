import type { WorkflowRegistry } from "./registry";

/**
 * Built-in registry. Default graphs target Comfy Cloud checkpoints
 * (`wai-illustrious-sdxl` anime / `realvisxlV50` real).
 * ControlNet model default: `OpenPoseXL2.safetensors` (override in workflow JSON if Cloud differs).
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
      id: "anime-txt2img-controlnet",
      name: "Anime + ControlNet (pose)",
      form: "anime",
      file: "anime-txt2img-controlnet.json",
      injectionPoints: {
        positivePrompt: "6.text",
        negativePrompt: "7.text",
        seed: "3.seed",
        poseImage: "20.image",
      },
      basePrompt: "masterpiece, best quality, anime style",
      baseNegativePrompt: "lowres, bad anatomy, bad hands, text, error, worst quality",
    },
    {
      id: "anime-txt2img-ipadapter-controlnet",
      name: "Anime + IP-Adapter + ControlNet",
      form: "anime",
      file: "anime-txt2img-ipadapter-controlnet.json",
      injectionPoints: {
        positivePrompt: "6.text",
        negativePrompt: "7.text",
        seed: "3.seed",
        faceIdImage: "10.image",
        poseImage: "20.image",
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
    {
      id: "real-txt2img-controlnet",
      name: "Real + ControlNet (pose)",
      form: "real",
      file: "real-txt2img-controlnet.json",
      injectionPoints: {
        positivePrompt: "6.text",
        negativePrompt: "7.text",
        seed: "3.seed",
        poseImage: "20.image",
      },
      basePrompt:
        "photorealistic, raw photo, natural skin texture, cinematic lighting, highly detailed",
      baseNegativePrompt:
        "anime, cartoon, illustration, drawing, painting, lowres, bad anatomy, worst quality, plastic skin",
    },
    {
      id: "real-txt2img-ipadapter-controlnet",
      name: "Real + IP-Adapter + ControlNet",
      form: "real",
      file: "real-txt2img-ipadapter-controlnet.json",
      injectionPoints: {
        positivePrompt: "6.text",
        negativePrompt: "7.text",
        seed: "3.seed",
        faceIdImage: "10.image",
        poseImage: "20.image",
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
      name: "Default anime ↔ real (IP-Adapter + optional ControlNet)",
      animeWorkflowId: "anime-txt2img-ipadapter",
      realWorkflowId: "real-txt2img-ipadapter",
      shared: { seed: true, pose: true, faceId: true },
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
