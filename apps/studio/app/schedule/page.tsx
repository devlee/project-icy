import {
  getInventoryStats,
  listInventoryPacks,
  listPublishPlans,
  todayLocalDate,
  type PublishPlanListItem,
} from "@icy/core"

export const dynamic = "force-dynamic"

import { getDb } from "@/lib/db"
import { getStorage } from "@/lib/services"
import {
  ScheduleBoard,
  type InventoryPackView,
  type PlanView,
} from "./schedule-board"

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y!, m! - 1, d!)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function toPlanView(
  plan: PublishPlanListItem,
  localPath: (key: string) => string,
): PlanView {
  return {
    id: plan.id,
    date: plan.date,
    platform: plan.platform,
    status: plan.status,
    caption: plan.caption,
    hashtags: plan.hashtags,
    notes: plan.notes,
    publishedAt: plan.publishedAt ? plan.publishedAt.toISOString() : null,
    previewPath: plan.assets[0]?.filePath ?? null,
    assets: plan.assets.map((a) => ({
      id: a.id,
      filePath: a.filePath,
      localPath: localPath(a.filePath),
      platform: a.platform,
      kind: a.kind,
    })),
  }
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ pairSetId?: string }>
}) {
  const sp = await searchParams
  const db = getDb()
  const storage = getStorage()
  const today = todayLocalDate()
  const end = addDays(today, 6)
  const yesterday = addDays(today, -1)

  const stats = getInventoryStats(db, { dailyBurn: 1 })
  const packs: InventoryPackView[] = listInventoryPacks(db).map((p) => ({
    id: p.id,
    characterName: p.characterName,
    seed: p.seed,
    rating: p.rating,
    animeImagePath: p.animeImagePath,
    realImagePath: p.realImagePath,
    assetCount: p.assetCount,
  }))

  const allUpcoming = listPublishPlans(db, {
    fromDate: today,
    toDate: end,
    limit: 100,
  })
  const overdue = [
    ...listPublishPlans(db, {
      status: "planned",
      toDate: yesterday,
      limit: 100,
    }),
    ...listPublishPlans(db, {
      status: "ready",
      toDate: yesterday,
      limit: 100,
    }),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const todayPlans = allUpcoming
    .filter(
      (p) =>
        p.date === today && (p.status === "planned" || p.status === "ready"),
    )
    .map((p) => toPlanView(p, (k) => storage.localPath(k)))

  const upcomingPlans = [...overdue, ...allUpcoming.filter((p) => p.status !== "published")]
    .map((p) => toPlanView(p, (k) => storage.localPath(k)))

  const recentPublished = listPublishPlans(db, {
    status: "published",
    limit: 10,
  }).map((p) => toPlanView(p, (k) => storage.localPath(k)))

  const prefill =
    typeof sp.pairSetId === "string" &&
    packs.some((p) => p.id === sp.pairSetId)
      ? sp.pairSetId
      : null

  return (
    <ScheduleBoard
      today={today}
      stats={stats}
      packs={packs}
      todayPlans={todayPlans}
      upcomingPlans={upcomingPlans}
      recentPublished={recentPublished}
      prefillPairSetId={prefill}
    />
  )
}
