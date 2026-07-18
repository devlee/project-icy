import { loadPortalPack } from "@/lib/pack"

export default function GalleryPage() {
  const pack = loadPortalPack()
  return (
    <main className="page">
      <h1>画廊</h1>
      <p className="lead">公开双形态对照作品。</p>
      {pack.galleryItems.length === 0 ? (
        <p className="lead">暂无作品。Studio 导出门户包后重新构建本站。</p>
      ) : (
        <div className="grid">
          {pack.galleryItems.map((item) => (
            <article key={item.id} className="card">
              <h2>{item.title}</h2>
              <p>{item.characterSlug}</p>
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
