"use client"

import { useState } from "react"
import { UserRound } from "lucide-react"
import type { CharacterListItem } from "@icy/core"
import type { CharacterStatus, Form } from "@icy/shared"

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
import {
  CharacterFactorsButton,
  type FactorBindOption,
} from "./character-factors"
import { UploadAnchor } from "./upload-anchor"

function contentUrl(path: string) {
  return `/api/content/${path.split("/").map(encodeURIComponent).join("/")}`
}

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

function AnchorPreview({ path, form }: { path: string | null; form: Form }) {
  const label = form.toUpperCase()
  if (path) {
    return (
      <div className="relative aspect-3/2 overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={contentUrl(path)}
          alt={`${form} 主基准`}
          className="size-full object-cover"
        />
        <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {label}
        </span>
      </div>
    )
  }
  return (
    <Empty className="aspect-3/2 rounded-lg border border-dashed p-3">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UserRound />
        </EmptyMedia>
        <EmptyTitle className="text-sm">尚无 {form} 基准</EmptyTitle>
        <EmptyDescription className="text-xs">
          {form === "anime"
            ? "二次元参考 · IP-Adapter"
            : "真人参考 · IP-Adapter"}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function CharactersGallery({
  characters,
  factors = [],
  factorIdsByCharacter = {},
}: {
  characters: CharacterListItem[]
  factors?: FactorBindOption[]
  factorIdsByCharacter?: Record<string, string[]>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  <span className="line-clamp-2">
                    {c.tagline || c.profile || (
                      <span className="font-mono text-xs">{c.slug}</span>
                    )}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <AnchorPreview path={c.animeAnchorPath} form="anime" />
                    <UploadAnchor characterId={c.id} form="anime" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <AnchorPreview path={c.realAnchorPath} form="real" />
                    <UploadAnchor characterId={c.id} form="real" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  双基准 {c.hasDualAnchors ? "✓" : "—"}
                </span>
                <span className="tabular-nums">Pair ×{c.pairSetCount}</span>
                <span className="tabular-nums">LoRA ×{c.loraCount}</span>
                <CharacterFactorsButton
                  characterId={c.id}
                  factors={factors}
                  selectedIds={factorIdsByCharacter[c.id] ?? []}
                />
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
