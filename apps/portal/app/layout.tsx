import type { ReactNode } from "react"
import Link from "next/link"
import { AI_NOTICE, BRAND } from "@/lib/pack"
import "./globals.css"

export const metadata = {
  title: BRAND,
  description: "双形态对照 · AI 生成声明",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            {BRAND}
          </Link>
          <nav>
            <Link href="/characters/">角色</Link>
            <Link href="/gallery/">画廊</Link>
            <Link href="/custom/">定制</Link>
            <Link href="/about/">关于</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>{AI_NOTICE}</p>
          <p className="muted">© {new Date().getFullYear()} {BRAND}</p>
        </footer>
      </body>
    </html>
  )
}
