import { notFound } from "next/navigation"
import { loadPortalPack } from "@/lib/pack"

export function generateStaticParams() {
  return loadPortalPack().characters.map((c) => ({ slug: c.slug }))
}

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const pack = loadPortalPack()
  const character = pack.characters.find((c) => c.slug === slug)
  if (!character) notFound()
  const items = pack.galleryItems.filter((g) => g.characterSlug === slug)

  return (
    <main className="page">
      <h1>{character.name}</h1>
      <p className="lead">{character.tagline || character.profile}</p>
      {(character.heroPair.animeUrl || character.heroPair.realUrl) && (
        <div className="pair" style={{ maxWidth: 640, marginBottom: "2rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={character.heroPair.animeUrl || undefined} alt="anime" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={character.heroPair.realUrl || undefined} alt="real" />
        </div>
      )}
      <h2 style={{ fontFamily: "var(--font)" }}>作品</h2>
      {items.length === 0 ? (
        <p className="lead">暂无画廊条目</p>
      ) : (
        <div className="grid">
          {items.map((item) => (
            <article key={item.id} className="card">
              <h2>{item.title}</h2>
              <div className="pair">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.pair.animeUrl} alt="" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.pair.realUrl} alt="" />
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
