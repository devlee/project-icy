"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { BookmarkPlus, Check, CircleUser, Pause, Sparkles, X } from "lucide-react"
import type { Form, ReviewStatus } from "@icy/shared"

import { promotePairSetImageAction, reviewPairSetAction } from "./actions"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
type SoloSide = Form | null
type PromoteKind = "anchor" | "faceid_ref"

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
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "BUTTON" ||
    el.isContentEditable
  )
}

const shortcuts = [
  { keys: ["Space"], label: "灯箱" },
  { keys: ["J", "K", "←", "→"], label: "下/上一组" },
  { keys: ["A", "R"], label: "灯箱单侧放大" },
  { keys: ["1–5"], label: "打分" },
  { keys: ["Enter"], label: "通过" },
  { keys: ["X"], label: "淘汰" },
  { keys: ["H"], label: "待定" },
  { keys: ["B"], label: "提升为基准" },
  { keys: ["F"], label: "FaceID 参考" },
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

function promoteFeedback(
  kind: PromoteKind,
  side: Form,
  created: boolean,
): string {
  const sideLabel = side === "anime" ? "二次元" : "真人"
  if (kind === "anchor") {
    return created
      ? `已将${sideLabel}侧提升为基准`
      : `${sideLabel}侧已是基准（未重复写入）`
  }
  return created
    ? `已将${sideLabel}侧设为 FaceID 参考`
    : `${sideLabel}侧已是 FaceID 参考（未重复写入）`
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
  const [feedback, setFeedback] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const [solo, setSolo] = useState<SoloSide>(null)
  const [promoteKind, setPromoteKind] = useState<PromoteKind | null>(null)
  const [promoteSide, setPromoteSide] = useState<Form>("real")
  const [busy, startTransition] = useTransition()

  useEffect(() => {
    setPendingItems(pending)
    setHoldItems(hold)
    setStats(initialStats)
    setIndex(0)
  }, [pending, hold, initialStats])

  useEffect(() => {
    if (!feedback) return
    const t = window.setTimeout(() => setFeedback(null), 2800)
    return () => window.clearTimeout(t)
  }, [feedback])

  const items = queue === "pending" ? pendingItems : holdItems
  const current = items[index] ?? null

  useEffect(() => {
    if (!current && lightbox) {
      setLightbox(false)
      setSolo(null)
    }
  }, [current, lightbox])

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
    setSolo(null)
    setIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)))
  }, [items.length])

  const goPrev = useCallback(() => {
    setSolo(null)
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const openPromote = useCallback(
    (kind: PromoteKind) => {
      if (!current) return
      setError(null)
      setPromoteKind(kind)
      setPromoteSide(kind === "faceid_ref" ? "real" : "anime")
    },
    [current],
  )

  const confirmPromote = useCallback(() => {
    if (!current || !promoteKind) return
    const item = current
    const kind = promoteKind
    const side = promoteSide
    setError(null)
    startTransition(async () => {
      const result = await promotePairSetImageAction({
        pairSetId: item.id,
        side,
        kind,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setPromoteKind(null)
      setFeedback(promoteFeedback(kind, side, result.created))
    })
  }, [current, promoteKind, promoteSide])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (busy) return

      // Promote chooser: allow A/R/Enter/Esc even when a button has focus.
      if (promoteKind) {
        if (e.key === "Escape") {
          e.preventDefault()
          setPromoteKind(null)
          return
        }
        if (e.key === "a" || e.key === "A") {
          e.preventDefault()
          setPromoteSide("anime")
          return
        }
        if (e.key === "r" || e.key === "R") {
          e.preventDefault()
          setPromoteSide("real")
          return
        }
        if (e.key === "Enter") {
          e.preventDefault()
          confirmPromote()
        }
        return
      }

      if (e.key === "Escape" && lightbox) {
        e.preventDefault()
        setLightbox(false)
        setSolo(null)
        return
      }

      if (isTypingTarget(e.target)) return

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (key === " " || key === "Spacebar") {
        e.preventDefault()
        if (!current) return
        setLightbox((open) => {
          if (open) setSolo(null)
          return !open
        })
        return
      }
      if (key === "j" || key === "ArrowRight") {
        e.preventDefault()
        goNext()
        return
      }
      if (key === "k" || key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
        return
      }
      if (lightbox && (key === "a" || key === "r")) {
        e.preventDefault()
        const side: Form = key === "a" ? "anime" : "real"
        setSolo((prev) => (prev === side ? null : side))
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
        return
      }
      if (key === "b") {
        e.preventDefault()
        openPromote("anchor")
        return
      }
      if (key === "f") {
        e.preventDefault()
        openPromote("faceid_ref")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    busy,
    confirmPromote,
    current,
    goNext,
    goPrev,
    lightbox,
    openPromote,
    promoteKind,
    runReview,
  ])

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
            <Button render={<Link href="/generate" />} nativeButton={false}>
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
                  setSolo(null)
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
            <Card
              className="flex-1 cursor-zoom-in gap-0 overflow-hidden py-0"
              onClick={() => setLightbox(true)}
            >
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
            <Button
              variant="ghost"
              disabled={!current || busy}
              onClick={() => openPromote("anchor")}
            >
              <BookmarkPlus data-icon="inline-start" />
              提升为基准
              <Kbd>B</Kbd>
            </Button>
            <Button
              variant="ghost"
              disabled={!current || busy}
              onClick={() => openPromote("faceid_ref")}
            >
              <CircleUser data-icon="inline-start" />
              FaceID 参考
              <Kbd>F</Kbd>
            </Button>
            {feedback ? (
              <Badge variant="secondary" className="ml-auto">
                {feedback}
              </Badge>
            ) : null}
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

      {lightbox && current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="成对预览灯箱"
          className="fixed inset-0 z-50 flex flex-col bg-black"
          onClick={() => {
            setLightbox(false)
            setSolo(null)
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-white/70">
            <span className="text-white">{current.characterName}</span>
            <span className="font-mono tabular-nums">
              {index + 1} / {items.length}
            </span>
            <span className="font-mono">seed {current.seed}</span>
            <span className="ml-auto text-xs">
              Esc 退出 · A/R 单侧 · Space 关闭
            </span>
            {feedback ? (
              <Badge variant="secondary">{feedback}</Badge>
            ) : null}
          </div>
          <div
            className={
              solo
                ? "flex min-h-0 flex-1 items-center justify-center"
                : "grid min-h-0 flex-1 grid-cols-[1fr_2px_1fr]"
            }
            onClick={(e) => e.stopPropagation()}
          >
            {(solo === null || solo === "anime") && (
              <div className="relative flex h-full items-center justify-center">
                <Badge
                  variant="secondary"
                  className="absolute top-3 left-3 z-10 font-mono"
                >
                  ANIME
                </Badge>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={contentUrl(current.animeImagePath)}
                  alt="anime"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
            {solo === null ? (
              <div className="bg-white/20" aria-hidden="true" />
            ) : null}
            {(solo === null || solo === "real") && (
              <div className="relative flex h-full items-center justify-center">
                <Badge
                  variant="secondary"
                  className="absolute top-3 right-3 z-10 font-mono"
                >
                  REAL
                </Badge>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={contentUrl(current.realImagePath)}
                  alt="real"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      <Dialog
        open={promoteKind !== null}
        onOpenChange={(open) => {
          if (!open) setPromoteKind(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {promoteKind === "faceid_ref" ? "设为 FaceID 参考" : "提升为基准"}
            </DialogTitle>
            <DialogDescription>
              {promoteKind === "faceid_ref"
                ? "选择要复制到角色 FaceID 参考的一侧（默认真人）。不会推进筛选队列。"
                : "选择要复制到角色基准图的一侧。不会推进筛选队列。"}
            </DialogDescription>
          </DialogHeader>
          <ToggleGroup
            value={[promoteSide]}
            onValueChange={(v) => {
              const next = v[0]
              if (next === "anime" || next === "real") setPromoteSide(next)
            }}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="anime" className="flex-1">
              二次元 <Kbd>A</Kbd>
            </ToggleGroupItem>
            <ToggleGroupItem value="real" className="flex-1">
              真人 <Kbd>R</Kbd>
            </ToggleGroupItem>
          </ToggleGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteKind(null)}>
              取消
            </Button>
            <Button disabled={busy || !current} onClick={confirmPromote}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              确认提升
              <Kbd>⏎</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
