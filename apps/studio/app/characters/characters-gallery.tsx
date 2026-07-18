"use client"

import { useState } from "react"
import { UserRound } from "lucide-react"
import type { CharacterListItem } from "@icy/core"
import type { CharacterStatus } from "@icy/shared"

import { Badge } from "@/components/ui/badge"
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
import { CharacterStatusSelect } from "./character-status-select"
import {
  CharacterOriginFilter,
  type OriginFilter,
} from "./character-origin-filter"

const STATUS_BADGE: Record<
  CharacterStatus,
  "default" | "secondary" | "outline"
> = {
  featured: "default",
  growing: "secondary",
  draft: "outline",
  archived: "outline",
}

const STATUS_LABEL: Record<CharacterStatus, string> = {
  draft: "草稿",
  growing: "养成中",
  featured: "主推",
  archived: "封存",
}

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

export function CharactersGallery({
  characters,
}: {
  characters: CharacterListItem[]
}) {
  const [filter, setFilter] = useState<OriginFilter>("all")
  const counts = {
    all: characters.length,
    original: characters.filter((c) => c.origin === "original").length,
    ip_reference: characters.filter((c) => c.origin === "ip_reference").length,
  }
  const visible =
    filter === "all" ? characters : characters.filter((c) => c.origin === filter)

  return (
    <div className="flex flex-col gap-4">
      <CharacterOriginFilter value={filter} counts={counts} onChange={setFilter} />
      {visible.length === 0 ? (
        <Empty className="border border-dashed py-12">
          <EmptyHeader>
            <EmptyTitle className="text-sm">此分类下暂无角色</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((c) => (
            <Card key={c.id} className={c.status === "archived" ? "opacity-60" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="truncate">{c.name}</span>
                  <Badge variant={STATUS_BADGE[c.status]} className="ml-auto shrink-0">
                    {STATUS_LABEL[c.status]}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  <span>
                    {c.origin === "ip_reference" ? (
                      <>
                        <Badge variant="outline" className="mr-1.5 font-normal">
                          IP
                        </Badge>
                        {c.ipSource || "未标注作品"}
                      </>
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        原创
                      </Badge>
                    )}
                  </span>
                  <span>
                    {c.tagline || c.profile || (
                      <span className="font-mono text-xs">{c.slug}</span>
                    )}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {c.hasDualAnchors ? (
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
              <CardFooter className="flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">FaceID ×{c.faceIdRefCount}</span>
                <span className="tabular-nums">LoRA ×{c.loraCount}</span>
                <span className="tabular-nums">PairSet {c.pairSetCount}</span>
                <div className="ml-auto">
                  <CharacterStatusSelect id={c.id} status={c.status} />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
