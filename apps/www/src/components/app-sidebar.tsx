import Link from "next/link";
import type { ComponentProps } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getKichBan } from "@/lib/mock-data";

import NavLinks from "./nav-links";
import { NavUser } from "./nav-user";

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const kichBan = getKichBan();

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-black text-white dark:bg-neutral-100 dark:text-black">
                  ◎
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium font-mono">
                    FeedbackRadar
                  </span>
                  <span className="truncate text-muted-foreground text-xs">
                    Video {kichBan.id.toUpperCase()}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavLinks />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
