import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

interface Props extends PropsWithChildren {
  className?: string;
}

export default function PageWrapper({ children, className }: Props) {
  return (
    <div className={cn("relative grow overflow-y-auto", className)}>
      {children}
    </div>
  );
}
