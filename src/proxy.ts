import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("auth");
  const role = req.cookies.get("role");
  const pathname = req.nextUrl.pathname;

  const publicRoutes = ["/login", "/change-password"];

  // Redirect unauthenticated users to login
  if (!token && !publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Operator role restrictions — no access to settings or api-tester
  if (role?.value === "operator") {
    if (
      pathname.startsWith("/settings") ||
      pathname.startsWith("/api-tester")
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/cameras/:path*",
    "/alerts/:path*",
    "/comparison/:path*",
    "/settings/:path*",
    "/api-tester/:path*",
    "/groups/:path*",
  ],
};
