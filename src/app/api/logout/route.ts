import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear httpOnly auth cookies
  response.cookies.set("auth", "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set("role", "", { httpOnly: true, path: "/", maxAge: 0 });

  return response;
}
