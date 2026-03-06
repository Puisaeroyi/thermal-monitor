import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {

  const token = req.cookies.get("auth");
  const role = req.cookies.get("role");

  const pathname = req.nextUrl.pathname;

  const publicRoutes = ["/login", "/change-password"];

  if (!token && !publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // role restriction
  if (role?.value === "viewer") {
    if (
      pathname.startsWith("/settings") ||
      pathname.startsWith("/cameras")
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/cameras/:path*",
    "/alerts/:path*",
    "/comparison/:path*",
    "/settings/:path*"
  ]
};