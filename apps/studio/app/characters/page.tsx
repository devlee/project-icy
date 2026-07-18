import { Plus, UserRound } from "lucide-react"

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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

const characters = [
  {
    name: "凛冬 Rin",
    slug: "rin",
    status: "主推",
    statusVariant: "default" as const,
    profile: "冷感银发少女，冬日与冰的意象",
    faceIdRefs: 12,
    loras: 2,
    pairSets: 86,
  },
  {
    name: "小满 Mitsu",
    slug: "mitsu",
    status: "养成中",
    statusVariant: "secondary" as const,
    profile: "元气棕发邻家系，雨季系列主角",
    faceIdRefs: 8,
    loras: 1,
    pairSets: 41,
  },
  {
    name: "芽衣 Mei",
    slug: "mei",
    status: "养成中",
    statusVariant: "secondary" as const,
    profile: "都市街拍风，黑长直",
    faceIdRefs: 5,
    loras: 1,
    pairSets: 23,
  },
  {
    name: "未名 #04",
    slug: "draft-04",
    status: "草稿",
    statusVariant: "outline" as const,
    profile: "概念阶段：和风 + 赛博元素",
    faceIdRefs: 0,
    loras: 0,
    pairSets: 3,
  },
]

function AnchorPair() {
  return (
    <div className="grid aspect-3/2 grid-cols-[1fr_2px_1fr] overflow-hidden rounded-lg border">
      <div className="flex items-center justify-center bg-muted">
        <span className="font-mono text-[10px] text-muted-foreground">ANIME</span>
      </div>
      <div className="bg-primary" aria-hidden="true" />
      <div className="flex items-center justify-center bg-accent">
        <span className="font-mono text-[10px] text-muted-foreground">REAL</span>
      </div>
    </div>
  )
}

export default function CharactersPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">角色库</h1>
        <span className="text-sm text-muted-foreground">4 个角色 · 1 主推</span>
        <Button className="ml-auto">
          <Plus data-icon="inline-start" />
          新建角色
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {characters.map((c) => (
          <Card key={c.slug}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {c.name}
                <Badge variant={c.statusVariant} className="ml-auto">
                  {c.status}
                </Badge>
              </CardTitle>
              <CardDescription>{c.profile}</CardDescription>
            </CardHeader>
            <CardContent>
              {c.pairSets > 5 ? (
                <AnchorPair />
              ) : (
                <Empty className="aspect-3/2 rounded-lg border border-dashed p-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UserRound />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">尚无双形态基准</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      从生成结果中提升，或手动上传
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
            <CardFooter className="gap-4 text-xs text-muted-foreground">
              <span className="tabular-nums">FaceID ×{c.faceIdRefs}</span>
              <span className="tabular-nums">LoRA ×{c.loras}</span>
              <span className="ml-auto tabular-nums">PairSet {c.pairSets}</span>
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  )
}
