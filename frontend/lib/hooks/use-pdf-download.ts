"use client";

import { useCallback, useState } from "react";

import { ApiClientError } from "@/lib/api-client";

function parseContentDispositionFilename(headerValue: string | null) {
  if (!headerValue) {
    return null;
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = headerValue.match(/filename="?([^"]+)"?/i);
  return basicMatch?.[1] ?? null;
}

export function usePdfDownload() {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const download = useCallback(async (path: string, fallbackFilenamePrefix?: string) => {
    setDownloadError(null);

    try {
      if (typeof document === "undefined") {
        throw new Error("Document is not available.");
      }

      void fallbackFilenamePrefix;

      setIsDownloadingPdf(true);

      const response = await fetch(path, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json, application/pdf",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => null);
          throw new ApiClientError(response.status, payload ?? undefined);
        }

        throw new ApiClientError(response.status, { message: "Unable to download the PDF right now." });
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new ApiClientError(response.status, { message: "Downloaded PDF was empty. Please try again." });
      }

      const filename =
        parseContentDispositionFilename(response.headers.get("content-disposition")) ??
        `${fallbackFilenamePrefix ?? "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60_000);
    } catch (downloadPdfError) {
      if (downloadPdfError instanceof ApiClientError) {
        setDownloadError(downloadPdfError.message);
        return;
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  }, []);

  return {
    download,
    downloadError,
    isDownloadingPdf,
  };
}
