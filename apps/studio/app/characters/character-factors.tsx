"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { FactorCategory } from "@icy/shared"

import { setCharacterFactorsAction } from "./actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"

export type FactorBindOption = {
  id: string
  category: FactorCategory
  name: string
  enabled: boolean
}

export function CharacterFactorsButton({
  characterId,
  factors,
  selectedIds,
}: {
  characterId: string
  factors: FactorBindOption[]
  selectedIds: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [ids, setIds] = useState(selectedIds)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  const enabled = useMemo(() => factors.filter((f) => f.enabled), [factors])

  const save = () => {
    startTransition(async () => {
      const res = await setCharacterFactorsAction(characterId, ids)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setIds(selectedIds)
          setError(null)
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        默认因子
        {selectedIds.length > 0 ? (
          <Badge variant="secondary" className="ml-1">
            {selectedIds.length}
          </Badge>
        ) : null}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>角色默认因子</DialogTitle>
          <DialogDescription>
            成对任务会自动合并这些启用因子（可再叠加任务内选择）
          </DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {enabled.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              暂无启用因子，请先在生成中心因子库导入
            </li>
          ) : (
            enabled.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={ids.includes(f.id)}
                  onCheckedChange={(v) => {
                    if (v === true) setIds([...ids, f.id])
                    else setIds(ids.filter((x) => x !== f.id))
                  }}
                />
                <span>
                  {f.name}
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                    {f.category}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button disabled={busy} onClick={save}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
