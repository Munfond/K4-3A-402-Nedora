"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";

export function NavUser() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm">
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate font-medium">Đội sản xuất</span>
            <span className="truncate text-muted-foreground text-xs">
              Bản mock · không đăng nhập
            </span>
          </div>
          <ThemeToggle />
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
