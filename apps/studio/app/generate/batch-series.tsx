"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Play } from "lucide-react"
import {
  createSeriesAction,
  runBatchNowAction,
  setSeriesActiveAction,
  type ActionResult,
} from "./actions"
import { FactorPicker, type FactorOption } from "./factor-picker"
import { PosePoolPicker, type PoseOption } from "./pose-picker"
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
  Field,
  FieldDescription,
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

type CharacterOption = { id: string; name: string; status: string }
type SeriesView = {
  id: string
  name: string
  characterName: string
  scheduleCron: string | null
  active: boolean
  perBatch: number
  factorNames: string[]
  poseNames: string[]
}

export function BatchSeries({
  characters,
  series,
  factors,
  poses,
}: {
  characters: CharacterOption[]
  series: SeriesView[]
  factors: FactorOption[]
  poses: PoseOption[]
}) {
  const router = useRouter()
  const activeCharacters = characters.filter((character) => character.status !== "archived")
  const [characterId, setCharacterId] = useState(activeCharacters[0]?.id ?? "")
  const [factorIds, setFactorIds] = useState<string[]>([])
  const [poseIds, setPoseIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  const [state, action, creating] = useActionState(
    createSeriesAction,
    null as ActionResult | null,
  )
  const selectItems = activeCharacters.map((character) => ({
    label: character.name,
    value: character.id,
  }))

  useEffect(() => {
    if (!characterId && activeCharacters[0]) setCharacterId(activeCharacters[0].id)
  }, [activeCharacters, characterId])

  useEffect(() => {
    if (state?.ok) {
      setFactorIds([])
      setPoseIds([])
      router.refresh()
    }
  }, [router, state])

  const runNow = (id: string) => {
    setMessage(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await runBatchNowAction(id)
      setBusyId(null)
      setMessage(result.ok ? "批次已进入 worker 队列" : result.error)
      if (result.ok) router.refresh()
    })
  }

  const toggleActive = (row: SeriesView) => {
    setMessage(null)
    setBusyId(row.id)
    startTransition(async () => {
      const result = await setSeriesActiveAction(row.id, !row.active)
      setBusyId(null)
      setMessage(result.ok ? (row.active ? "系列已停用" : "系列已启用") : result.error)
      if (result.ok) router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          批次系列
          <Badge variant="outline" className="font-normal">
            worker + cron
          </Badge>
        </CardTitle>
        <CardDescription>低优先级定时生成；交互式任务会优先执行</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {activeCharacters.length > 0 ? (
          <form action={action}>
            <input type="hidden" name="characterId" value={characterId} />
            <FieldGroup>
              <Field>
                <FieldLabel>角色</FieldLabel>
                <Select
                  items={selectItems}
                  value={characterId}
                  onValueChange={(value) => setCharacterId(value ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {activeCharacters.map((character) => (
                        <SelectItem key={character.id} value={character.id}>
                          {character.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="responsive">
                <Field>
                  <FieldLabel htmlFor="series-name">系列名称</FieldLabel>
                  <Input id="series-name" name="name" required placeholder="夏日系列" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="series-count">每批组数</FieldLabel>
                  <Input id="series-count" name="perBatch" type="number" min={1} max={24} defaultValue={4} />
                </Field>
              </Field>
              <Field>
                <FieldLabel htmlFor="series-theme">主题提示词</FieldLabel>
                <Input id="series-theme" name="theme" placeholder="summer festival, yukata" />
              </Field>
              <FactorPicker
                factors={factors}
                selectedIds={factorIds}
                onChange={setFactorIds}
                label="因子池"
                description="批次任务会携带池中全部因子（禁用项不可选）"
              />
              <PosePoolPicker poses={poses} selectedIds={poseIds} onChange={setPoseIds} />
              <Field>
                <FieldLabel htmlFor="series-cron">Cron</FieldLabel>
                <Input id="series-cron" name="scheduleCron" defaultValue="0 4 * * *" className="font-mono" />
                <FieldDescription>按本机时区执行；留空则仅支持手动运行</FieldDescription>
              </Field>
              {state && !state.ok ? <FieldError>{state.error}</FieldError> : null}
              <Button type="submit" disabled={creating || !characterId}>
                {creating ? <Spinner data-icon="inline-start" /> : <CalendarClock data-icon="inline-start" />}
                创建系列
              </Button>
            </FieldGroup>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">先创建一个可用角色，再配置批次。</p>
        )}

        {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}

        {series.length > 0 ? (
          <ItemGroup>
            {series.map((row) => (
              <Item key={row.id} variant="muted" size="sm">
                <ItemContent>
                  <ItemTitle>
                    {row.name}
                    <Badge variant={row.active ? "default" : "outline"}>
                      {row.active ? "启用" : "停用"}
                    </Badge>
                  </ItemTitle>
                  <ItemDescription>
                    {row.characterName} · 每批 {row.perBatch} 组 · {row.scheduleCron ?? "手动"}
                    {row.factorNames.length > 0
                      ? ` · 因子 ${row.factorNames.join(" · ")}`
                      : " · 无因子池"}
                    {row.poseNames.length > 0
                      ? ` · 姿势 ${row.poseNames.join(" · ")}`
                      : ""}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || busyId === row.id || !row.active}
                    onClick={() => runNow(row.id)}
                  >
                    {busyId === row.id ? <Spinner data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                    立即运行
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || busyId === row.id}
                    onClick={() => toggleActive(row)}
                  >
                    {row.active ? "停用" : "启用"}
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : null}
      </CardContent>
    </Card>
  )
}
