"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { ImageUp, Layers, Sparkles, Wand2 } from "lucide-react"
import type { CharacterOrigin } from "@icy/shared"
import type { TaskStatus } from "@icy/shared"

import {
  composePairSetAction,
  composeSelectedAction,
  enhancePairSetAction,
} from "./actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"

export type PostRow = {
  id: string
  characterName: string
  characterOrigin: CharacterOrigin
  seed: number
  rating: number | null
  animeImagePath: string
  realImagePath: string
  assetCount: number
  taskStatus: TaskStatus | null
  taskError: string | null
}

const TASK_LABEL: Partial<Record<TaskStatus, string>> = {
  queued: "已排队",
  running: "处理中",
  failed: "处理失败",
}

function contentUrl(path: string) {
  return `/api/content/${path.split("/").map(encodeURIComponent).join("/")}`
}

function PairThumb({ anime, real }: { anime: string; real: string }) {
  return (
    <div className="grid h-9 w-14 grid-cols-[1fr_1px_1fr] overflow-hidden rounded-sm border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={contentUrl(anime)} alt="" className="size-full object-cover" />
      <div className="bg-primary/40" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={contentUrl(real)} alt="" className="size-full object-cover" />
    </div>
  )
}

export function PostWorkshop({
  pending,
  ready,
}: {
  pending: PostRow[]
  ready: PostRow[]
}) {
  const [pendingRows, setPendingRows] = useState(pending)
  const [readyRows, setReadyRows] = useState(ready)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  useEffect(() => {
    setPendingRows(pending)
    setReadyRows(ready)
    setSelected(new Set())
  }, [pending, ready])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch("/api/post/queue")
        if (!res.ok) return
        const data = (await res.json()) as { pending: PostRow[]; ready: PostRow[] }
        if (!cancelled) {
          setPendingRows(data.pending)
          setReadyRows(data.ready)
        }
      } catch {
        /* ignore */
      }
    }
    const id = setInterval(() => void tick(), 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const allSelected = useMemo(
    () => {
      const selectable = pendingRows.filter(
        (row) => row.taskStatus !== "queued" && row.taskStatus !== "running",
      )
      return selectable.length > 0 && selectable.every((row) => selected.has(row.id))
    },
    [pendingRows, selected],
  )

  const toggleAll = (checked: boolean) => {
    setSelected(
      checked
        ? new Set(
            pendingRows
              .filter((row) => row.taskStatus !== "queued" && row.taskStatus !== "running")
              .map((row) => row.id),
          )
        : new Set(),
    )
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const runSelected = () => {
    setError(null)
    setMessage(null)
    const ids = [...selected]
    startTransition(async () => {
      const result = await composeSelectedAction(ids)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessage(`已入队 ${result.queued} 项拼版任务`)
      setSelected(new Set())
    })
  }

  const runOne = (id: string) => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await composePairSetAction(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessage("已入队拼版任务")
    })
  }

  const enhanceOne = (id: string) => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await enhancePairSetAction(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessage("已完成本地增强（锐化）")
    })
  }

  if (pendingRows.length === 0 && readyRows.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <Empty className="max-w-md border border-dashed py-12">
          <EmptyHeader>
            <EmptyTitle>还没有待后期的 PairSet</EmptyTitle>
            <EmptyDescription>
              在筛选台通过成对内容后，会出现在这里进行拼版导出。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/review" />} nativeButton={false}>去筛选台</Button>
          </EmptyContent>
        </Empty>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">后期车间</h1>
        <span className="text-sm text-muted-foreground">
          Sharp 拼版 + AI 声明水印 + 多平台尺寸（脸修/超分下一阶段）
        </span>
      </div>

      <Tabs defaultValue="pending" className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="pending">待处理 · {pendingRows.length}</TabsTrigger>
            <TabsTrigger value="ready">已就绪 · {readyRows.length}</TabsTrigger>
          </TabsList>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" disabled>
              <Wand2 data-icon="inline-start" />
              批量脸修 + 超分
              <Badge variant="secondary" className="ml-1 font-normal">
                下一阶段
              </Badge>
            </Button>
            <Button
              disabled={busy || selected.size === 0}
              onClick={runSelected}
            >
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Layers data-icon="inline-start" />
              )}
              批量拼版 + 水印
              {selected.size > 0 ? ` · ${selected.size}` : ""}
            </Button>
          </div>
        </div>

        {(error || message) && (
          <p className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
            {error ?? message}
          </p>
        )}

        <TabsContent value="pending">
          <Card>
            <CardContent>
              {pendingRows.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyTitle className="text-sm">待处理队列为空</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      已通过且尚未拼版的 PairSet 会列在这里
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(v) => toggleAll(v === true)}
                          aria-label="全选"
                        />
                      </TableHead>
                      <TableHead>预览</TableHead>
                      <TableHead>编号</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>评分</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(r.id)}
                            disabled={r.taskStatus === "queued" || r.taskStatus === "running"}
                            onCheckedChange={(v) => toggleOne(r.id, v === true)}
                            aria-label={`选择 ${r.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <PairThumb anime={r.animeImagePath} real={r.realImagePath} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.id.slice(0, 10)}…</TableCell>
                        <TableCell>
                          {r.characterName}
                          {r.characterOrigin === "ip_reference" ? (
                            <Badge variant="outline" className="ml-2 font-normal">
                              研究素材
                            </Badge>
                          ) : null}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            seed {r.seed}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          <div className="flex flex-col items-start gap-1">
                            <span>{r.rating ? "★".repeat(r.rating) : "—"}</span>
                            {r.taskStatus && TASK_LABEL[r.taskStatus] ? (
                              <Badge variant={r.taskStatus === "failed" ? "destructive" : "secondary"}>
                                {TASK_LABEL[r.taskStatus]}
                              </Badge>
                            ) : null}
                            {r.taskError ? (
                              <span className="max-w-48 text-xs text-destructive" title={r.taskError}>
                                {r.taskError}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy || r.taskStatus === "queued" || r.taskStatus === "running"}
                              onClick={() => enhanceOne(r.id)}
                            >
                              增强
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy || r.taskStatus === "queued" || r.taskStatus === "running"}
                              onClick={() => runOne(r.id)}
                            >
                              {r.taskStatus === "queued" || r.taskStatus === "running" ? (
                                <Spinner data-icon="inline-start" />
                              ) : (
                                <Sparkles data-icon="inline-start" />
                              )}
                              {r.taskStatus === "failed" ? "重试拼版" : "拼版导出"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ready">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">成品包</CardTitle>
              <CardDescription>
                已输出拼版与平台尺寸，可进入排期半自动发布
              </CardDescription>
            </CardHeader>
            <CardContent>
              {readyRows.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">暂无已就绪成品</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>预览</TableHead>
                      <TableHead>编号</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>资产数</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readyRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <PairThumb anime={r.animeImagePath} real={r.realImagePath} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.id.slice(0, 10)}…</TableCell>
                        <TableCell>
                          {r.characterName}
                          {r.characterOrigin === "ip_reference" ? (
                            <Badge variant="outline" className="ml-2 font-normal">
                              研究素材
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">{r.assetCount}</TableCell>
                        <TableCell className="text-right">
                          {r.characterOrigin === "original" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              render={<Link href={`/schedule?pairSetId=${r.id}`} />}
                              nativeButton={false}
                            >
                              <ImageUp data-icon="inline-start" />
                              加入排期
                            </Button>
                          ) : (
                            <Badge variant="outline">不可发布</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
