"use client"

import { useActionState, useEffect, useState } from "react"
import { Plus } from "lucide-react"

import { createCharacterAction, type ActionResult } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const ORIGIN_ITEMS = [
  { label: "原创 OC", value: "original" },
  { label: "IP 参考（仅研究）", value: "ip_reference" },
]
const STATUS_ITEMS = [
  { label: "草稿", value: "draft" },
  { label: "养成中", value: "growing" },
  { label: "主推", value: "featured" },
]

export function CreateCharacterDialog({
  triggerClassName,
}: {
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState("draft")
  const [origin, setOrigin] = useState("original")
  const [state, action, pending] = useActionState(
    createCharacterAction,
    null as ActionResult | null,
  )

  useEffect(() => {
    if (state?.ok) {
      setOpen(false)
      setStatus("draft")
      setOrigin("original")
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className={triggerClassName} />}>
        <Plus data-icon="inline-start" />
        新建角色
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建角色</DialogTitle>
          <DialogDescription>
            原创可进商用流水线；IP 参考仅用于研究，禁止发布
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={state && !state.ok ? true : undefined}>
              <FieldLabel htmlFor="name">名称</FieldLabel>
              <Input id="name" name="name" required placeholder="凛冬 Rin" autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="slug">Slug</FieldLabel>
              <Input id="slug" name="slug" placeholder="留空则自动生成" />
              <FieldDescription>门户与 URL 用，英文小写 + 连字符</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>来源</FieldLabel>
              <input type="hidden" name="origin" value={origin} />
              <Select items={ORIGIN_ITEMS} value={origin} onValueChange={(v) => setOrigin(v ?? "original")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="original">原创 OC</SelectItem>
                    <SelectItem value="ip_reference">IP 参考（仅研究）</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {origin === "ip_reference" ? (
              <Field>
                <FieldLabel htmlFor="ipSource">所属作品 / IP</FieldLabel>
                <Input
                  id="ipSource"
                  name="ipSource"
                  required
                  placeholder="如：原神、鬼灭之刃"
                />
                <FieldDescription>记录来自哪个 IP，便于日后对照研究</FieldDescription>
              </Field>
            ) : (
              <input type="hidden" name="ipSource" value="" />
            )}
            <Field>
              <FieldLabel htmlFor="tagline">一句话</FieldLabel>
              <Input id="tagline" name="tagline" placeholder="冷感银发少女" />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile">设定</FieldLabel>
              <Textarea id="profile" name="profile" rows={3} placeholder="性格、背景故事…" />
            </Field>
            <Field>
              <FieldLabel>初始状态</FieldLabel>
              <input type="hidden" name="status" value={status} />
              <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v ?? "draft")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="growing">养成中</SelectItem>
                    <SelectItem value="featured">主推</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {state && !state.ok ? <FieldError>{state.error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
