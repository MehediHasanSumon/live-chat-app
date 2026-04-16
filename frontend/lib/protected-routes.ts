export const protectedPrefixes = [
  "/messages",
  "/profile",
  "/settings",
  "/dashboard",
  "/invoices",
  "/customers",
  "/ops",
  "/storage",
  "/users",
  "/roles",
  "/permissions",
  "/products",
  "/product-units",
  "/product-prices",
  "/system-log",
] as const;

export function matchesProtectedPrefix(pathname: string, prefixes: readonly string[] = protectedPrefixes): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
