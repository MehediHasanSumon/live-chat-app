export const protectedPrefixes = [
  "/messages",
  "/profile",
  "/settings",
  "/dashboard",
  "/invoices",
  "/invoice-sms-templates",
  "/invoice-sms-logs",
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
  "/sms-credentials",
] as const;

export function matchesProtectedPrefix(pathname: string, prefixes: readonly string[] = protectedPrefixes): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
