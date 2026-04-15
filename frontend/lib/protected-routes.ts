export const protectedPrefixes = [
  "/messages",
  "/settings",
  "/dashboard",
  "/ops",
  "/storage",
  "/users",
  "/roles",
  "/permissions",
  "/products",
  "/product-units",
  "/system-log",
] as const;

export function matchesProtectedPrefix(pathname: string, prefixes: readonly string[] = protectedPrefixes): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
