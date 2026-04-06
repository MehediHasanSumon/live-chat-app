type MessageAvatarProps = {
  name: string;
  online?: boolean;
  sizeClass?: string;
  textClass?: string;
};

export function MessageAvatar({
  name,
  online = false,
  sizeClass = "h-11 w-11",
  textClass = "text-sm",
}: MessageAvatarProps) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-semibold text-[var(--accent)] ${sizeClass} ${textClass}`}
    >
      {name.slice(0, 1)}
      {online ? (
        <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
      ) : null}
    </div>
  );
}
