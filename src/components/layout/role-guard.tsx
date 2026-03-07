"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserRole, isWriteRole } from "@/hooks/use-user-role";

/** Routes that require write role (admin/manager). Operator cannot access these. */
const RESTRICTED_ROUTES = ["/settings", "/api-tester"];

/** Redirects operator users away from restricted pages. */
export function RoleGuard({ children }: { children: React.ReactNode }) {
  const role = useUserRole();
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    if (!role) return; // role not loaded yet

    const isRestricted = RESTRICTED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );

    if (isRestricted && !isWriteRole(role)) {
      router.replace("/");
      setAllowed(false);
    } else {
      setAllowed(true);
    }
  }, [role, pathname, router]);

  if (!allowed) return null;

  return <>{children}</>;
}
