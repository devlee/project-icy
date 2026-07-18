import { ArrowDownRight, ArrowUpRight, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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

const characterStock = [
  { name: "凛冬 Rin", count: 8, anime: 42, real: 38 },
  { name: "小满 Mitsu", count: 5, anime: 30, real: 12 },
  { name: "芽衣 Mei", count: 4, anime: 15, real: 13 },
]

const todayPublish = [
  { title: "凛冬 · 夏日祭 #12 对照组", platform: "小红书", status: "已发布", done: true },
  { title: "凛冬 · 夏日祭 #13 对照组", platform: "X", status: "素材就绪", done: false },
  { title: "小满 · 雨季系列 #4 变身视频", platform: "B站", status: "待拼版", done: false },
]

const queue = [
  { title: "凛冬 · 夏日祭 #15", detail: "pair ×8", status: "生成中 3/8", running: true, eta: "06:12" },
  { title: "芽衣 · 街拍系列 #2", detail: "pair ×6", status: "排队", running: false },
  { title: "小满 · 定时批次", detail: "cron 04:00", status: "明晨", running: false },
]

const metrics = [
  { label: "新增粉丝", value: "+412", up: true },
  { label: "爆款率（≥1w 曝光）", value: "2 / 9", up: true },
  { label: "询单转化率", value: "18%", up: false },
  { label: "周收入", value: "¥1,240", up: true },
]

function PairThumb() {
  return (
    <div className="grid size-full grid-cols-[1fr_1px_1fr] overflow-hidden rounded-sm border">
      <div className="bg-muted" />
      <div className="bg-primary/40" />
      <div className="bg-accent" />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[320px_1fr]">
      <Card className="lg:row-span-2">
        <CardHeader>
          <CardTitle>内容库存</CardTitle>
          <CardDescription>成品 17 组 · 日均消耗 2 组 · 目标 ≥7 天</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-semibold tracking-tight tabular-nums">8.5</span>
            <span className="text-muted-foreground">天</span>
            <Badge variant="secondary" className="ml-auto">健康</Badge>
          </div>
          <Progress value={85} aria-label="库存相对目标" />
          <div className="mt-auto flex flex-col gap-4">
            <span className="text-sm font-medium text-muted-foreground">各角色存量</span>
            {characterStock.map((c) => (
              <div key={c.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">{c.count} 组</span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="bg-primary" style={{ width: `${c.anime}%` }} />
                  <div className="bg-primary/30" style={{ width: `${c.real}%` }} />
                </div>
              </div>
            ))}
            <span className="text-xs text-muted-foreground">深色 = 二次元 · 浅色 = 真人</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>今日待发布</CardTitle>
          <CardDescription>2026-07-18 · 3 项</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-1">
            {todayPublish.map((p) => (
              <Item key={p.title} variant="muted" size="sm">
                <ItemMedia>
                  <Checkbox defaultChecked={p.done} aria-label={`标记 ${p.title}`} />
                </ItemMedia>
                <ItemMedia variant="image">
                  <PairThumb />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{p.title}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <span className="text-xs text-muted-foreground">{p.platform}</span>
                  <Badge variant={p.done ? "outline" : "secondary"}>{p.status}</Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>生成队列</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-1">
              {queue.map((q) => (
                <Item key={q.title} size="sm">
                  <ItemMedia variant="icon">
                    {q.running ? <Spinner /> : <Clock />}
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {q.title}
                      <span className="font-normal text-muted-foreground">{q.detail}</span>
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    {q.eta ? (
                      <span className="text-xs text-muted-foreground tabular-nums">{q.eta}</span>
                    ) : null}
                    <Badge variant={q.running ? "default" : "secondary"}>{q.status}</Badge>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>本周四数</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="flex flex-col gap-1 rounded-lg border p-3">
                <span className="flex items-center gap-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {m.value}
                  {m.up ? (
                    <ArrowUpRight className="size-4 text-muted-foreground" aria-label="上升" />
                  ) : (
                    <ArrowDownRight className="size-4 text-destructive" aria-label="下降" />
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
