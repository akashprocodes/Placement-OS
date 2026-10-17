import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const COOKIE_NAME = "access_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days — matches JWT_ACCESS_TOKEN_EXPIRE_MINUTES

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ detail: "Email and password are required" }, { status: 400 });
  }

  // 1. Call FastAPI Register Endpoint
  let registerRes: Response;
  try {
    registerRes = await fetch(`${BACKEND_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch {
    return NextResponse.json({ detail: "Could not reach authentication server" }, { status: 503 });
  }

  const registerData = await registerRes.json();

  if (!registerRes.ok) {
    // Return the FastAPI error (e.g. "Email already registered" -> 400)
    return NextResponse.json(registerData, { status: registerRes.status });
  }

  // 2. Call FastAPI Login Endpoint to get the access token
  let loginRes: Response;
  try {
    loginRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch {
    return NextResponse.json({ detail: "Registered successfully, but could not login automatically." }, { status: 503 });
  }

  const loginData = await loginRes.json();

  if (!loginRes.ok) {
    return NextResponse.json(loginData, { status: loginRes.status });
  }

  const accessToken: string = loginData.access_token;
  if (!accessToken) {
    return NextResponse.json({ detail: "No token received after registration" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, user: registerData }, { status: 200 });

  // 3. Set HttpOnly Cookie
  response.cookies.set(COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
