import { BookmarkPlus, Check, CircleUser, Pause, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

const ratingDist = [
  { score: 5, count: 3, pct: 12 },
  { score: 4, count: 6, pct: 26 },
  { score: 3, count: 15, pct: 64 },
  { score: 2, count: 9, pct: 38 },
  { score: 1, count: 2, pct: 10 },
]

const shortcuts = [
  { keys: ["J", "K"], label: "上/下一组" },
  { keys: ["1–5"], label: "打分" },
  { keys: ["Space"], label: "大图对比" },
  { keys: ["Enter"], label: "通过" },
  { keys: ["X"], label: "淘汰" },
  { keys: ["H"], label: "待定" },
  { keys: ["B", "F"], label: "提升基准 / FaceID" },
]

export default function ReviewPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold tracking-tight">筛选 · 夏日祭批次 #14</h1>
            <span className="text-sm text-muted-foreground tabular-nums">23 / 62</span>
            <span className="ml-auto text-sm text-muted-foreground">
              角色 <span className="text-foreground">凛冬 Rin</span> · 系列{" "}
              <span className="text-foreground">夏日祭</span>
            </span>
          </div>

          <Card className="flex-1 gap-0 overflow-hidden py-0">
            <div className="grid min-h-[420px] flex-1 grid-cols-[1fr_2px_1fr]">
              <div className="relative flex items-center justify-center bg-muted">
                <Badge variant="secondary" className="absolute top-3 left-3 font-mono">
                  ANIME
                </Badge>
                <span className="text-sm text-muted-foreground">二次元形态 · 3:4</span>
              </div>
              <div className="bg-primary" aria-hidden="true" />
              <div className="relative flex items-center justify-center bg-accent">
                <Badge variant="secondary" className="absolute top-3 right-3 font-mono">
                  REAL
                </Badge>
                <span className="text-sm text-muted-foreground">真人形态 · 3:4</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-4 px-4 py-2.5 font-mono text-xs text-muted-foreground">
              <span>
                seed <span className="text-foreground">84721063</span>
              </span>
              <span>
                pose <span className="text-foreground">P-017 坐姿回眸</span>
              </span>
              <div className="flex gap-1.5">
                <Badge variant="outline">浴衣</Badge>
                <Badge variant="outline">祭典夜景</Badge>
                <Badge variant="outline">灯笼暖光</Badge>
              </div>
              <span className="ml-auto">评分 ★★★★☆</span>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button>
              <Check data-icon="inline-start" />
              通过
              <Kbd>⏎</Kbd>
            </Button>
            <Button variant="outline">
              <X data-icon="inline-start" />
              淘汰
              <Kbd>X</Kbd>
            </Button>
            <Button variant="outline">
              <Pause data-icon="inline-start" />
              待定
              <Kbd>H</Kbd>
            </Button>
            <Separator orientation="vertical" className="h-9" />
            <Button variant="ghost">
              <BookmarkPlus data-icon="inline-start" />
              提升为基准
              <Kbd>B</Kbd>
            </Button>
            <Button variant="ghost">
              <CircleUser data-icon="inline-start" />
              FaceID 参考
              <Kbd>F</Kbd>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>批次进度</CardTitle>
              <CardDescription>夏日祭 #14</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">已筛</span>
                <span className="tabular-nums">23 / 62</span>
              </div>
              <Progress value={37} aria-label="批次进度" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">通过率</span>
                <span className="tabular-nums">34%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>评分分布</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {ratingDist.map((r) => (
                <div key={r.score} className="grid grid-cols-[16px_1fr_24px] items-center gap-2 text-xs">
                  <span className="text-muted-foreground tabular-nums">{r.score}</span>
                  <Progress value={r.pct} aria-label={`${r.score} 分占比`} />
                  <span className="text-right text-muted-foreground tabular-nums">{r.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>接下来</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="grid aspect-3/4 grid-cols-[1fr_1px_1fr] overflow-hidden rounded-md border"
                >
                  <div className="bg-muted" />
                  <div className="bg-primary/40" />
                  <div className="bg-accent" />
                </div>
              ))}
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
