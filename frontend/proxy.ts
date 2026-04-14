import { NextRequest, NextResponse } from "next/server";

import { matchesProtectedPrefix, protectedPrefixes } from "@/lib/protected-routes";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const guestOnlyRoutes = new Set(["/login", "/register"]);
const authCookieNames = ["laravel-session", "XSRF-TOKEN"];

function hasCookies(request: NextRequest): boolean {
  const cookieHeader = request.headers.get("cookie");
  return typeof cookieHeader === "string" && cookieHeader.trim().length > 0;
}

function isProtectedPath(pathname: string): boolean {
  return matchesProtectedPrefix(pathname, protectedPrefixes);
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const authUrl = `${API_BASE_URL}/api/me`;

  try {
    const response = await fetch(authUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Cookie: request.headers.get("cookie") ?? "",
        Origin: APP_URL,
        Referer: `${APP_URL}/`,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

function createLoginRedirect(request: NextRequest, pathname: string, search: string) {
  const loginUrl = new URL("/login", request.url);
  const redirectTarget = `${pathname}${search}`;

  if (redirectTarget !== "/login") {
    loginUrl.searchParams.set("redirect", redirectTarget);
  }

  const response = NextResponse.redirect(loginUrl);

  for (const cookieName of authCookieNames) {
    response.cookies.set(cookieName, "", {
      expires: new Date(0),
      maxAge: 0,
      path: "/",
    });
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtectedRoute = isProtectedPath(pathname);
  const isGuestOnlyRoute = guestOnlyRoutes.has(pathname);

  if (!isProtectedRoute && !isGuestOnlyRoute) {
    return NextResponse.next();
  }

  if (!hasCookies(request)) {
    if (isProtectedRoute) {
      return createLoginRedirect(request, pathname, search);
    }

    return NextResponse.next();
  }

  const authenticated = await isAuthenticated(request);

  if (isProtectedRoute && !authenticated) {
    return createLoginRedirect(request, pathname, search);
  }

  if (isGuestOnlyRoute && authenticated) {
    return NextResponse.redirect(new URL("/messages", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/messages/:path*",
    "/settings/:path*",
    "/dashboard/:path*",
    "/ops/:path*",
    "/storage/:path*",
    "/users/:path*",
    "/roles/:path*",
    "/permissions/:path*",
  ],
};
