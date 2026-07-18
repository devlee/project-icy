import { UserRound } from "lucide-react"
import { listCharacterFactorIds, listCharacters, listFactors } from "@icy/core"

export const dynamic = "force-dynamic"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getDb } from "@/lib/db"
import { CreateCharacterDialog } from "./create-character-dialog"
import { CharactersGallery } from "./characters-gallery"

export default function CharactersPage() {
  const db = getDb()
  const characters = listCharacters(db)
  const factors = listFactors(db, { enabled: true }).map((f) => ({
    id: f.id,
    category: f.category,
    name: f.name,
    enabled: f.enabled,
  }))
  const factorIdsByCharacter = Object.fromEntries(
    characters.map((c) => [c.id, listCharacterFactorIds(db, c.id)]),
  )
  const featured = characters.filter((c) => c.status === "featured").length
  const active = characters.filter((c) => c.status !== "archived")
  const originals = characters.filter((c) => c.origin === "original").length

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">角色库</h1>
        <span className="text-sm text-muted-foreground">
          {active.length} 个角色
          {originals > 0 ? ` · ${originals} 原创` : null}
          {featured > 0 ? ` · ${featured} 主推` : null}
        </span>
        <CreateCharacterDialog triggerClassName="ml-auto" />
      </div>

      {characters.length === 0 ? (
        <Empty className="flex-1 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>还没有角色</EmptyTitle>
            <EmptyDescription>
              先建 3–5 个原创角色档案；IP 参考可另建，仅供研究
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CreateCharacterDialog />
          </EmptyContent>
        </Empty>
      ) : (
        <CharactersGallery
          characters={characters}
          factors={factors}
          factorIdsByCharacter={factorIdsByCharacter}
        />
      )}
    </main>
  )
}
