"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  open?: boolean;
  className?: string;
  description?: string;
  showBackButton?: boolean;
  children: React.ReactNode | ((closeSheet: () => void) => React.ReactNode);
  headerAccessory?:
    | React.ReactNode
    | ((closeSheet: () => void) => React.ReactNode);
  eyebrowAccessory?:
    | React.ReactNode
    | ((closeSheet: () => void) => React.ReactNode);
  footer?: React.ReactNode | ((closeSheet: () => void) => React.ReactNode);
  side?: "right" | "left" | "top" | "bottom";
  onClose?: () => void;
}

export function CustomSheet({
  title,
  description,
  children,
  side = "right",
  showBackButton = true,
  open: initialOpen = true,
  headerAccessory,
  eyebrowAccessory,
  footer,
  className,
  onClose,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);

  const closeSheet = () => setOpen(false);

  useEffect(() => {
    if (!open) {
      if (onClose) {
        // If onClose is provided, call it with a delay to allow animation to complete
        const timer = setTimeout(() => {
          onClose();
        }, 300); // Match the sheet's animation duration
        return () => clearTimeout(timer);
      } else {
        // Default behavior: navigate back with delay
        const timer = setTimeout(() => {
          router.back();
        }, 300); // Match the sheet's animation duration
        return () => clearTimeout(timer);
      }
    }
  }, [open, router, onClose]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className={cn("sm:max-w-xl", className)}
      >
        <SheetHeader className="border-b border-b-neutral-100">
          <div className="flex items-center justify-between">
            {showBackButton && (
              <button
                type="button"
                onClick={closeSheet}
                className="flex max-w-max cursor-pointer items-center gap-1.5 rounded py-1 pr-2 pl-0 text-muted-foreground transition-all hover:bg-neutral-50 hover:pl-2"
              >
                <ArrowLeft className="size-4" />
                <span className="font-medium text-xs">Back</span>
              </button>
            )}
            {eyebrowAccessory &&
              (typeof eyebrowAccessory === "function"
                ? eyebrowAccessory(closeSheet)
                : eyebrowAccessory)}
          </div>
          <SheetTitle>{title} </SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
          {headerAccessory &&
            (typeof headerAccessory === "function"
              ? headerAccessory(closeSheet)
              : headerAccessory)}
        </SheetHeader>
        {typeof children === "function" ? children(closeSheet) : children}
        {footer && (
          <SheetFooter className="sticky right-0 bottom-0 left-0">
            {typeof footer === "function" ? footer(closeSheet) : footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
