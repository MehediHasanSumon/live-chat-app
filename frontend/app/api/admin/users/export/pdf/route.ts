import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function buildBackendUrl(request: NextRequest): string {
  const incomingUrl = new URL(request.url);
  const params = incomingUrl.searchParams.toString();

  return `${API_BASE_URL}/api/admin/users/export/pdf${params ? `?${params}` : ""}`;
}

function normalizeInlineContentDisposition(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return `inline; filename*=UTF-8''${utf8Match[1]}`;
  }

  const basicMatch = headerValue.match(/filename="?([^"]+)"?/i);

  if (basicMatch?.[1]) {
    return `inline; filename="${basicMatch[1]}"`;
  }

  return "inline";
}

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(buildBackendUrl(request), {
      method: "GET",
      cache: "no-store",
      headers: {
        Cookie: request.headers.get("cookie") ?? "",
        Origin: APP_URL,
        Referer: `${APP_URL}/users`,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        const payload = await response.json().catch(() => ({ message: "Unable to download the PDF right now." }));

        return NextResponse.json(payload, {
          status: response.status,
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }

      return NextResponse.json(
        { message: "Unable to download the PDF right now." },
        {
          status: response.status,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Type", response.headers.get("content-type") ?? "application/pdf");

    const contentDisposition = response.headers.get("content-disposition");

    if (contentDisposition) {
      headers.set("Content-Disposition", normalizeInlineContentDisposition(contentDisposition) ?? "inline");
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to download the PDF right now." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
