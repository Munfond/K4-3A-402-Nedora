import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function NotFound() {
  return (
    <SidebarProvider>
      <Suspense fallback={<div className="w-64 bg-sidebar" />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
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
        <main className="flex flex-1 flex-col items-center justify-center">
          <div className="text-center">
            <h1 className="font-bold text-6xl text-zinc-800 dark:text-zinc-200">
              404
            </h1>
            <p className="mt-4 font-mono text-zinc-600 dark:text-zinc-400">
              không tìm thấy trang
            </p>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
