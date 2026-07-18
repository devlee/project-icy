"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { BookmarkPlus, Check, CircleUser, Pause, Sparkles, X } from "lucide-react"
import type { ReviewStatus } from "@icy/shared"

import { reviewPairSetAction } from "./actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Spinner } from "@/components/ui/spinner"

export type ReviewPairItem = {
  id: string
  characterName: string
  seed: number
  animeImagePath: string
  realImagePath: string
  reviewStatus: ReviewStatus
  rating: number | null
}

export type ReviewStatsView = {
  byStatus: Record<ReviewStatus, number>
  total: number
  reviewed: number
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>
  ratedTotal: number
}

type QueueKind = "pending" | "hold"

function contentUrl(path: string) {
  return `/api/content/${path.split("/").map(encodeURIComponent).join("/")}`
}

function stars(rating: number | null) {
  if (!rating) return "未评分"
  return "★".repeat(rating) + "☆".repeat(5 - rating)
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
}

const shortcuts = [
  { keys: ["J", "K"], label: "下/上一组" },
  { keys: ["1–5"], label: "打分" },
  { keys: ["Enter"], label: "通过" },
  { keys: ["X"], label: "淘汰" },
  { keys: ["H"], label: "待定" },
  { keys: ["B", "F"], label: "基准/FaceID（下一阶段）" },
]

function bumpRatingCounts(
  counts: ReviewStatsView["ratingCounts"],
  ratedTotal: number,
  prev: number | null,
  next: number | null,
): { ratingCounts: ReviewStatsView["ratingCounts"]; ratedTotal: number } {
  const ratingCounts = { ...counts }
  let total = ratedTotal
  if (prev !== null && prev >= 1 && prev <= 5) {
    const k = prev as 1 | 2 | 3 | 4 | 5
    ratingCounts[k] = Math.max(0, ratingCounts[k] - 1)
    total = Math.max(0, total - 1)
  }
  if (next !== null && next >= 1 && next <= 5) {
    const k = next as 1 | 2 | 3 | 4 | 5
    ratingCounts[k] += 1
    total += 1
  }
  return { ratingCounts, ratedTotal: total }
}

