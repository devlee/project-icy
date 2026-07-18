"use client"

import type { CharacterStatus } from "@icy/shared"
import { updateCharacterStatusAction } from "./actions"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const LABELS: Record<CharacterStatus, string> = {
  draft: "草稿",
  growing: "养成中",
  featured: "主推",
  archived: "封存",
}

const STATUS_ITEMS = (Object.keys(LABELS) as CharacterStatus[]).map((status) => ({
  label: LABELS[status],
  value: status,
}))

export function CharacterStatusSelect({
  id,
  status,
}: {
  id: string
  status: CharacterStatus
}) {
  return (
    <Select
      items={STATUS_ITEMS}
      value={status}
      onValueChange={(value) => {
        if (!value) return
        void updateCharacterStatusAction(id, value as CharacterStatus)
      }}
    >
      <SelectTrigger size="sm" className="w-[7.5rem]">
        <SelectValue>{LABELS[status]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {(Object.keys(LABELS) as CharacterStatus[]).map((s) => (
            <SelectItem key={s} value={s}>
              {LABELS[s]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
