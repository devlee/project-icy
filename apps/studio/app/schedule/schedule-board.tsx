"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Globe, Layers } from "lucide-react"
import type { Platform, PublishStatus } from "@icy/shared"

import {
  createPlanAction,
  markPublishedAction,
  updatePlanCaptionAction,
  type ActionResult,
} from "./actions"
import { exportPortalPackAction } from "./export-portal-action"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"

export type InventoryPackView = {
  id: string
  characterName: string
  seed: number
  rating: number | null
  animeImagePath: string
  realImagePath: string
  assetCount: number
}

export type PlanAssetView = {
  id: string
  filePath: string
  localPath: string
  platform: Platform
  kind: string
}

export type PlanView = {
  id: string
  date: string
  platform: Platform
  status: PublishStatus
  caption: string
  hashtags: string
  notes: string
  publishedAt: string | null
  assets: PlanAssetView[]
  previewPath: string | null
}

const PLATFORM_LABEL: Record<Exclude<Platform, "generic">, string> = {
  xiaohongshu: "小红书",
  x: "X",
  bilibili: "B站",
}

const PUBLISH_PLATFORMS = ["xiaohongshu", "x", "bilibili"] as const

function contentUrl(path: string) {
  return `/api/content/${path.split("/").map(encodeURIComponent).join("/")}`
}

function inventoryTone(days: number): "default" | "secondary" | "destructive" {
  if (days >= 7) return "default"
  if (days >= 4) return "secondary"
  return "destructive"
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text)
}

function formatCopyBody(caption: string, hashtags: string) {
  return [caption.trim(), hashtags.trim()].filter(Boolean).join("\n\n")
}

