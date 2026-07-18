"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, Trash2, Upload } from "lucide-react"

import {
  createPoseAction,
  deletePoseAction,
  importPosePresetsAction,
  type ActionResult,
} from "./actions"
import type { PoseOption } from "./pose-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"

function contentUrl(path: string) {
  return `/api/content/${path.split("/").map(encodeURIComponent).join("/")}`
}

export function PoseManager({ poses }: { poses: PoseOption[] }) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [tags, setTags] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, startTransition] = useTransition()

  useEffect(() => {
    setMessage(null)
    setError(null)
  }, [poses.length])

  const importPresets = () => {
    startTransition(async () => {
      const res = await importPosePresetsAction()
      if (!res.ok) setError(res.error)
      else {
        setMessage(`导入预设：新增 ${res.inserted ?? 0}，跳过 ${res.skipped ?? 0}`)
        router.refresh()
      }
    })
  }

  const create = () => {
    if (!file) {
      setError("请选择骨架图")
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.set("name", name)
      fd.set("tags", tags)
      fd.set("file", file)
      const res: ActionResult = await createPoseAction(null, fd)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setName("")
      setTags("")
      setFile(null)
      setMessage("已创建姿势")
      router.refresh()
    })
  }

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deletePoseAction(id)
      if (!res.ok) setError(res.error)
      else {
        setMessage("已删除")
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">姿势库（ControlNet）</CardTitle>
        <CardDescription>
          上传 OpenPose/骨架图，或导入 20 个占位预设（生产请替换为真实骨架）
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={importPresets}>
            {busy ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
            导入预设
          </Button>
          <Badge variant="secondary">{poses.length} 个</Badge>
        </div>

        <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="grid gap-1">
            <Label htmlFor="pose-name">名称</Label>
            <Input id="pose-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="pose-tags">标签</Label>
            <Input id="pose-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="pose-file">骨架图</Label>
            <Input
              id="pose-file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button className="sm:self-end" disabled={busy || !name.trim()} onClick={create}>
            <Upload data-icon="inline-start" />
            上传创建
          </Button>
        </div>

        {(error || message) && (
          <p className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
            {error ?? message}
          </p>
        )}

        <ItemGroup className="gap-1">
          {poses.map((p) => (
            <Item key={p.id} variant="muted" size="sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={contentUrl(p.filePath)}
                alt=""
                className="size-10 rounded-sm border object-cover"
              />
              <ItemContent>
                <ItemTitle>{p.name}</ItemTitle>
                <ItemDescription className="font-mono text-[10px]">
                  {p.tags || p.filePath}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => remove(p.id)}
                >
                  <Trash2 data-icon="inline-start" />
                  删除
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}
