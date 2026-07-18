import { ImageUp, Layers, Wand2 } from "lucide-react"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const pending = [
  { id: "PS-2871", char: "凛冬 Rin", series: "夏日祭 #14", rating: 5, stage: "待增强" },
  { id: "PS-2869", char: "凛冬 Rin", series: "夏日祭 #14", rating: 4, stage: "待增强" },
  { id: "PS-2863", char: "小满 Mitsu", series: "雨季 #4", rating: 4, stage: "待增强" },
]

const composing = [
  { id: "PS-2858", char: "凛冬 Rin", series: "夏日祭 #13", rating: 5, stage: "待拼版" },
  { id: "PS-2851", char: "芽衣 Mei", series: "街拍 #2", rating: 4, stage: "待拼版" },
]

const ready = [
  { id: "PS-2840", char: "凛冬 Rin", series: "夏日祭 #12", platforms: "小红书 / X / B站", stage: "已就绪" },
  { id: "PS-2836", char: "小满 Mitsu", series: "雨季 #3", platforms: "小红书 / X", stage: "已就绪" },
]

function PairCell() {
  return (
    <div className="grid h-9 w-14 grid-cols-[1fr_1px_1fr] overflow-hidden rounded-sm border">
      <div className="bg-muted" />
      <div className="bg-primary/40" />
      <div className="bg-accent" />
    </div>
  )
}

export default function PostPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">后期车间</h1>
        <span className="text-sm text-muted-foreground">
          通过筛选的 PairSet 自动进入此处，产出多平台成品包
        </span>
      </div>

      <Tabs defaultValue="enhance" className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="enhance">待增强 · 3</TabsTrigger>
            <TabsTrigger value="compose">待拼版 · 2</TabsTrigger>
            <TabsTrigger value="ready">已就绪 · 2</TabsTrigger>
          </TabsList>
          <div className="ml-auto flex gap-2">
            <Button variant="outline">
              <Wand2 data-icon="inline-start" />
              批量脸修 + 超分
            </Button>
            <Button>
              <Layers data-icon="inline-start" />
              批量拼版 + 水印
            </Button>
          </div>
        </div>

        <TabsContent value="enhance">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox aria-label="全选" />
                    </TableHead>
                    <TableHead>预览</TableHead>
                    <TableHead>编号</TableHead>
                    <TableHead>角色 / 系列</TableHead>
                    <TableHead>评分</TableHead>
                    <TableHead className="text-right">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox aria-label={`选择 ${r.id}`} />
                      </TableCell>
                      <TableCell>
                        <PairCell />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell>
                        {r.char}
                        <span className="ml-2 text-muted-foreground">{r.series}</span>
                      </TableCell>
                      <TableCell className="tabular-nums">{"★".repeat(r.rating)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{r.stage}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compose">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox aria-label="全选" />
                    </TableHead>
                    <TableHead>预览</TableHead>
                    <TableHead>编号</TableHead>
                    <TableHead>角色 / 系列</TableHead>
                    <TableHead>评分</TableHead>
                    <TableHead className="text-right">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {composing.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox aria-label={`选择 ${r.id}`} />
                      </TableCell>
                      <TableCell>
                        <PairCell />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell>
                        {r.char}
                        <span className="ml-2 text-muted-foreground">{r.series}</span>
                      </TableCell>
                      <TableCell className="tabular-nums">{"★".repeat(r.rating)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{r.stage}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ready">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">成品包</CardTitle>
              <CardDescription>已输出全平台尺寸 + 水印，可进入排期</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>预览</TableHead>
                    <TableHead>编号</TableHead>
                    <TableHead>角色 / 系列</TableHead>
                    <TableHead>平台尺寸</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ready.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <PairCell />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell>
                        {r.char}
                        <span className="ml-2 text-muted-foreground">{r.series}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.platforms}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                          <ImageUp data-icon="inline-start" />
                          加入排期
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
