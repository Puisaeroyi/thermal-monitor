import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      username: user.username,
      role: user.role,
      firstLogin: user.firstLogin,
    });

    response.cookies.set("auth", user.username, {
      httpOnly: true,
      path: "/",
    });

    response.cookies.set("role", user.role, {
      httpOnly: true,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
