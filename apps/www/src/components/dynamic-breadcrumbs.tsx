"use client";

import type { Route } from "next";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { Fragment } from "react/jsx-runtime";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const goc: Record<string, { label: string; href: Route }> = {
  "van-de": { label: "Vấn đề", href: "/van-de" },
  "gop-y": { label: "Góp ý gốc", href: "/gop-y" },
  xuat: { label: "Xuất kịch bản", href: "/xuat" },
};

export function DynamicBreadcrumbs() {
  const segments = useSelectedLayoutSegments();
  const [root, child] = [segments?.[0] ?? null, segments?.[1] ?? null];

  const items: Array<{ label: string; href?: Route }> = [];

  if (root && goc[root]) {
    items.push(goc[root]);
    if (child) {
      items.push({
        label: child === "gan-co" ? "Gắn cờ" : child.toUpperCase(),
      });
    }
  } else {
    items.push({ label: "Tổng quan" });
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const key = `${item.label}-${idx}`;
          return (
            <Fragment key={key}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage className="truncate">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href} className="truncate">
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
