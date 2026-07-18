import Link from "next/link"
import { loadPortalPack } from "@/lib/pack"

export default function CharactersPage() {
  const pack = loadPortalPack()
  return (
    <main className="page">
      <h1>角色</h1>
      <p className="lead">原创角色档案与双形态对照入口。</p>
      {pack.characters.length === 0 ? (
        <p className="lead">暂无角色。请在 Studio 排期页导出「发布到门户」。</p>
      ) : (
        <div className="grid">
          {pack.characters.map((c) => (
            <Link key={c.slug} href={`/characters/${c.slug}/`} className="card">
              <h2>{c.name}</h2>
              <p>{c.tagline || c.profile || c.slug}</p>
              {(c.heroPair.animeUrl || c.heroPair.realUrl) && (
                <div className="pair">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.heroPair.animeUrl || undefined} alt="" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.heroPair.realUrl || undefined} alt="" />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
