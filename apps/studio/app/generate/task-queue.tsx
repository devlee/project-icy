"use client"

import { useEffect, useState, useTransition } from "react"
import { Clock, RotateCcw, X } from "lucide-react"
import type { TaskStatus } from "@icy/shared"

import { cancelTaskAction, retryTaskAction } from "./actions"
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
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"

export type TaskQueueItem = {
  id: string
  type: string
  status: TaskStatus
  characterName: string
  error: string | null
  params: {
    seedStrategy: { kind: "fixed"; seed: number } | { kind: "random"; count: number }
    animeWorkflowId: string
    extraPrompt?: string
    outputKeys?: string[]
  }
  createdAt: string
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  queued: "排队",
  running: "生成中",
  done: "完成",
  failed: "失败",
  cancelled: "已取消",
}

const STATUS_VARIANT: Record<
  TaskStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "secondary",
  running: "default",
  done: "outline",
  failed: "destructive",
  cancelled: "outline",
}

function seedDetail(params: TaskQueueItem["params"]): string {
  if (params.seedStrategy.kind === "fixed") {
    return `seed ${params.seedStrategy.seed}`
  }
  return `随机 ×${params.seedStrategy.count}`
}

export function TaskQueue({ initialTasks }: { initialTasks: TaskQueueItem[] }) {
  const [tasks, setTasks] = useState(initialTasks)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch("/api/generation/tasks?limit=40")
        if (!res.ok) return
        const data = (await res.json()) as { tasks: TaskQueueItem[] }
        if (!cancelled) setTasks(data.tasks)
      } catch {
        /* ignore poll errors */
      }
    }
    const id = setInterval(() => void tick(), 2500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const refreshTasks = async () => {
    const res = await fetch("/api/generation/tasks?limit=40")
    if (res.ok) {
      const data = (await res.json()) as { tasks: TaskQueueItem[] }
      setTasks(data.tasks)
    }
  }

  const onCancel = (taskId: string) => {
    setPendingId(taskId)
    startTransition(async () => {
      await cancelTaskAction(taskId)
      setPendingId(null)
      await refreshTasks()
    })
  }

  const onRetry = (taskId: string) => {
    setPendingId(taskId)
    startTransition(async () => {
      await retryTaskAction(taskId)
      setPendingId(null)
      await refreshTasks()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>任务队列</CardTitle>
        <CardDescription>串行执行 · 交互任务优先 · 每 2.5s 刷新</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <Empty className="border border-dashed py-8">
            <EmptyHeader>
              <EmptyTitle className="text-sm">暂无任务</EmptyTitle>
              <EmptyDescription className="text-xs">
                提交左侧单张任务后会出现在这里
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-1">
            {tasks.map((t) => (
              <Item key={t.id} variant="muted" size="sm">
                <ItemMedia variant="icon">
                  {t.status === "running" ? <Spinner /> : <Clock />}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {t.characterName}
                    <span className="font-mono text-xs font-normal text-muted-foreground">
                      single · {seedDetail(t.params)}
                      {t.params.extraPrompt
                        ? ` · ${t.params.extraPrompt.slice(0, 24)}${t.params.extraPrompt.length > 24 ? "…" : ""}`
                        : ""}
                    </span>
                  </ItemTitle>
                  {t.error ? (
                    <p className="text-xs text-destructive line-clamp-2">{t.error}</p>
                  ) : null}
                  {t.status === "done" && t.params.outputKeys?.length ? (
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {t.params.outputKeys.length} 张 · {t.params.outputKeys[0]}
                    </p>
                  ) : null}
                </ItemContent>
                <ItemActions>
                  <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                  {t.status === "queued" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pendingId === t.id}
                      onClick={() => onCancel(t.id)}
                    >
                      <X data-icon="inline-start" />
                      取消
                    </Button>
                  ) : null}
                  {t.status === "failed" || t.status === "cancelled" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pendingId === t.id}
                      onClick={() => onRetry(t.id)}
                    >
                      <RotateCcw data-icon="inline-start" />
                      重试
                    </Button>
                  ) : null}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  )
}
