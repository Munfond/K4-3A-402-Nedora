import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VercelToolbar } from "@vercel/toolbar/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import { cn } from "@/lib/utils";

import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CLIENT_ENV } from "@/lib/env.client";
import { appUrl } from "@feedback/config/url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | FeedbackRadar",
    default: "FeedbackRadar",
  },
  description:
    "Biến góp ý của người học thành kế hoạch sửa video cho phiên bản sau",
  metadataBase: new URL(appUrl),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      {process.env.NODE_ENV === "development" && (
        <head>
          <script src="https://unpkg.com/react-scan/dist/auto.global.js" />
        </head>
      )}
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "bg-sidebar text-foreground antialiased",
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <NuqsAdapter>
            <SWRConfig
              value={{
                // Optimized for instant navigation
                dedupingInterval: 300000, // 5 minutes
                revalidateOnFocus: false, // Don't refetch when tabbing back
                revalidateOnReconnect: true,
                revalidateIfStale: false, // Use cached data for instant loading
                errorRetryCount: 3,
                errorRetryInterval: 1000,
                // Use stale data while revalidating for instant perceived performance
                keepPreviousData: true,
                // Enable background updates
                refreshInterval: 0, // Disable automatic refresh
              }}
            >
              {children}
              <Toaster />
            </SWRConfig>
          </NuqsAdapter>
          <Analytics />
          <SpeedInsights />
          {process.env.NODE_ENV === "development" && <VercelToolbar />}
        </ThemeProvider>
      </body>
    </html>
  );
}
