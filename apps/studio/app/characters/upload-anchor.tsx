"use client"

import { useRef, useState, useTransition } from "react"
import { ImageUp } from "lucide-react"
import type { Form } from "@icy/shared"

import { uploadCharacterAnchorAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function UploadAnchor({
  characterId,
  form,
}: {
  characterId: string
  form: Form
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const label = form === "anime" ? "anime" : "real"

  const onPick = () => inputRef.current?.click()

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const fd = new FormData()
    fd.set("file", file)
    fd.set("form", form)
    setError(null)
    startTransition(async () => {
      const result = await uploadCharacterAnchorAction(characterId, fd)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={onPick}
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <ImageUp data-icon="inline-start" />
        )}
        {pending ? "上传中…" : `上传 ${label} 基准`}
      </Button>
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
    </div>
  )
}
