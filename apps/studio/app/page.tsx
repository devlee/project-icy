import { Clock } from "lucide-react"
import { getStudioOverview } from "@icy/core"
import type { Platform, PublishStatus } from "@icy/shared"

import { Badge } from "@/components/ui/badge"
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
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { getDb } from "@/lib/db"

export const dynamic = "force-dynamic"

const PLATFORM_LABEL: Record<Platform, string> = {
  generic: "通用",
  xiaohongshu: "小红书",
  x: "X",
  bilibili: "B站",
}

const PLAN_STATUS_LABEL: Record<PublishStatus, string> = {
  planned: "计划中",
  ready: "素材就绪",
  published: "已发布",
}

function inventoryStatus(days: number): {
  label: string
  variant: "default" | "secondary" | "destructive"
} {
  if (days >= 7) return { label: "健康", variant: "default" }
  if (days >= 4) return { label: "偏低", variant: "secondary" }
  return { label: "不足", variant: "destructive" }
}

function contentUrl(path: string) {
  return `/api/content/${path.split("/").map(encodeURIComponent).join("/")}`
}

function PlanThumb({ path }: { path: string | null }) {
  if (!path) {
    return <div className="size-full rounded-sm border bg-muted" aria-hidden="true" />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={contentUrl(path)} alt="发布素材预览" className="size-full object-cover" />
  )
}

export default function DashboardPage() {
  const overview = getStudioOverview(getDb())
  const stockStatus = inventoryStatus(overview.inventory.days)
  const maxCharacterStock = Math.max(
    1,
    ...overview.characterStock.map((character) => character.count),
  )
  const reviewMetrics = [
    { label: "今日已筛", value: overview.todayReviewedCount },
    { label: "待筛", value: overview.review.pending },
    { label: "通过", value: overview.review.approved },
    { label: "待定", value: overview.review.hold },
  ]

  return (
    <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[320px_1fr]">
      <Card className="lg:row-span-2">
        <CardHeader>
          <CardTitle>内容库存</CardTitle>
          <CardDescription>
            成品 {overview.inventory.readyPacks} 组 · 日均消耗 {overview.inventory.dailyBurn} 组 ·
            目标 ≥7 天
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-semibold tracking-tight tabular-nums">
              {overview.inventory.days}
            </span>
            <span className="text-muted-foreground">天</span>
            <Badge variant={stockStatus.variant} className="ml-auto">
              {stockStatus.label}
            </Badge>
          </div>
          <Progress
            value={Math.min(100, (overview.inventory.days / 7) * 100)}
            aria-label="库存相对七天目标"
          />
          <div className="mt-auto flex flex-col gap-4">
            <span className="text-sm font-medium text-muted-foreground">各角色存量</span>
            {overview.characterStock.length === 0 ? (
              <Empty className="border border-dashed py-8">
                <EmptyHeader>
                  <EmptyTitle className="text-sm">暂无可排期成品</EmptyTitle>
                  <EmptyDescription className="text-xs">
                    已完成后期且尚未排期的原创成品会显示在这里
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              overview.characterStock.map((character) => (
                <div key={character.characterId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>{character.characterName}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {character.count} 组
                    </span>
                  </div>
                  <Progress
                    value={(character.count / maxCharacterStock) * 100}
                    aria-label={`${character.characterName}库存`}
                  />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>今日待发布</CardTitle>
          <CardDescription>
            {overview.today} · {overview.todayPlans.length} 项
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.todayPlans.length === 0 ? (
            <Empty className="border border-dashed py-8">
              <EmptyHeader>
                <EmptyTitle className="text-sm">今日暂无发布计划</EmptyTitle>
                <EmptyDescription className="text-xs">在库存与排期页创建今日计划</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-1">
              {overview.todayPlans.map((plan) => (
                <Item key={plan.id} variant="muted" size="sm">
                  <ItemMedia variant="image">
                    <PlanThumb path={plan.previewPath} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{plan.caption || `${PLATFORM_LABEL[plan.platform]}发布计划`}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <span className="text-xs text-muted-foreground">
                      {PLATFORM_LABEL[plan.platform]}
                    </span>
                    <Badge variant={plan.status === "published" ? "outline" : "secondary"}>
                      {PLAN_STATUS_LABEL[plan.status]}
                    </Badge>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>生成队列</CardTitle>
            <CardDescription>当前活跃 {overview.activeTaskCount} 项</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.activeTasks.length === 0 ? (
              <Empty className="border border-dashed py-8">
                <EmptyHeader>
                  <EmptyTitle className="text-sm">队列空闲</EmptyTitle>
                  <EmptyDescription className="text-xs">暂无排队或生成中的任务</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-1">
                {overview.activeTasks.map((task) => (
                  <Item key={task.id} size="sm">
                    <ItemMedia variant="icon">
                      {task.status === "running" ? <Spinner /> : <Clock />}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        {task.characterName}
                        <span className="font-normal text-muted-foreground">{task.type}</span>
                      </ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Badge variant={task.status === "running" ? "default" : "secondary"}>
                        {task.status === "running" ? "生成中" : "排队"}
                      </Badge>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>筛选概览</CardTitle>
            <CardDescription>全部 PairSet {overview.review.total} 组</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {reviewMetrics.map((metric) => (
              <div key={metric.label} className="flex flex-col gap-1 rounded-lg border p-3">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {metric.value}
                </span>
                <span className="text-xs text-muted-foreground">{metric.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
