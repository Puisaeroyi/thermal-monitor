"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Camera,
  GitCompare,
  Bell,
  Settings,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cameras", label: "Cameras", icon: Camera },
  { href: "/comparison", label: "Comparison", icon: GitCompare },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/api-tester", label: "API Tester", icon: FlaskConical },
];

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {

  const pathname = usePathname();
  const [role,setRole] = useState("");

  useEffect(()=>{

    const user = localStorage.getItem("user");

    if(user){
      const parsed = JSON.parse(user);
      setRole(parsed.role);
    }

  },[]);

  // filter menu theo role
  const filteredLinks = NAV_LINKS.filter((link)=>{

    if(role === "operator"){
      return (
        link.href === "/dashboard" ||
        link.href === "/cameras" ||
        link.href === "/alerts"
      );
    }

    return true; // manager & admin full access
  });

  return (
    <nav className="flex flex-col gap-1 p-3">

      {filteredLinks.map(({ href, label, icon: Icon }) => {

        const isActive =
          pathname === href || pathname.startsWith(href + "/");

        return (

          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}

          </Link>

        );

      })}

    </nav>
  );
}