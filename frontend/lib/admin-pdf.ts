export type AdminPdfQueryValue = string | number | boolean | null | undefined;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function buildQueryString(query?: Record<string, AdminPdfQueryValue>) {
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    const normalizedValue = typeof value === "string" ? value.trim() : String(value);

    if (!normalizedValue) {
      return;
    }

    params.set(key, normalizedValue);
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function buildAdminListPdfPath(resourcePath: string, query?: Record<string, AdminPdfQueryValue>) {
  return `${API_BASE_URL}/api/admin/${resourcePath}/export/pdf${buildQueryString(query)}`;
}

export function buildAdminDetailPdfPath(resourcePath: string, id: string | number, query?: Record<string, AdminPdfQueryValue>) {
  return `${API_BASE_URL}/api/admin/${resourcePath}/${id}/export/pdf${buildQueryString(query)}`;
}
