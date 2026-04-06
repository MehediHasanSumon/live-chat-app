type AvatarPlaceholderProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeMap = {
  sm: "h-11 w-11",
  md: "h-12 w-12",
  lg: "h-14 w-14",
  xl: "h-28 w-28",
} as const;

export function AvatarPlaceholder({
  size = "md",
  className = "",
}: AvatarPlaceholderProps) {
  return (
    <div
      className={`${sizeMap[size]} rounded-full bg-[linear-gradient(135deg,#dce4ff,#f3f6ff)] ${className}`.trim()}
    />
  );
}
