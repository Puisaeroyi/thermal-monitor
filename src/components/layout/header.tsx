"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { useTempUnit } from "@/contexts/temp-unit-context";

/** App header with title, temperature unit toggle, and mobile sidebar trigger */
export function Header() {
  const { unit, toggleUnit } = useTempUnit();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background px-4 gap-3">
      {/* Mobile hamburger — only visible on small screens */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="size-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Thermometer className="size-5 text-primary" />
              Thermal Monitor
            </SheetTitle>
          </SheetHeader>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* App title */}
      <div className="flex items-center gap-2 flex-1">
        <Thermometer className="size-5 text-primary hidden md:block" />
        <span className="font-semibold text-sm">Thermal Monitor</span>
      </div>

      {/* Theme toggle */}
      {mounted && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      )}

      {/* Temperature unit toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleUnit}
        className="text-xs font-mono w-12"
        title="Toggle temperature unit"
      >
        °{unit}
      </Button>
    </header>
  );
}
