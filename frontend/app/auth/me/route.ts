import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/me`, {
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
      return NextResponse.json(
        {
          authenticated: false,
          data: {
            user: null,
            settings: null,
            email_verification_required: false,
            must_verify_email: false,
          },
        },
        { status: 200 },
      );
    }

    const payload = await response.json();

    return NextResponse.json(
      {
        authenticated: true,
        ...payload,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
        data: {
          user: null,
          settings: null,
          email_verification_required: false,
          must_verify_email: false,
        },
      },
      { status: 200 },
    );
  }
}
