"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { Layers } from "lucide-react"

import { submitPairTaskAction, type ActionResult } from "./actions"
import { FactorPicker, type FactorOption } from "./factor-picker"
import { PoseSelect, type PoseOption } from "./pose-picker"
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import type { CharacterOption } from "./single-task-form"

function contentUrl(path: string) {
  return `/api/content/${path.split("/").map(encodeURIComponent).join("/")}`
}

export function PairTaskForm({
  characters,
  factors,
  poses,
}: {
  characters: CharacterOption[]
  factors: FactorOption[]
  poses: PoseOption[]
}) {
  const formId = useId()
  const active = characters.filter((c) => c.status !== "archived")
  const characterItems = active.map((character) => ({
    label: character.name,
    value: character.id,
  }))
  const [characterId, setCharacterId] = useState(active[0]?.id ?? "")
  const [seedKind, setSeedKind] = useState<"random" | "fixed">("fixed")
  const [extraPrompt, setExtraPrompt] = useState("")
  const [seed, setSeed] = useState("42")
  const [count, setCount] = useState("1")
  const [factorIds, setFactorIds] = useState<string[]>([])
  const [poseId, setPoseId] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [state, action, pending] = useActionState(
    submitPairTaskAction,
    null as ActionResult | null,
  )

  useEffect(() => {
    if (!characterId && active[0]) setCharacterId(active[0].id)
  }, [active, characterId])

  useEffect(() => {
    if (state?.ok) {
      setConfirmOpen(false)
      setFactorIds([])
      setPoseId("")
    }
  }, [state])

  const selected = active.find((c) => c.id === characterId)
  const characterLabel = selected
    ? `${selected.name}${selected.origin === "ip_reference" ? " · IP" : ""}`
    : "选择角色"
  const hasAnime = Boolean(selected?.animeAnchorPath)
  const hasReal = Boolean(selected?.realAnchorPath)
  const seedSummary =
    seedKind === "fixed" ? `固定 seed ${seed || "0"}` : `随机 ×${count || "1"}`
  const factorSummary =
    factorIds.length > 0
      ? factors
          .filter((f) => factorIds.includes(f.id))
          .map((f) => f.name)
          .join(" · ")
      : "无因子"

  if (active.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>成对任务</CardTitle>
          <CardDescription>先在角色库创建角色</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            成对任务
            <Badge variant="secondary" className="font-normal">
              v0.3
            </Badge>
          </CardTitle>
          <CardDescription>
            共享 seed：先 anime 再 real，写入 PairSet（筛选台下一阶段）
          </CardDescription>
        </CardHeader>
        <form
          id={formId}
          action={action}
          className="flex flex-col gap-(--card-spacing)"
        >
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>角色</FieldLabel>
                <input type="hidden" name="characterId" value={characterId} />
                <Select items={characterItems} value={characterId} onValueChange={(v) => setCharacterId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{characterLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {active.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.origin === "ip_reference" ? " · IP" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  anime 基准 {hasAnime ? "✓" : "—（纯文字）"} · real 基准{" "}
                  {hasReal ? "✓" : "—（纯文字 photoreal）"}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="pairExtraPrompt">额外提示词</FieldLabel>
                <Textarea
                  id="pairExtraPrompt"
                  name="extraPrompt"
                  rows={2}
                  value={extraPrompt}
                  onChange={(e) => setExtraPrompt(e.target.value)}
                  placeholder="姿势、场景…（两侧共用）"
                />
              </Field>

              <FactorPicker
                factors={factors}
                selectedIds={factorIds}
                onChange={setFactorIds}
                description="按分类浏览；仅启用因子可选"
              />

              <PoseSelect poses={poses} value={poseId} onChange={setPoseId} />

              <Field orientation="responsive">
                <Field>
                  <FieldLabel>Seed 策略</FieldLabel>
                  <input type="hidden" name="seedKind" value={seedKind} />
                  <ToggleGroup
                    value={[seedKind]}
                    onValueChange={(v) => {
                      const next = v[0]
                      if (next === "random" || next === "fixed") setSeedKind(next)
                    }}
                    variant="outline"
                  >
                    <ToggleGroupItem value="random">随机</ToggleGroupItem>
                    <ToggleGroupItem value="fixed">固定</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                {seedKind === "fixed" ? (
                  <Field>
                    <FieldLabel htmlFor="pairSeed">Seed</FieldLabel>
                    <Input
                      id="pairSeed"
                      name="seed"
                      type="number"
                      min={0}
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                    />
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="pairCount">数量</FieldLabel>
                    <Input
                      id="pairCount"
                      name="count"
                      type="number"
                      min={1}
                      max={24}
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                    />
                  </Field>
                )}
              </Field>

              {state && !state.ok ? <FieldError>{state.error}</FieldError> : null}
              {state?.ok ? (
                <p className="text-xs text-muted-foreground">
                  已提交{state.taskId ? ` · ${state.taskId.slice(0, 8)}…` : null}
                </p>
              ) : null}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              className="w-full"
              disabled={pending || !characterId}
              onClick={() => setConfirmOpen(true)}
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Layers data-icon="inline-start" />
              )}
              {pending ? "提交中…" : "提交成对任务"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>确认成对任务</DialogTitle>
            <DialogDescription>
              {characterLabel} · default-pair · {seedSummary} · {factorSummary}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Anime 参考</span>
                {hasAnime && selected?.animeAnchorPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={contentUrl(selected.animeAnchorPath)}
                    alt="anime"
                    className="aspect-3/2 w-full rounded-md border object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">未设置（纯文字）</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Real 参考</span>
                {hasReal && selected?.realAnchorPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={contentUrl(selected.realAnchorPath)}
                    alt="real"
                    className="aspect-3/2 w-full rounded-md border object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">未设置（纯文字）</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              每 seed 依次跑 anime → real，共享 seed；完成后写入 pending PairSet。
            </p>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>
              返回修改
            </DialogClose>
            <Button type="submit" form={formId} disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Layers data-icon="inline-start" />
              )}
              {pending ? "提交中…" : "确认提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
