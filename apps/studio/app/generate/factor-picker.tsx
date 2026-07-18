"use client"

import { useMemo, useState } from "react"
import type { FactorCategory } from "@icy/shared"
import { FACTOR_CATEGORIES } from "@icy/shared"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type FactorOption = {
  id: string
  category: FactorCategory
  name: string
  promptFragment: string
  enabled: boolean
}

const CATEGORY_LABEL: Record<FactorCategory, string> = {
  style: "风格",
  scene: "场景",
  outfit: "服装",
  lighting: "光影",
  pose: "姿势",
  expression: "表情",
  composition: "构图",
  other: "其他",
}

/** Multi-select factors: browse by category + search. Disabled factors are hidden. */
export function FactorPicker({
  factors,
  selectedIds,
  onChange,
  name = "factorIds",
  label = "因子",
  description,
  emptyText = "暂无可用因子，请先在因子库导入或创建",
}: {
  factors: FactorOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  name?: string
  label?: string
  description?: string
  emptyText?: string
}) {
  const enabled = useMemo(() => factors.filter((f) => f.enabled), [factors])
  const categories = useMemo(() => {
    const present = new Set(enabled.map((f) => f.category))
    return FACTOR_CATEGORIES.filter((c) => present.has(c))
  }, [enabled])

  const [category, setCategory] = useState<FactorCategory | "all">("all")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enabled.filter((f) => {
      if (category !== "all" && f.category !== category) return false
      if (!q) return true
      return (
        f.name.toLowerCase().includes(q) ||
        f.promptFragment.toLowerCase().includes(q)
      )
    })
  }, [enabled, category, search])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedNames = enabled
    .filter((f) => selectedSet.has(f.id))
    .map((f) => f.name)

  const toggle = (id: string, checked: boolean) => {
    if (checked) onChange([...selectedIds, id])
    else onChange(selectedIds.filter((x) => x !== id))
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      {enabled.length === 0 ? (
        <FieldDescription>{emptyText}</FieldDescription>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索名称或提示词…"
            aria-label="搜索因子"
          />

          {categories.length > 0 ? (
            <ToggleGroup
              value={[category]}
              onValueChange={(v) => {
                const next = v[0]
                if (next === "all" || (FACTOR_CATEGORIES as readonly string[]).includes(next)) {
                  setCategory(next as FactorCategory | "all")
                }
              }}
              variant="outline"
              className="flex flex-wrap"
            >
              <ToggleGroupItem value="all">全部</ToggleGroupItem>
              {categories.map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <ScrollArea className="h-44">
            <FieldSet className="gap-2 pr-3">
              <FieldLegend className="sr-only">可选因子</FieldLegend>
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground">无匹配因子</p>
              ) : (
                filtered.map((f) => {
                  const checked = selectedSet.has(f.id)
                  return (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggle(f.id, value === true)}
                        className="mt-0.5"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-sm">
                          {f.name}
                          <Badge variant="outline" className="font-normal">
                            {CATEGORY_LABEL[f.category]}
                          </Badge>
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {f.promptFragment}
                        </span>
                      </span>
                    </label>
                  )
                })
              )}
            </FieldSet>
          </ScrollArea>

          {selectedNames.length > 0 ? (
            <FieldDescription>已选 {selectedNames.join(" · ")}</FieldDescription>
          ) : description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : (
            <FieldDescription>可选；禁用因子不会出现在列表中</FieldDescription>
          )}
        </div>
      )}
    </Field>
  )
}

export { CATEGORY_LABEL }
