"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";

export default function DriveLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 shadow-2xl">
            <Sidebar className="h-full" />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center gap-2 p-2 border-b border-border/50 bg-background/95 backdrop-blur">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold">TDrive</span>
        </div>
        {children}
      </main>
    </div>
  );
}
