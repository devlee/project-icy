import { getReviewStats, listPairSets } from "@icy/core"

export const dynamic = "force-dynamic"

import { getDb } from "@/lib/db"
import { ReviewWorkbench, type ReviewPairItem } from "./review-workbench"

function toItem(p: {
  id: string
  characterName: string
  seed: number
  animeImagePath: string
  realImagePath: string
  reviewStatus: ReviewPairItem["reviewStatus"]
  rating: number | null
}): ReviewPairItem {
  return {
    id: p.id,
    characterName: p.characterName,
    seed: p.seed,
    animeImagePath: p.animeImagePath,
    realImagePath: p.realImagePath,
    reviewStatus: p.reviewStatus,
    rating: p.rating,
  }
}

export default function ReviewPage() {
  const db = getDb()
  const pending = listPairSets(db, { reviewStatus: "pending", limit: 200 }).map(toItem)
  const hold = listPairSets(db, { reviewStatus: "hold", limit: 200 }).map(toItem)
  const stats = getReviewStats(db)

  return (
    <ReviewWorkbench pending={pending} hold={hold} stats={stats} />
  )
}
