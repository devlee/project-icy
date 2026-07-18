import { Clock, Play, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const factors = ["浴衣", "祭典夜景", "灯笼暖光", "海边", "白裙", "黄昏逆光", "教室", "雨夜霓虹"]

const queue = [
  { title: "凛冬 · 夏日祭 #15", detail: "pair ×8 · seed 随机", status: "生成中 3/8", running: true, eta: "06:12" },
  { title: "芽衣 · 街拍系列 #2", detail: "pair ×6 · seed 随机", status: "排队", running: false },
  { title: "小满 · 定时批次", detail: "cron 04:00 · pair ×12", status: "明晨", running: false },
]

export default function GeneratePage() {
  return (
    <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(360px,480px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>成对任务</CardTitle>
          <CardDescription>共享 seed / pose / FaceID，一键产出双形态</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="character">角色</FieldLabel>
              <Select defaultValue="rin">
                <SelectTrigger id="character" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="rin">凛冬 Rin</SelectItem>
                    <SelectItem value="mitsu">小满 Mitsu</SelectItem>
                    <SelectItem value="mei">芽衣 Mei</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>自动带入 FaceID 参考、LoRA 与默认因子</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="pose">构图 / Pose</FieldLabel>
              <Select defaultValue="p017">
                <SelectTrigger id="pose" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="p017">P-017 坐姿回眸</SelectItem>
                    <SelectItem value="p003">P-003 站姿正面</SelectItem>
                    <SelectItem value="p021">P-021 侧身倚靠</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>叠加因子</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {factors.map((f, i) => (
                  <Badge key={f} variant={i < 3 ? "default" : "outline"}>
                    {f}
                  </Badge>
                ))}
              </div>
              <FieldDescription>已选 3 项 · 来自因子库</FieldDescription>
            </Field>

            <Field orientation="responsive">
              <Field>
                <FieldLabel>Seed 策略</FieldLabel>
                <ToggleGroup defaultValue={["random"]} variant="outline">
                  <ToggleGroupItem value="random">随机</ToggleGroupItem>
                  <ToggleGroupItem value="fixed">固定</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="count">数量</FieldLabel>
                <Input id="count" type="number" defaultValue={8} min={1} max={24} />
              </Field>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button className="w-full">
            <Sparkles data-icon="inline-start" />
            提交成对任务
          </Button>
        </CardFooter>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>任务队列</CardTitle>
            <CardDescription>GPU 串行执行 · 交互任务优先于批次</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-1">
              {queue.map((q) => (
                <Item key={q.title} variant="muted" size="sm">
                  <ItemMedia variant="icon">
                    {q.running ? <Spinner /> : <Clock />}
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {q.title}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {q.detail}
                      </span>
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
            <CardTitle>批次系列</CardTitle>
            <CardDescription>定时批次挂在系列下，按因子池随机组合</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-1">
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>
                    夏日祭 <span className="font-normal text-muted-foreground">凛冬 Rin</span>
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  <span className="font-mono text-xs text-muted-foreground">cron 04:00 · ×12</span>
                  <Badge>启用</Badge>
                  <Button variant="ghost" size="sm">
                    <Play data-icon="inline-start" />
                    立即执行
                  </Button>
                </ItemActions>
              </Item>
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>
                    雨季系列 <span className="font-normal text-muted-foreground">小满 Mitsu</span>
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  <span className="font-mono text-xs text-muted-foreground">手动 · ×8</span>
                  <Badge variant="secondary">暂停</Badge>
                  <Button variant="ghost" size="sm">
                    <Play data-icon="inline-start" />
                    立即执行
                  </Button>
                </ItemActions>
              </Item>
            </ItemGroup>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
