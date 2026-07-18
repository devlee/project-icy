"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  CalendarDays,
  Gauge,
  ImageUp,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const pipeline = [
  { title: "角色库", href: "/characters", icon: Users },
  { title: "生成中心", href: "/generate", icon: Sparkles },
  { title: "筛选", href: "/review", icon: ListChecks },
  { title: "后期", href: "/post", icon: ImageUp },
  { title: "排期", href: "/schedule", icon: CalendarDays },
]

type ComfyHealth = {
  ok: boolean
  detail?: string
  url?: string
  backend?: "local" | "cloud"
  hasApiKey?: boolean
}

export function StudioSidebar() {
  const pathname = usePathname()
  const [comfy, setComfy] = useState<ComfyHealth | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch("/api/comfyui/health")
        const data = (await res.json()) as ComfyHealth
        if (!cancelled) setComfy(data)
      } catch {
        if (!cancelled) setComfy({ ok: false, detail: "unreachable" })
      }
    }
    void tick()
    const id = setInterval(() => void tick(), 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-semibold tracking-tight">project-icy</span>
          <span className="text-xs text-muted-foreground">Studio</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === "/"} render={<Link href="/" />}>
                  <Gauge />
                  <span>仪表盘</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>创作流水线</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pipeline.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-3">
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={
                comfy?.ok
                  ? "size-1.5 rounded-full bg-emerald-500"
                  : comfy == null
                    ? "size-1.5 rounded-full bg-muted-foreground/40"
                    : "size-1.5 rounded-full bg-destructive"
              }
            />
            {comfy == null
              ? "ComfyUI 检测中…"
              : comfy.ok
                ? "ComfyUI 已连接"
                : "ComfyUI 未连接"}
          </span>
          <span className="truncate" title={comfy?.url}>
            {comfy?.ok
              ? (comfy.detail ?? "ready")
              : (comfy?.detail ??
                (comfy?.backend === "cloud" || !comfy?.hasApiKey
                  ? "设置 COMFY_CLOUD_API_KEY"
                  : "检查 COMFYUI_URL"))}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
