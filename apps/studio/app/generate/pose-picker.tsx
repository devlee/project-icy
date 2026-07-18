"use client"

import { useMemo, useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type PoseOption = {
  id: string
  name: string
  filePath: string
  tags: string
}

function contentUrl(path: string) {
  return `/api/content/${path.split("/").map(encodeURIComponent).join("/")}`
}

/** Single-select pose for pair tasks. */
export function PoseSelect({
  poses,
  value,
  onChange,
  name = "poseId",
}: {
  poses: PoseOption[]
  value: string
  onChange: (id: string) => void
  name?: string
}) {
  const selected = poses.find((p) => p.id === value)
  return (
    <Field>
      <FieldLabel>姿势骨架（ControlNet）</FieldLabel>
      <input type="hidden" name={name} value={value} />
      {poses.length === 0 ? (
        <FieldDescription>暂无姿势，请先在姿势库导入预设或上传</FieldDescription>
      ) : (
        <div className="flex items-center gap-3">
          <Select
            value={value || "__none__"}
            onValueChange={(v) => onChange(!v || v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="可选 · 不选则不走 ControlNet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不使用姿势</SelectItem>
              {poses.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.tags ? ` · ${p.tags}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contentUrl(selected.filePath)}
              alt=""
              className="size-12 rounded-sm border object-cover"
            />
          ) : null}
        </div>
      )}
    </Field>
  )
}

/** Multi-select pose pool for series batches. */
export function PosePoolPicker({
  poses,
  selectedIds,
  onChange,
  name = "poseIds",
}: {
  poses: PoseOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  name?: string
}) {
  const [search, setSearch] = useState("")
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return poses
    return poses.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.tags.toLowerCase().includes(q),
    )
  }, [poses, search])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  return (
    <Field>
      <FieldLabel>姿势池</FieldLabel>
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {poses.length === 0 ? (
        <FieldDescription>暂无姿势</FieldDescription>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索姿势…"
          />
          <ScrollArea className="h-40">
            <ul className="flex flex-col gap-1 pr-2">
              {filtered.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedSet.has(p.id)}
                    onCheckedChange={(v) => {
                      if (v === true) onChange([...selectedIds, p.id])
                      else onChange(selectedIds.filter((x) => x !== p.id))
                    }}
                  />
                  <span>{p.name}</span>
                  {p.tags ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {p.tags}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </ScrollArea>
          <FieldDescription>
            已选 {selectedIds.length}；批次每次随机抽一个
          </FieldDescription>
        </div>
      )}
    </Field>
  )
}
