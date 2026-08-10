"use client";

import { Sidebar } from "@/components/sidebar";

export default function DriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar handles both modes: desktop inline aside (md+) and
          mobile floating hamburger + drawer — consistent across all pages */}
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
