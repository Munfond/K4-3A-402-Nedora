import type { ReactNode } from "react";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <SidebarProvider>
      <Suspense fallback={<div className="min-w-64 bg-sidebar" />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-6 rounded-t-xl bg-background">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Suspense fallback={<div>Tổng quan</div>}>
              <DynamicBreadcrumbs />
            </Suspense>
          </div>
        </header>
        <main className="relative flex flex-1 flex-col overflow-hidden rounded-b-xl">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
