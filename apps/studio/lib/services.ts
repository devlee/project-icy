import {
  ComfyUIGenerationAdapter,
  InProcessQueue,
  LocalStorageAdapter,
} from "@icy/adapters";
import { contentRoot } from "./paths";

const globalForServices = globalThis as unknown as {
  __icyGeneration?: ComfyUIGenerationAdapter;
  __icyQueue?: InProcessQueue;
  __icyStorage?: LocalStorageAdapter;
};

export function getGeneration(): ComfyUIGenerationAdapter {
  if (!globalForServices.__icyGeneration) {
    globalForServices.__icyGeneration = new ComfyUIGenerationAdapter();
  }
  return globalForServices.__icyGeneration;
}

export function getQueue(): InProcessQueue {
  if (!globalForServices.__icyQueue) {
    globalForServices.__icyQueue = new InProcessQueue(1);
  }
  return globalForServices.__icyQueue;
}

export function getStorage(): LocalStorageAdapter {
  if (!globalForServices.__icyStorage) {
    globalForServices.__icyStorage = new LocalStorageAdapter(contentRoot());
  }
  return globalForServices.__icyStorage;
}
