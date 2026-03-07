"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

import {
  Moon,
  Sun,
  Thermometer,
  LogOut,
  LayoutDashboard,
  Camera,
  GitCompare,
  Bell,
  Settings
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTempUnit } from "@/contexts/temp-unit-context";
import { useUserRole, isWriteRole } from "@/hooks/use-user-role";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cameras", label: "Cameras", icon: Camera },
  { href: "/comparison", label: "Comparison", icon: GitCompare },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings, writeOnly: true },
];

export function Header() {

  const { unit, toggleUnit } = useTempUnit();
  const { theme, setTheme } = useTheme();

  const router = useRouter();
  const pathname = usePathname();

  const role = useUserRole();
  const canWrite = isWriteRole(role);

  const [mounted,setMounted] = useState(false);
  const [username,setUsername] = useState("");

  useEffect(()=>{

    setMounted(true);

    const user = localStorage.getItem("user");

    if(user){
      const parsed = JSON.parse(user);
      setUsername(parsed.username);
    }

  },[]);

  const handleLogout = async () => {
    localStorage.removeItem("user");
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  };

  const filteredLinks = NAV_LINKS.filter((link) => {
    if (link.writeOnly && !canWrite) return false;
    return true;
  });

  return (

    <header className="sticky top-0 z-40 border-b bg-background">

      <div className="flex h-14 items-center px-6 gap-6">

        {/* Logo */}
        <div className="flex items-center gap-2 font-semibold">
          <Thermometer className="size-5 text-primary"/>
          Thermal Monitor
        </div>

        {/* Menu */}
        <nav className="flex items-center gap-1">

          {filteredLinks.map(({href,label,icon:Icon})=>{

            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);

            return(

              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="size-4"/>
                {label}
              </Link>

            );

          })}

        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">

          {username && (
            <span className="text-sm text-muted-foreground">
              Hello <b>{username}</b>
            </span>
          )}

          {/* theme toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={()=>setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark"
                ? <Sun className="size-4"/>
                : <Moon className="size-4"/>
              }
            </Button>
          )}

          {/* temp unit */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleUnit}
            className="text-xs font-mono w-12"
          >
            °{unit}
          </Button>

          {/* logout */}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-1"
          >
            <LogOut className="size-4"/>
            Logout
          </Button>

        </div>

      </div>

    </header>

  );

}