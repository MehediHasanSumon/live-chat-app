export const protectedPrefixes = [
  "/messages",
  "/settings",
  "/dashboard",
  "/ops",
  "/storage",
  "/users",
  "/roles",
  "/permissions",
  "/system-log",
] as const;

export function matchesProtectedPrefix(pathname: string, prefixes: readonly string[] = protectedPrefixes): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
