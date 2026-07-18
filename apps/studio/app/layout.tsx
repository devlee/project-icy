import type { Metadata } from "next";
import { getStudioOverview } from "@icy/core";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StudioSidebar } from "@/components/studio-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "project-icy Studio",
  description: "双形态内容创作工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const overview = getStudioOverview(getDb());

  return (
    <html
      lang="zh-CN"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider>
            <StudioSidebar />
            <SidebarInset>
              <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
                <SidebarTrigger />
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>队列 {overview.activeTaskCount} 项</span>
                  <span>今日已筛 {overview.todayReviewedCount} 组</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">内容库存</span>
                  <Badge>{overview.inventory.days} 天</Badge>
                  <Separator orientation="vertical" className="h-5" />
                  <ModeToggle />
                </div>
              </header>
              {children}
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
