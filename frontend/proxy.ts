import { NextRequest, NextResponse } from "next/server";

import { matchesProtectedPrefix, protectedPrefixes } from "@/lib/protected-routes";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const guestOnlyRoutes = new Set(["/", "/login", "/register"]);
const authCookieNames = ["laravel-session", "XSRF-TOKEN"];

type ProxyAuthState = {
  authenticated: boolean;
  mustVerifyEmail: boolean;
};

type ProxyCompanySettingsState = {
  registrationEnabled: boolean;
};

function hasCookies(request: NextRequest): boolean {
  const cookieHeader = request.headers.get("cookie");
  return typeof cookieHeader === "string" && cookieHeader.trim().length > 0;
}

function isProtectedPath(pathname: string): boolean {
  return matchesProtectedPrefix(pathname, protectedPrefixes);
}

async function resolveAuthState(request: NextRequest): Promise<ProxyAuthState> {
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

    if (!response.ok) {
      return {
        authenticated: false,
        mustVerifyEmail: false,
      };
    }

    const payload = await response.json();

    return {
      authenticated: true,
      mustVerifyEmail: Boolean(payload?.data?.must_verify_email),
    };
  } catch {
    return {
      authenticated: false,
      mustVerifyEmail: false,
    };
  }
}

async function resolvePublicCompanySettingsState(request: NextRequest): Promise<ProxyCompanySettingsState> {
  const settingsUrl = `${API_BASE_URL}/api/public/company-settings`;

  try {
    const response = await fetch(settingsUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Origin: APP_URL,
        Referer: `${APP_URL}/`,
        "X-Requested-With": "XMLHttpRequest",
        Cookie: request.headers.get("cookie") ?? "",
      },
    });

    if (!response.ok) {
      return {
        registrationEnabled: false,
      };
    }

    const payload = await response.json();

    return {
      registrationEnabled: Boolean(payload?.data?.is_registration_enable),
    };
  } catch {
    return {
      registrationEnabled: false,
    };
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

function createEmailVerificationRedirect(request: NextRequest, pathname: string, search: string) {
  const verificationUrl = new URL("/email-verification", request.url);
  const redirectTarget = `${pathname}${search}`;

  if (redirectTarget !== "/email-verification") {
    verificationUrl.searchParams.set("redirect", redirectTarget);
  }

  return NextResponse.redirect(verificationUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtectedRoute = isProtectedPath(pathname);
  const isGuestOnlyRoute = guestOnlyRoutes.has(pathname);
  const isRegistrationRoute = pathname === "/register";

  if (!isProtectedRoute && !isGuestOnlyRoute) {
    return NextResponse.next();
  }

  if (!hasCookies(request)) {
    if (isRegistrationRoute) {
      const companySettingsState = await resolvePublicCompanySettingsState(request);

      if (!companySettingsState.registrationEnabled) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    if (isProtectedRoute) {
      return createLoginRedirect(request, pathname, search);
    }

    return NextResponse.next();
  }

  const authState = await resolveAuthState(request);

  if (!authState.authenticated && isRegistrationRoute) {
    const companySettingsState = await resolvePublicCompanySettingsState(request);

    if (!companySettingsState.registrationEnabled) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (isProtectedRoute && !authState.authenticated) {
    return createLoginRedirect(request, pathname, search);
  }

  if (authState.authenticated && authState.mustVerifyEmail) {
    return createEmailVerificationRedirect(request, pathname, search);
  }

  if (isGuestOnlyRoute && authState.authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/",
    "/register",
    "/messages/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/dashboard/:path*",
    "/invoices/:path*",
    "/invoice-sms-templates/:path*",
    "/invoice-sms-logs/:path*",
    "/customers/:path*",
    "/ops/:path*",
    "/storage/:path*",
    "/users/:path*",
    "/roles/:path*",
    "/permissions/:path*",
    "/products/:path*",
    "/product-units/:path*",
    "/product-prices/:path*",
    "/system-log/:path*",
    "/sms-credentials/:path*",
  ],
};