export function ScheduleBoard({
  today,
  stats,
  packs,
  todayPlans,
  upcomingPlans,
  recentPublished,
  prefillPairSetId,
}: {
  today: string
  stats: { readyPacks: number; days: number; dailyBurn: number }
  packs: InventoryPackView[]
  todayPlans: PlanView[]
  upcomingPlans: PlanView[]
  recentPublished: PlanView[]
  prefillPairSetId: string | null
}) {
  const router = useRouter()
  const [pairSetId, setPairSetId] = useState(prefillPairSetId ?? "")
  const [platform, setPlatform] = useState<(typeof PUBLISH_PLATFORMS)[number]>("xiaohongshu")
  const [date, setDate] = useState(today)
  const [caption, setCaption] = useState("")
  const [hashtags, setHashtags] = useState("#AI生成 #双形态")
  const [formError, setFormError] = useState<string | null>(null)
  const [formOk, setFormOk] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [editDraft, setEditDraft] = useState<Record<string, { caption: string; hashtags: string }>>({})

  useEffect(() => {
    if (prefillPairSetId) setPairSetId(prefillPairSetId)
  }, [prefillPairSetId])

  const selectedPack = useMemo(
    () => packs.find((p) => p.id === pairSetId) ?? null,
    [packs, pairSetId],
  )
  const packItems = packs.map((pack) => ({
    label: `${pack.characterName} · seed ${pack.seed} · ${pack.assetCount} 资产`,
    value: pack.id,
  }))
  const platformItems = PUBLISH_PLATFORMS.map((value) => ({
    label: PLATFORM_LABEL[value],
    value,
  }))

  const submitCreate = () => {
    setFormError(null)
    setFormOk(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("pairSetId", pairSetId)
      fd.set("platform", platform)
      fd.set("date", date)
      fd.set("caption", caption)
      fd.set("hashtags", hashtags)
      const res: ActionResult = await createPlanAction(null, fd)
      if (!res.ok) {
        setFormError(res.error)
        return
      }
      setFormOk("已加入排期")
      setCaption("")
      router.refresh()
    })
  }

  const onCopy = async (plan: PlanView) => {
    await copyText(formatCopyBody(plan.caption, plan.hashtags))
    setCopiedId(plan.id)
    window.setTimeout(() => setCopiedId((id) => (id === plan.id ? null : id)), 1500)
  }

  const onMarkPublished = (planId: string) => {
    startTransition(async () => {
      const res = await markPublishedAction(planId, notesDraft[planId])
      if (!res.ok) {
        setFormError(res.error)
        return
      }
      router.refresh()
    })
  }

  const onSaveCaption = (planId: string) => {
    const draft = editDraft[planId]
    if (!draft) return
    startTransition(async () => {
      const res = await updatePlanCaptionAction(planId, draft.caption, draft.hashtags)
      if (!res.ok) {
        setFormError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">库存与排期</h1>
        <span className="text-sm text-muted-foreground">
          半自动发布 · 今日 {today}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">成品库存</span>
          <Badge variant={inventoryTone(stats.days)}>
            {stats.readyPacks} 包 · {stats.days} 天
          </Badge>
          <span className="font-mono text-[10px] text-muted-foreground">
            日耗 {stats.dailyBurn}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setFormError(null)
              setFormOk(null)
              startTransition(async () => {
                const res = await exportPortalPackAction()
                if (!res.ok) {
                  setFormError(res.error)
                  return
                }
                setFormOk(
                  `已导出门户包 ${res.packPath}（角色 ${res.characters} · 画廊 ${res.galleryItems}）`,
                )
              })
            }}
          >
            <Globe data-icon="inline-start" />
            发布到门户
          </Button>
        </div>
      </div>

      {(formError || formOk) && (
        <p className={`text-xs ${formError ? "text-destructive" : "text-muted-foreground"}`}>
          {formError ?? formOk}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">创建排期</CardTitle>
            <CardDescription>
              选择 composed 成品包与平台，自动挂平台尺寸素材（无则用拼版）
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {packs.length === 0 ? (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyTitle className="text-sm">暂无成品库存</EmptyTitle>
                  <EmptyDescription className="text-xs">
                    先在后期完成拼版导出，成品会出现在这里
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="pairSetId">成品包</FieldLabel>
                  <Select
                    items={packItems}
                    value={pairSetId || undefined}
                    onValueChange={(v) => setPairSetId(v ?? "")}
                  >
                    <SelectTrigger id="pairSetId" className="w-full">
                      <SelectValue placeholder="选择 PairSet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {packs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.characterName} · seed {p.seed} · {p.assetCount} 资产
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {selectedPack ? (
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-16 grid-cols-[1fr_1px_1fr] overflow-hidden rounded-sm border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={contentUrl(selectedPack.animeImagePath)}
                          alt=""
                          className="size-full object-cover"
                        />
                        <div className="bg-primary/40" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={contentUrl(selectedPack.realImagePath)}
                          alt=""
                          className="size-full object-cover"
                        />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {selectedPack.id.slice(0, 12)}…
                      </span>
                    </div>
                  ) : null}
                </Field>

                <Field orientation="responsive">
                  <Field>
                    <FieldLabel>平台</FieldLabel>
                    <Select
                      items={platformItems}
                      value={platform}
                      onValueChange={(v) => {
                        if (v === "xiaohongshu" || v === "x" || v === "bilibili") {
                          setPlatform(v)
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PUBLISH_PLATFORMS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {PLATFORM_LABEL[p]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="plan-date">日期</FieldLabel>
                    <Input
                      id="plan-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                </Field>

                <Field>
                  <FieldLabel htmlFor="caption">文案</FieldLabel>
                  <Textarea
                    id="caption"
                    rows={3}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="发布文案…"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="hashtags">标签</FieldLabel>
                  <Input
                    id="hashtags"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#tag"
                  />
                </Field>

                <Button disabled={busy || !pairSetId} onClick={submitCreate}>
                  {busy ? <Spinner data-icon="inline-start" /> : <Layers data-icon="inline-start" />}
                  加入排期
                </Button>
              </FieldGroup>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">今日待发布清单</CardTitle>
            <CardDescription>
              复制文案 → 按路径打开素材 → 平台手动发布 → 勾选已发布
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {todayPlans.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                今日暂无待发布项
              </p>
            ) : (
              todayPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  busy={busy}
                  copied={copiedId === plan.id}
                  notes={notesDraft[plan.id] ?? plan.notes}
                  onNotesChange={(v) =>
                    setNotesDraft((prev) => ({ ...prev, [plan.id]: v }))
                  }
                  onCopy={() => void onCopy(plan)}
                  onPublish={() => onMarkPublished(plan.id)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">近期排期</CardTitle>
          <CardDescription>逾期未发布项、未来 7 天（含今日）与最近已发布，可改文案</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[...upcomingPlans, ...recentPublished].length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">暂无排期记录</p>
          ) : (
            [...upcomingPlans, ...recentPublished].map((plan) => {
              const draft = editDraft[plan.id] ?? {
                caption: plan.caption,
                hashtags: plan.hashtags,
              }
              return (
                <div
                  key={plan.id}
                  className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-start"
                >
                  <div className="flex min-w-40 flex-col gap-1">
                    <span className="font-mono text-xs">{plan.date}</span>
                    <span className="text-xs text-muted-foreground">
                      {PLATFORM_LABEL[plan.platform as Exclude<Platform, "generic">] ??
                        plan.platform}
                    </span>
                    <Badge variant="outline" className="w-fit">
                      {plan.status === "published"
                        ? "已发布"
                        : plan.status === "ready"
                          ? "就绪"
                          : "计划中"}
                    </Badge>
                  </div>
                  <div className="grid flex-1 gap-2">
                    <Textarea
                      rows={2}
                      value={draft.caption}
                      disabled={plan.status === "published"}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          [plan.id]: { ...draft, caption: e.target.value },
                        }))
                      }
                    />
                    <Input
                      value={draft.hashtags}
                      disabled={plan.status === "published"}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          [plan.id]: { ...draft, hashtags: e.target.value },
                        }))
                      }
                    />
                  </div>
                  {plan.status !== "published" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => onSaveCaption(plan.id)}
                    >
                      保存文案
                    </Button>
                  ) : null}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function PlanCard({
  plan,
  busy,
  copied,
  notes,
  onNotesChange,
  onCopy,
  onPublish,
}: {
  plan: PlanView
  busy: boolean
  copied: boolean
  notes: string
  onNotesChange: (v: string) => void
  onCopy: () => void
  onPublish: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-start gap-3">
        {plan.previewPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contentUrl(plan.previewPath)}
            alt=""
            className="h-16 w-12 rounded-sm border object-cover"
          />
        ) : (
          <div className="flex h-16 w-12 items-center justify-center rounded-sm border text-[10px] text-muted-foreground">
            无图
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {PLATFORM_LABEL[plan.platform as Exclude<Platform, "generic">] ??
                plan.platform}
            </span>
            <Badge variant="secondary">
              {plan.status === "ready" ? "素材就绪" : "计划中"}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {plan.caption || "（无文案）"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={onCopy}>
            {copied ? (
              <Check data-icon="inline-start" />
            ) : (
              <Copy data-icon="inline-start" />
            )}
            {copied ? "已复制" : "复制文案"}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={onPublish}>
            标记已发布
          </Button>
        </div>
      </div>

      <div className="grid gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">素材路径</span>
        <ul className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground">
          {plan.assets.map((a) => (
            <li key={a.id} className="break-all">
              <span className="text-foreground/80">{a.filePath}</span>
              <br />
              <span className="opacity-70">{a.localPath}</span>
            </li>
          ))}
        </ul>
      </div>

      <Field>
        <FieldLabel htmlFor={`publish-notes-${plan.id}`}>发布备注 / 链接（可选）</FieldLabel>
        <Input
          id={`publish-notes-${plan.id}`}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="https://…"
        />
      </Field>
    </div>
  )
}
