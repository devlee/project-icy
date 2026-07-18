import { AI_NOTICE, BRAND } from "@/lib/pack"

export default function AboutPage() {
  return (
    <main className="page">
      <h1>关于 {BRAND}</h1>
      <p className="lead">
        探索「次元破壁」：同一角色在二次元与真人形态下的成对对照叙事。
      </p>
      <div className="card">
        <h2>AI 生成声明</h2>
        <p>{AI_NOTICE}</p>
        <p style={{ marginTop: "0.75rem" }}>
          商用内容仅使用原创角色；定制业务仅处理客户授权的本人照片。
        </p>
      </div>
    </main>
  )
}
