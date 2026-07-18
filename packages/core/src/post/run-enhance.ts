import type { ImageComposePort } from "../ports/image-compose";
import type { StorageAdapter } from "../ports/storage";
import type { IcyDb } from "../db/client";
import { getPairSet } from "../generation/pair-sets";
import { createAsset, markPairPostStatus, AssetError } from "./assets";

export type RunEnhanceDeps = {
  db: IcyDb;
  storage: StorageAdapter;
  compose: ImageComposePort;
};

/**
 * Local Sharp enhance (sharpen) → `enhanced` assets + postProcessStatus=enhanced.
 * Does not block compose; Comfy face-fix remains deferred.
 */
export async function runEnhancePairSet(
  pairSetId: string,
  deps: RunEnhanceDeps,
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

  const animeOut = await compose.enhanceImage({ image: anime });
  const realOut = await compose.enhanceImage({ image: real });
  const base = `finished/${pairSetId}`;
  const outputKeys: string[] = [];

  const animeKey = `${base}/enhanced-anime.png`;
  await storage.put(animeKey, animeOut.data);
  createAsset(db, {
    pairSetId,
    kind: "enhanced",
    form: "anime",
    platform: "generic",
    filePath: animeKey,
    watermarked: false,
    width: animeOut.width,
    height: animeOut.height,
  });
  outputKeys.push(animeKey);

  const realKey = `${base}/enhanced-real.png`;
  await storage.put(realKey, realOut.data);
  createAsset(db, {
    pairSetId,
    kind: "enhanced",
    form: "real",
    platform: "generic",
    filePath: realKey,
    watermarked: false,
    width: realOut.width,
    height: realOut.height,
  });
  outputKeys.push(realKey);

  markPairPostStatus(db, pairSetId, "enhanced");
  return outputKeys;
}
