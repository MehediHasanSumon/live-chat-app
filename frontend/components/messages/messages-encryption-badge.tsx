type MessagesEncryptionBadgeProps = {
  label?: string;
};

export function MessagesEncryptionBadge({
  label = "End-to-end encrypted",
}: MessagesEncryptionBadgeProps) {
  return (
    <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
      {label}
    </div>
  );
}
