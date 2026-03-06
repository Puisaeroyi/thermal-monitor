import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { username, password } = await req.json();

  const res = await fetch(
    `http://localhost:4000/users?username=${username}`
  );

  const users = await res.json();

  if (!users.length) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const user = users[0];

  if (user.password !== password) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    success: true,
    username: user.username,
    role: user.role,
    firstLogin: user.firstLogin
  });

  response.cookies.set("auth", user.username, {
    httpOnly: true,
    path: "/"
  });

  response.cookies.set("role", user.role, {
    httpOnly: true,
    path: "/"
  });

  return response;
}