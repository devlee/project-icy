"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, Pencil, Plus, Trash2 } from "lucide-react"
import type { FactorCategory } from "@icy/shared"
import { FACTOR_CATEGORIES } from "@icy/shared"

import {
  createFactorAction,
  deleteFactorAction,
  importFactorPresetsAction,
  setFactorEnabledAction,
  updateFactorAction,
  type ActionResult,
} from "./actions"
import { CATEGORY_LABEL, type FactorOption } from "./factor-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type FactorManagerItem = FactorOption & {
  negativeFragment: string
}

type EditorState = {
  id?: string
  category: FactorCategory
  name: string
  promptFragment: string
  negativeFragment: string
  enabled: boolean
}

const emptyEditor = (): EditorState => ({
  category: "scene",
  name: "",
  promptFragment: "",
  negativeFragment: "",
  enabled: true,
})

export function FactorManager({ factors }: { factors: FactorManagerItem[] }) {
  const router = useRouter()
  const [categoryFilter, setCategoryFilter] = useState<FactorCategory | "all">("all")
  const [search, setSearch] = useState("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>(emptyEditor)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  const [createState, createAction, creating] = useActionState(
    createFactorAction,
    null as ActionResult | null,
  )
  const [updateState, updateAction, updating] = useActionState(
    updateFactorAction,
    null as ActionResult | null,
  )

  const pending = creating || updating

  useEffect(() => {
    if (createState?.ok || updateState?.ok) {
      setEditorOpen(false)
      setEditor(emptyEditor())
      router.refresh()
    }
  }, [createState, updateState, router])

  const filtered = factors.filter((f) => {
    if (categoryFilter !== "all" && f.category !== categoryFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      f.name.toLowerCase().includes(q) ||
      f.promptFragment.toLowerCase().includes(q)
    )
  })

  const categoryItems = FACTOR_CATEGORIES.map((c) => ({
    label: CATEGORY_LABEL[c],
    value: c,
  }))

  const openCreate = () => {
    setEditor(emptyEditor())
    setEditorOpen(true)
  }

  const openEdit = (f: FactorManagerItem) => {
    setEditor({
      id: f.id,
      category: f.category,
      name: f.name,
      promptFragment: f.promptFragment,
      negativeFragment: f.negativeFragment,
      enabled: f.enabled,
    })
    setEditorOpen(true)
  }

  const importPresets = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await importFactorPresetsAction()
      setMessage(
        result.ok
          ? `预设导入完成：新增 ${result.inserted ?? 0}，跳过 ${result.skipped ?? 0}`
          : result.error,
      )
      if (result.ok) router.refresh()
    })
  }

  const toggleEnabled = (f: FactorManagerItem) => {
    setBusyId(f.id)
    setMessage(null)
    startTransition(async () => {
      const result = await setFactorEnabledAction(f.id, !f.enabled)
      setBusyId(null)
      setMessage(result.ok ? (f.enabled ? "已禁用" : "已启用") : result.error)
      if (result.ok) router.refresh()
    })
  }

  const remove = (f: FactorManagerItem) => {
    setBusyId(f.id)
    setMessage(null)
    startTransition(async () => {
      const result = await deleteFactorAction(f.id)
      setBusyId(null)
      setMessage(
        result.ok
          ? result.softDisabled
            ? `「${f.name}」已被系列引用，已软禁用`
            : `已删除「${f.name}」`
          : result.error,
      )
      if (result.ok) router.refresh()
    })
  }

  const formAction = editor.id ? updateAction : createAction
  const formError =
    editor.id && updateState && !updateState.ok
      ? updateState.error
      : !editor.id && createState && !createState.ok
        ? createState.error
        : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          因子库
          <Badge variant="secondary" className="font-normal">
            {factors.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          场景 / 服装 / 光影 / 风格等提示词片段；成对任务与批次系列从此选用
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            新建
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={importPresets}>
            {busy && !busyId ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            导入预设
          </Button>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索因子…"
          aria-label="搜索因子"
        />

        <ToggleGroup
          value={[categoryFilter]}
          onValueChange={(v) => {
            const next = v[0]
            if (next === "all" || (FACTOR_CATEGORIES as readonly string[]).includes(next)) {
              setCategoryFilter(next as FactorCategory | "all")
            }
          }}
          variant="outline"
          className="flex flex-wrap"
        >
          <ToggleGroupItem value="all">全部</ToggleGroupItem>
          {FACTOR_CATEGORIES.map((c) => (
            <ToggleGroupItem key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {factors.length === 0 ? "库为空，可导入预设快速起步。" : "无匹配因子"}
          </p>
        ) : (
          <ItemGroup>
            {filtered.map((f) => (
              <Item key={f.id} variant="muted" size="sm">
                <ItemContent>
                  <ItemTitle>
                    {f.name}
                    <Badge variant="outline" className="font-normal">
                      {CATEGORY_LABEL[f.category]}
                    </Badge>
                    <Badge variant={f.enabled ? "default" : "secondary"}>
                      {f.enabled ? "启用" : "禁用"}
                    </Badge>
                  </ItemTitle>
                  <ItemDescription className="line-clamp-2">
                    {f.promptFragment}
                    {f.negativeFragment ? ` · neg: ${f.negativeFragment}` : ""}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || busyId === f.id}
                    onClick={() => openEdit(f)}
                  >
                    <Pencil data-icon="inline-start" />
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || busyId === f.id}
                    onClick={() => toggleEnabled(f)}
                  >
                    {busyId === f.id ? <Spinner data-icon="inline-start" /> : null}
                    {f.enabled ? "禁用" : "启用"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || busyId === f.id}
                    onClick={() => remove(f)}
                  >
                    <Trash2 data-icon="inline-start" />
                    删除
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{editor.id ? "编辑因子" : "新建因子"}</DialogTitle>
            <DialogDescription>提示词片段会注入成对生成 workflow</DialogDescription>
          </DialogHeader>

          <form action={formAction} className="flex flex-col gap-4">
            {editor.id ? <input type="hidden" name="id" value={editor.id} /> : null}
            <input type="hidden" name="category" value={editor.category} />
            <input type="hidden" name="enabled" value={editor.enabled ? "1" : "0"} />

            <FieldGroup>
              <Field>
                <FieldLabel>分类</FieldLabel>
                <Select
                  items={categoryItems}
                  value={editor.category}
                  onValueChange={(v) => {
                    if (v && (FACTOR_CATEGORIES as readonly string[]).includes(v)) {
                      setEditor((prev) => ({ ...prev, category: v as FactorCategory }))
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{CATEGORY_LABEL[editor.category]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {FACTOR_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="factor-name">名称</FieldLabel>
                <Input
                  id="factor-name"
                  name="name"
                  required
                  value={editor.name}
                  onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="factor-prompt">提示词片段</FieldLabel>
                <Textarea
                  id="factor-prompt"
                  name="promptFragment"
                  required
                  rows={2}
                  value={editor.promptFragment}
                  onChange={(e) =>
                    setEditor((prev) => ({ ...prev, promptFragment: e.target.value }))
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="factor-neg">负面片段</FieldLabel>
                <Textarea
                  id="factor-neg"
                  name="negativeFragment"
                  rows={2}
                  value={editor.negativeFragment}
                  onChange={(e) =>
                    setEditor((prev) => ({ ...prev, negativeFragment: e.target.value }))
                  }
                  placeholder="可选"
                />
              </Field>

              {formError ? <FieldError>{formError}</FieldError> : null}
            </FieldGroup>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={pending} />}>
                取消
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
