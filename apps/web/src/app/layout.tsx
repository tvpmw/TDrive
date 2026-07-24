import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/query-provider";
import { UploadProvider } from "@/components/upload-manager";
import "./globals.css";

export const metadata: Metadata = {
  title: "TDrive - High-Speed Telegram Cloud Storage",
  description: "Unlimited Telegram-powered cloud storage with Next.js & Hono",
};

import { CommandPalette } from "@/components/command-palette";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <UploadProvider>
            {children}
            <CommandPalette />
          </UploadProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
