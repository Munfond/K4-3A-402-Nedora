import type { ReactNode } from "react";
import { Suspense } from "react";
import { VideoHeader } from "@/components/studio/video-header";

export default function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased">
      <Suspense fallback={<div className="h-24 border-b bg-background" />}>
        <VideoHeader />
      </Suspense>
      <main className="flex-1 w-full overflow-x-hidden">{children}</main>
    </div>
  );
}
