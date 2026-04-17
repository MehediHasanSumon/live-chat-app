"use client";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PdfDownloadButton({
  disabled = false,
  isLoading = false,
  onClick,
}: {
  disabled?: boolean;
  isLoading?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="gap-2 self-start rounded-full px-5 sm:self-center"
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      <FileText className="h-4 w-4" />
      {isLoading ? "Downloading..." : "Download"}
    </Button>
  );
}
