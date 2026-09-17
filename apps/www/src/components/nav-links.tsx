"use client";

import {
  FileDown,
  Flag,
  GalleryVerticalEnd,
  History,
  Home,
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
  { name: "Tổng quan", url: "/", icon: Home },
  { name: "Vấn đề", url: "/van-de", icon: GalleryVerticalEnd },
  { name: "Góp ý gốc", url: "/gop-y", icon: MessagesSquare },
  { name: "Góp ý gắn cờ", url: "/gop-y/gan-co", icon: Flag },
  { name: "Xuất kịch bản", url: "/xuat", icon: FileDown },
  { name: "Lịch sử chạy", url: "/lich-su" as Route, icon: History },
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
                <link.icon className="size-4" />
                <span>{link.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
