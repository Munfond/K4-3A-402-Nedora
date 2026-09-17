"use client";

import {
  FileDown,
  Flag,
  GalleryVerticalEnd,
  MessagesSquare,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navLinks: Array<{
  name: string;
  url: Route;
  icon: typeof GalleryVerticalEnd;
}> = [
  { name: "Vấn đề", url: "/van-de", icon: GalleryVerticalEnd },
  { name: "Góp ý gốc", url: "/gop-y", icon: MessagesSquare },
  { name: "Góp ý gắn cờ", url: "/gop-y/gan-co", icon: Flag },
  { name: "Xuất kịch bản", url: "/xuat", icon: FileDown },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {navLinks.map((link) => (
          <SidebarMenuItem key={link.url}>
            <SidebarMenuButton asChild isActive={pathname === link.url}>
              <Link href={link.url}>
                <link.icon />
                <span>{link.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
