import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    new URL(req.url).origin;
  const response = NextResponse.redirect(new URL("/", baseUrl));
  response.cookies.set("bar_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
  return response;
}
