import type { ImageComposePort } from "../ports/image-compose";
import type { StorageAdapter } from "../ports/storage";
import type { IcyDb } from "../db/client";
import { getPairSet } from "../generation/pair-sets";
import { createAsset, markPairPostStatus, AssetError } from "./assets";

export const AI_DECLARATION = "AI Generated · 本内容由 AI 生成";

export type RunComposeDeps = {
  db: IcyDb;
  storage: StorageAdapter;
  compose: ImageComposePort;
};

/**
 * Compose an approved PairSet into finished assets (side-by-side + platform sizes).
 * Skips Comfy enhance; uses original anime/real paths.
 */
export async function runComposePairSet(
  pairSetId: string,
  deps: RunComposeDeps,
): Promise<string[]> {
  const { db, storage, compose } = deps;
  const pair = getPairSet(db, pairSetId);
  if (!pair) throw new AssetError("PairSet 不存在", "not_found");
  if (pair.reviewStatus !== "approved") {
    throw new AssetError("仅已通过的 PairSet 可后期处理", "conflict");
  }
  if (pair.postProcessStatus === "composed") {
    throw new AssetError("该 PairSet 已完成拼版", "conflict");
  }

  let anime: Buffer;
  let real: Buffer;
  try {
    anime = await storage.get(pair.animeImagePath);
    real = await storage.get(pair.realImagePath);
  } catch {
    throw new AssetError("无法读取成对原图", "not_found");
  }

  const result = await compose.composeSideBySide({
    anime,
    real,
    declaration: AI_DECLARATION,
  });

  const outputKeys: string[] = [];
  const base = `finished/${pairSetId}`;

  const compositeKey = `${base}/composite.png`;
  await storage.put(compositeKey, result.composite.data);
  createAsset(db, {
    pairSetId,
    kind: "composite",
    form: null,
    platform: "generic",
    filePath: compositeKey,
    watermarked: true,
    width: result.composite.width,
    height: result.composite.height,
  });
  outputKeys.push(compositeKey);

  for (const p of result.platforms) {
    const key = `${base}/${p.platform}-${p.label}.png`;
    await storage.put(key, p.data);
    createAsset(db, {
      pairSetId,
      kind: "platform-sized",
      form: null,
      platform: p.platform,
      filePath: key,
      watermarked: true,
      width: p.width,
      height: p.height,
    });
    outputKeys.push(key);
  }

  markPairPostStatus(db, pairSetId, "composed");
  return outputKeys;
}
