"use client";

import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BoneyardSkeletonProps = {
  name: string;
  loading: boolean;
  children: ReactNode;
  fallback: ReactNode;
  className?: string;
  fixture?: ReactNode;
};

function Bone({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-md bg-[rgba(96,91,255,0.11)]", className)} />;
}

export function BoneyardSkeleton({ loading, children, fallback, className }: BoneyardSkeletonProps) {
  if (!loading) {
    return <>{children}</>;
  }

  return <div className={className}>{fallback}</div>;
}

export function TableSkeleton({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div className="overflow-hidden">
      <div className="grid border-b border-[var(--line)] px-6 py-4 sm:px-8" style={{ gridTemplateColumns: `repeat(${columns}, minmax(120px, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Bone key={`header-${index}`} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="grid border-b border-[var(--line)] px-6 py-4 last:border-0 sm:px-8"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(120px, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Bone key={`cell-${rowIndex}-${columnIndex}`} className={cn("h-4", columnIndex === 0 ? "w-16" : "w-28")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <>
      {Array.from({ length: cards }).map((_, index) => (
        <div key={`card-${index}`} className="glass-card rounded-[1.25rem] px-5 py-5">
          <div className="flex items-center gap-3">
            <Bone className="h-10 w-10 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Bone className="h-3 w-24" />
              <Bone className="mt-3 h-7 w-32" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export function PanelSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3 px-6 py-8 sm:px-8">
      {Array.from({ length: lines }).map((_, index) => (
        <Bone key={`line-${index}`} className={cn("h-4", index % 3 === 0 ? "w-2/3" : index % 3 === 1 ? "w-1/2" : "w-5/6")} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`list-row-${index}`} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3">
          <Bone className="h-10 w-10 rounded-full" />
          <div className="min-w-0 flex-1">
            <Bone className="h-4 w-2/3" />
            <Bone className="mt-2 h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
