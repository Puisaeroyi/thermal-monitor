import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { username, newPassword } = await req.json();

    const res = await fetch(
      `http://localhost:4000/users?username=${username}`
    );

    const users = await res.json();

    if (!users.length) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const user = users[0];

    await fetch(`http://localhost:4000/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: newPassword,
        firstLogin: false
      })
    });

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}