"use client"

import type { CharacterOrigin } from "@icy/shared"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type OriginFilter = "all" | CharacterOrigin

export function CharacterOriginFilter({
  value,
  counts,
  onChange,
}: {
  value: OriginFilter
  counts: { all: number; original: number; ip_reference: number }
  onChange: (next: OriginFilter) => void
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange((v as OriginFilter) ?? "all")}>
      <TabsList>
        <TabsTrigger value="all">全部 {counts.all}</TabsTrigger>
        <TabsTrigger value="original">原创 {counts.original}</TabsTrigger>
        <TabsTrigger value="ip_reference">IP 参考 {counts.ip_reference}</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
