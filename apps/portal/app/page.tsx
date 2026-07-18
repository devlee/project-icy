import Link from "next/link"
import { BRAND, loadPortalPack } from "@/lib/pack"

export default function HomePage() {
  const pack = loadPortalPack()
  const hero = pack.characters.find((c) => c.featured) ?? pack.characters[0]
  return (
    <main className="hero">
      <h1>{BRAND}</h1>
      <p>
        二次元与真人形态成对对照。内容由 Studio 半自动发布驱动
        {hero ? ` · 主推 ${hero.name}` : ""}。
      </p>
      <Link className="cta" href="/gallery/">
        进入画廊
      </Link>
    </main>
  )
}
