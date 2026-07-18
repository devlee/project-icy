import { getLatestPostTaskForPairSet, listApprovedForPost } from "@icy/core"
import type { CharacterOrigin, TaskStatus } from "@icy/shared"

export const dynamic = "force-dynamic"

import { getDb } from "@/lib/db"
import { PostWorkshop, type PostRow } from "./post-workshop"

function toRow(db: ReturnType<typeof getDb>, p: {
  id: string
  characterName: string
  characterOrigin: CharacterOrigin
  seed: number
  rating: number | null
  animeImagePath: string
  realImagePath: string
  assetCount: number
}): PostRow {
  const task = getLatestPostTaskForPairSet(db, p.id)
  return {
    id: p.id,
    characterName: p.characterName,
    characterOrigin: p.characterOrigin,
    seed: p.seed,
    rating: p.rating,
    animeImagePath: p.animeImagePath,
    realImagePath: p.realImagePath,
    assetCount: p.assetCount,
    taskStatus: (task?.status ?? null) as TaskStatus | null,
    taskError: task?.error ?? null,
  }
}

export default function PostPage() {
  const db = getDb()
  const pending = listApprovedForPost(db, { postProcessStatus: "raw" }).map((row) => toRow(db, row))
  const ready = listApprovedForPost(db, { postProcessStatus: "composed" }).map((row) => toRow(db, row))
  return <PostWorkshop pending={pending} ready={ready} />
}