export function ReviewWorkbench({
  pending,
  hold,
  stats: initialStats,
}: {
  pending: ReviewPairItem[]
  hold: ReviewPairItem[]
  stats: ReviewStatsView
}) {
  const [queue, setQueue] = useState<QueueKind>("pending")
  const [pendingItems, setPendingItems] = useState(pending)
  const [holdItems, setHoldItems] = useState(hold)
  const [stats, setStats] = useState(initialStats)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  useEffect(() => {
    setPendingItems(pending)
    setHoldItems(hold)
    setStats(initialStats)
    setIndex(0)
  }, [pending, hold, initialStats])

  const items = queue === "pending" ? pendingItems : holdItems
  const current = items[index] ?? null

  const reviewedPct =
    stats.total === 0 ? 0 : Math.round((stats.reviewed / stats.total) * 100)
  const approveRate =
    stats.reviewed === 0
      ? 0
      : Math.round((stats.byStatus.approved / stats.reviewed) * 100)

  const upcoming = useMemo(
    () => items.slice(index + 1, index + 4),
    [items, index],
  )

  const applyLocalRating = useCallback((item: ReviewPairItem, rating: number) => {
    const patch = (list: ReviewPairItem[]) =>
      list.map((p) => (p.id === item.id ? { ...p, rating } : p))
    setPendingItems(patch)
    setHoldItems(patch)
    setStats((s) => {
      const next = bumpRatingCounts(s.ratingCounts, s.ratedTotal, item.rating, rating)
      return { ...s, ...next }
    })
  }, [])

  const applyLocalStatus = useCallback(
    (item: ReviewPairItem, status: ReviewStatus, rating: number | null) => {
      const updated = { ...item, reviewStatus: status, rating }

      setPendingItems((prev) => {
        const without = prev.filter((p) => p.id !== item.id)
        return status === "pending" ? [updated, ...without] : without
      })
      setHoldItems((prev) => {
        const without = prev.filter((p) => p.id !== item.id)
        return status === "hold" ? [updated, ...without] : without
      })

      setStats((s) => {
        const byStatus = { ...s.byStatus }
        byStatus[item.reviewStatus] = Math.max(0, byStatus[item.reviewStatus] - 1)
        byStatus[status] = (byStatus[status] ?? 0) + 1
        const reviewed = byStatus.approved + byStatus.rejected + byStatus.hold
        const ratingBump = bumpRatingCounts(
          s.ratingCounts,
          s.ratedTotal,
          item.rating,
          rating,
        )
        return {
          ...s,
          byStatus,
          reviewed,
          ...ratingBump,
        }
      })

      setIndex((i) => {
        // After removal from current queue, keep index pointing at the next card.
        const activeLen =
          (queue === "pending" ? pendingItems : holdItems).filter((p) => p.id !== item.id)
            .length
        if (activeLen === 0) return 0
        return Math.min(i, activeLen - 1)
      })
    },
    [holdItems, pendingItems, queue],
  )

  const runReview = useCallback(
    (patch: { status?: ReviewStatus; rating?: number | null }) => {
      if (!current) return
      setError(null)
      const item = current
      startTransition(async () => {
        const result = await reviewPairSetAction({ id: item.id, ...patch })
        if (!result.ok) {
          setError(result.error)
          return
        }
        if (patch.status) {
          applyLocalStatus(item, patch.status, result.pair.rating)
          return
        }
        if (patch.rating !== undefined && patch.rating !== null) {
          applyLocalRating(item, patch.rating)
        }
      })
    },
    [applyLocalRating, applyLocalStatus, current],
  )

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)))
  }, [items.length])

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (busy) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (key === "j") {
        e.preventDefault()
        goNext()
        return
      }
      if (key === "k") {
        e.preventDefault()
        goPrev()
        return
      }
      if (key >= "1" && key <= "5") {
        e.preventDefault()
        runReview({ rating: Number(key) })
        return
      }
      if (key === "Enter") {
        e.preventDefault()
        runReview({ status: "approved" })
        return
      }
      if (key === "x") {
        e.preventDefault()
        runReview({ status: "rejected" })
        return
      }
      if (key === "h") {
        e.preventDefault()
        runReview({ status: "hold" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, goNext, goPrev, runReview])

  if (stats.total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <Empty className="max-w-md border border-dashed py-12">
          <EmptyHeader>
            <EmptyTitle>还没有 PairSet</EmptyTitle>
            <EmptyDescription>
              先在生成中心提交成对任务，出图后会出现在这里筛选。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/generate" />}>
              <Sparkles data-icon="inline-start" />
              去生成中心
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">筛选工作台</h1>
            <ToggleGroup
              value={[queue]}
              onValueChange={(v) => {
                const next = v[0]
                if (next === "pending" || next === "hold") {
                  setQueue(next)
                  setIndex(0)
                }
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="pending">
                待筛 {stats.byStatus.pending}
              </ToggleGroupItem>
              <ToggleGroupItem value="hold">
                待定 {stats.byStatus.hold}
              </ToggleGroupItem>
            </ToggleGroup>
            <span className="text-sm text-muted-foreground tabular-nums">
              {items.length === 0 ? "0 / 0" : `${index + 1} / ${items.length}`}
            </span>
            {current ? (
              <span className="ml-auto text-sm text-muted-foreground">
                角色{" "}
                <span className="text-foreground">{current.characterName}</span>
              </span>
            ) : null}
          </div>

          {!current ? (
            <Empty className="min-h-[420px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle className="text-sm">
                  {queue === "pending" ? "待筛队列已空" : "没有待定项"}
                </EmptyTitle>
                <EmptyDescription className="text-xs">
                  {queue === "pending"
                    ? "可切换到「待定」继续，或去生成更多成对内容"
                    : "切换回「待筛」继续处理"}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Card className="flex-1 gap-0 overflow-hidden py-0">
              <div className="grid min-h-[420px] flex-1 grid-cols-[1fr_2px_1fr]">
                <div className="relative flex items-center justify-center bg-muted">
                  <Badge variant="secondary" className="absolute top-3 left-3 z-10 font-mono">
                    ANIME
                  </Badge>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={contentUrl(current.animeImagePath)}
                    alt="anime"
                    className="max-h-[560px] w-full object-contain"
                  />
                </div>
                <div className="bg-primary" aria-hidden="true" />
                <div className="relative flex items-center justify-center bg-accent">
                  <Badge variant="secondary" className="absolute top-3 right-3 z-10 font-mono">
                    REAL
                  </Badge>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={contentUrl(current.realImagePath)}
                    alt="real"
                    className="max-h-[560px] w-full object-contain"
                  />
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-4 px-4 py-2.5 font-mono text-xs text-muted-foreground">
                <span>
                  seed <span className="text-foreground">{current.seed}</span>
                </span>
                <Badge variant="outline">{current.reviewStatus}</Badge>
                <span className="ml-auto">评分 {stars(current.rating)}</span>
              </div>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={!current || busy}
              onClick={() => runReview({ status: "approved" })}
            >
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              通过
              <Kbd>⏎</Kbd>
            </Button>
            <Button
              variant="outline"
              disabled={!current || busy}
              onClick={() => runReview({ status: "rejected" })}
            >
              <X data-icon="inline-start" />
              淘汰
              <Kbd>X</Kbd>
            </Button>
            <Button
              variant="outline"
              disabled={!current || busy}
              onClick={() => runReview({ status: "hold" })}
            >
              <Pause data-icon="inline-start" />
              待定
              <Kbd>H</Kbd>
            </Button>
            <Separator orientation="vertical" className="h-9" />
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <Button
                key={n}
                variant={current?.rating === n ? "default" : "ghost"}
                size="sm"
                disabled={!current || busy}
                onClick={() => runReview({ rating: n })}
              >
                {n}
              </Button>
            ))}
            <Separator orientation="vertical" className="h-9" />
            <Button variant="ghost" disabled>
              <BookmarkPlus data-icon="inline-start" />
              提升为基准
              <Kbd>B</Kbd>
            </Button>
            <Button variant="ghost" disabled>
              <CircleUser data-icon="inline-start" />
              FaceID 参考
              <Kbd>F</Kbd>
            </Button>
            {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>筛选进度</CardTitle>
              <CardDescription>全部 PairSet</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">已筛</span>
                <span className="tabular-nums">
                  {stats.reviewed} / {stats.total}
                </span>
              </div>
              <Progress value={reviewedPct} aria-label="筛选进度" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">通过率</span>
                <span className="tabular-nums">{approveRate}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>通过 {stats.byStatus.approved}</span>
                <span>淘汰 {stats.byStatus.rejected}</span>
                <span>待定 {stats.byStatus.hold}</span>
                <span>待筛 {stats.byStatus.pending}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>评分分布</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {([5, 4, 3, 2, 1] as const).map((score) => {
                const count = stats.ratingCounts[score]
                const pct =
                  stats.ratedTotal === 0
                    ? 0
                    : Math.round((count / stats.ratedTotal) * 100)
                return (
                  <div
                    key={score}
                    className="grid grid-cols-[16px_1fr_24px] items-center gap-2 text-xs"
                  >
                    <span className="text-muted-foreground tabular-nums">{score}</span>
                    <Progress value={pct} aria-label={`${score} 分占比`} />
                    <span className="text-right text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>接下来</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {upcoming.length === 0 ? (
                <p className="col-span-3 text-xs text-muted-foreground">没有更多</p>
              ) : (
                upcoming.map((p) => (
                  <div
                    key={p.id}
                    className="grid aspect-3/4 grid-cols-[1fr_1px_1fr] overflow-hidden rounded-md border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={contentUrl(p.animeImagePath)}
                      alt=""
                      className="size-full object-cover"
                    />
                    <div className="bg-primary/40" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={contentUrl(p.realImagePath)}
                      alt=""
                      className="size-full object-cover"
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-2">
        {shortcuts.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <KbdGroup>
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </KbdGroup>
            {s.label}
          </span>
        ))}
      </footer>
    </div>
  )
}
