import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const COOKIE_NAME = "access_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days — matches JWT_ACCESS_TOKEN_EXPIRE_MINUTES

export async function POST(request: NextRequest) {
  let body: { email: string; password: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch {
    return NextResponse.json({ detail: "Could not reach authentication server" }, { status: 503 });
  }

  const data = await backendRes.json();

  if (!backendRes.ok) {
    return NextResponse.json(data, { status: backendRes.status });
  }

  const accessToken: string = data.access_token;
  if (!accessToken) {
    return NextResponse.json({ detail: "No token received" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });

  response.cookies.set(COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

