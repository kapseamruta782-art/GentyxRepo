// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("clienthub_token")?.value;
  const role = req.cookies.get("clienthub_role")?.value;
  const issuedAt = req.cookies.get("clienthub_issuedAt")?.value;

  const now = Date.now();
  const MAX_AGE = 60 * 60 * 2 * 1000; // 🔥 2 hours

  const pathname = req.nextUrl.pathname;

  // Public routes allowed without login
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  // 🔥 SESSION EXPIRED?
  if (issuedAt && now - Number(issuedAt) > MAX_AGE) {
    const res = NextResponse.redirect(new URL("/login", req.url));

    res.cookies.set("clienthub_token", "", { expires: new Date(0), path: "/" });
    res.cookies.set("clienthub_role", "", { expires: new Date(0), path: "/" });
    res.cookies.set("clienthub_issuedAt", "", { expires: new Date(0), path: "/" });

    console.log("SESSION EXPIRED — REDIRECT to /login");
    return res;
  }

  // Block access if not logged in
  if (!token || !role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Role-based protection
  const roleRoutes: Record<string, string> = {
    ADMIN: "/admin",
    CLIENT: "/client",
    SERVICE_CENTER: "/service-center",
    CPA: "/cpa",
  };

  const baseRoute = "/" + pathname.split("/")[1];
  const currentRole = role ? role.toUpperCase() : "";
  const targetRoute = roleRoutes[currentRole];

  if (!targetRoute) {
    // If role is invalid or not found in map, force back to login
    // This prevents the /undefined 404 error
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (baseRoute !== targetRoute) {
    return NextResponse.redirect(new URL(targetRoute, req.url));
  }

  return NextResponse.next();
}

// 🔥 KEEP YOUR OLD MATCHER → This ensures DB and API do NOT break
export const config = {
  matcher: [
    "/admin/:path*",
    "/client/:path*",
    "/service-center/:path*",
    "/cpa/:path*",
  ],
};
