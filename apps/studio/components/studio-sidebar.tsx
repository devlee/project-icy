"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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

export function StudioSidebar() {
  const pathname = usePathname()

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
            <span className="size-1.5 rounded-full bg-primary" />
            ComfyUI 已连接
          </span>
          <span>RTX 4090 · 队列 3</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
