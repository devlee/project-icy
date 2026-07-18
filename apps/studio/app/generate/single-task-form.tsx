"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { Sparkles } from "lucide-react"

import { submitSingleTaskAction, type ActionResult } from "./actions"
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

export type CharacterOption = {
  id: string
  name: string
  status: string
  origin: string
  tagline: string
  profile: string
  animeAnchorPath: string | null
}

function contentUrl(path: string) {
  return `/api/content/${path.split("/").map(encodeURIComponent).join("/")}`
}

export type WorkflowOption = {
  id: string
  name: string
  basePrompt: string
  baseNegativePrompt: string
}

function mergePrompts(base: string | undefined, user: string | undefined): string {
  const b = base?.trim() ?? ""
  const u = user?.trim() ?? ""
  if (!b && !u) return ""
  if (!b) return u
  if (!u) return b
  return `${b}, ${u}`
}

/** Match core run-single: tagline + extra only (never freeform profile/notes). */
function buildUserPrompt(tagline: string, extra: string): string {
  return [tagline.trim(), extra.trim()].filter(Boolean).join(", ")
}

export function SingleTaskForm({
  characters,
  workflows,
}: {
  characters: CharacterOption[]
  workflows: WorkflowOption[]
}) {
  const formId = useId()
  const active = characters.filter((c) => c.status !== "archived")
  const [characterId, setCharacterId] = useState(active[0]?.id ?? "")
  const [seedKind, setSeedKind] = useState<"random" | "fixed">("fixed")
  const [extraPrompt, setExtraPrompt] = useState("")
  const [seed, setSeed] = useState("42")
  const [count, setCount] = useState("1")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [state, action, pending] = useActionState(
    submitSingleTaskAction,
    null as ActionResult | null,
  )

  useEffect(() => {
    if (!characterId && active[0]) setCharacterId(active[0].id)
  }, [active, characterId])

  useEffect(() => {
    if (state?.ok) setConfirmOpen(false)
  }, [state])

  const selectedCharacter = active.find((c) => c.id === characterId)
  const hasRef = Boolean(selectedCharacter?.animeAnchorPath)
  // Hidden field records intent; server auto-switches to IP-Adapter when an anchor exists.
  const workflowId = hasRef
    ? "anime-txt2img-ipadapter"
    : (workflows[0]?.id ?? "anime-txt2img-stub")
  const selectedWorkflow = workflows.find((w) => w.id === workflows[0]?.id)
  const characterLabel = selectedCharacter
    ? `${selectedCharacter.name}${selectedCharacter.origin === "ip_reference" ? " · IP" : ""}`
    : "选择角色"
  const modeLabel = hasRef ? "IP-Adapter + 参考图" : "纯文字 txt2img"

  const userPrompt = buildUserPrompt(selectedCharacter?.tagline ?? "", extraPrompt)
  const positivePrompt = mergePrompts(
    selectedWorkflow?.basePrompt,
    userPrompt || "1girl",
  )
  const negativePrompt = mergePrompts(selectedWorkflow?.baseNegativePrompt, undefined)
  const seedSummary =
    seedKind === "fixed" ? `固定 seed ${seed || "0"}` : `随机 ×${count || "1"}`

  if (active.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>单张任务</CardTitle>
          <CardDescription>先在角色库创建角色，再回来提交生成</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            单张任务
            <Badge variant="secondary" className="font-normal">
              v0.1
            </Badge>
          </CardTitle>
          <CardDescription>
            有 anime 基准时自动走 IP-Adapter 锁定外貌；无基准则纯文字生成
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
                <Select value={characterId} onValueChange={(v) => setCharacterId(v ?? "")}>
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
                  {hasRef
                    ? "已设置 anime 基准 · 生成时将使用 IP-Adapter"
                    : "尚未上传基准 · 请先到角色库上传参考图"}
                </FieldDescription>
              </Field>

              <input type="hidden" name="animeWorkflowId" value={workflowId} />

              <Field>
                <FieldLabel htmlFor="extraPrompt">额外提示词</FieldLabel>
                <Textarea
                  id="extraPrompt"
                  name="extraPrompt"
                  rows={3}
                  value={extraPrompt}
                  onChange={(e) => setExtraPrompt(e.target.value)}
                  placeholder="姿势、场景、服装…（叠加在角色设定之后）"
                />
              </Field>

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
                    <FieldLabel htmlFor="seed">Seed</FieldLabel>
                    <Input
                      id="seed"
                      name="seed"
                      type="number"
                      min={0}
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                    />
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="count">数量</FieldLabel>
                    <Input
                      id="count"
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
                <Sparkles data-icon="inline-start" />
              )}
              {pending ? "提交中…" : "提交单张任务"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>确认生成任务</DialogTitle>
            <DialogDescription>
              {characterLabel} · {modeLabel} · {seedSummary}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">参考图</span>
              {hasRef && selectedCharacter?.animeAnchorPath ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={contentUrl(selectedCharacter.animeAnchorPath)}
                    alt="参考"
                    className="size-16 rounded-md border object-cover"
                  />
                  <span className="font-mono text-xs text-muted-foreground break-all">
                    {selectedCharacter.animeAnchorPath}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">未设置参考图（仅文字 prompt）</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Positive</span>
              <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap break-words">
                {positivePrompt || "（空）"}
              </pre>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Negative</span>
              <pre className="max-h-28 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap break-words">
                {negativePrompt || "（空）"}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>
              返回修改
            </DialogClose>
            <Button type="submit" form={formId} disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              {pending ? "提交中…" : "确认提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
