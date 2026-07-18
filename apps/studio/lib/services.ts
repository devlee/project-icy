import {
  ComfyUIGenerationAdapter,
  LocalStorageAdapter,
  SharpImageCompose,
} from "@icy/adapters";
import { contentRoot } from "./paths";

const globalForServices = globalThis as unknown as {
  __icyGeneration?: ComfyUIGenerationAdapter;
  __icyStorage?: LocalStorageAdapter;
  __icyCompose?: SharpImageCompose;
};

export function getGeneration(): ComfyUIGenerationAdapter {
  if (!globalForServices.__icyGeneration) {
    globalForServices.__icyGeneration = new ComfyUIGenerationAdapter();
  }
  return globalForServices.__icyGeneration;
}

export function getStorage(): LocalStorageAdapter {
  if (!globalForServices.__icyStorage) {
    globalForServices.__icyStorage = new LocalStorageAdapter(contentRoot());
  }
  return globalForServices.__icyStorage;
}

export function getImageCompose(): SharpImageCompose {
  if (!globalForServices.__icyCompose) {
    globalForServices.__icyCompose = new SharpImageCompose();
  }
  return globalForServices.__icyCompose;
}
