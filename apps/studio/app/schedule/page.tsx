import { Copy, FolderOpen } from "lucide-react"

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
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"

const week = [
  { day: "周一 07-13", items: [{ title: "凛冬 · 夏日祭 #10", platform: "小红书", done: true }] },
  { day: "周二 07-14", items: [{ title: "凛冬 · 夏日祭 #11", platform: "X", done: true }] },
  {
    day: "周三 07-15",
    items: [
      { title: "小满 · 雨季 #3", platform: "小红书", done: true },
      { title: "凛冬 · 夏日祭 #11", platform: "B站", done: true },
    ],
  },
  { day: "周四 07-16", items: [{ title: "芽衣 · 街拍 #1", platform: "X", done: true }] },
  { day: "周五 07-17", items: [{ title: "凛冬 · 夏日祭 #12", platform: "小红书", done: true }] },
  {
    day: "周六 07-18 · 今天",
    today: true,
    items: [
      { title: "凛冬 · 夏日祭 #12", platform: "小红书", done: true },
      { title: "凛冬 · 夏日祭 #13", platform: "X", done: false },
      { title: "小满 · 雨季 #4", platform: "B站", done: false },
    ],
  },
  { day: "周日 07-19", items: [] },
]

const todayList = [
  { title: "凛冬 · 夏日祭 #12 对照组", platform: "小红书", status: "已发布", done: true },
  { title: "凛冬 · 夏日祭 #13 对照组", platform: "X", status: "素材就绪", done: false },
  { title: "小满 · 雨季系列 #4 变身视频", platform: "B站", status: "待拼版", done: false },
]

export default function SchedulePage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">库存与排期</h1>
        <span className="text-sm text-muted-foreground">本周 07-13 至 07-19 · 已排 9 项</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">库存</span>
          <Badge>8.5 天</Badge>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-7">
        {week.map((d) => (
          <Card key={d.day} className={d.today ? "border-primary" : undefined}>
            <CardHeader className="px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {d.day}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 px-3">
              {d.items.length === 0 ? (
                <span className="rounded-md border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
                  休息日
                </span>
              ) : (
                d.items.map((it) => (
                  <div
                    key={`${it.title}-${it.platform}`}
                    className="flex flex-col gap-0.5 rounded-md bg-muted/50 px-2 py-1.5"
                  >
                    <span className="truncate text-xs">{it.title}</span>
                    <span className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                      {it.platform}
                      {it.done ? <Badge variant="outline">✓</Badge> : null}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>今日待发布清单</CardTitle>
          <CardDescription>
            半自动发布：复制文案、打开素材文件夹，最后一步在平台手动完成
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-1">
            {todayList.map((t) => (
              <Item key={t.title} variant="muted" size="sm">
                <Checkbox defaultChecked={t.done} aria-label={`标记 ${t.title}`} />
                <ItemContent>
                  <ItemTitle>{t.title}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <span className="font-mono text-xs text-muted-foreground">{t.platform}</span>
                  <Badge variant={t.done ? "outline" : "secondary"}>{t.status}</Badge>
                  <Button variant="ghost" size="sm" disabled={t.done}>
                    <Copy data-icon="inline-start" />
                    复制文案
                  </Button>
                  <Button variant="ghost" size="sm" disabled={t.done}>
                    <FolderOpen data-icon="inline-start" />
                    素材
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>
    </main>
  )
}
