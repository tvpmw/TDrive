import type { Metadata, Viewport } from "next";
import { QueryProvider } from "@/components/providers/query-provider";
import { UploadProvider } from "@/components/upload-manager";
import { ThemeProvider, ThemeInitScript } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-setup";
import "./globals.css";

export const metadata: Metadata = {
  title: "TDrive - High-Speed Telegram Cloud Storage",
  description: "Unlimited Telegram-powered cloud storage with Next.js & Hono",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TDrive" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

import { CommandPalette } from "@/components/command-palette";
import { RealtimeActivity } from "@/components/realtime-activity";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <ThemeProvider>
          <QueryProvider>
            <UploadProvider>
              {children}
              <CommandPalette />
              <RealtimeActivity />
              <PwaRegister />
            </UploadProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
