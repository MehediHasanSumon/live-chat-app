const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ApiPrimitive = string | number | boolean | null;
type ApiBodyValue = ApiPrimitive | ApiBodyValue[] | { [key: string]: ApiBodyValue };
type ApiBody = Record<string, ApiBodyValue>;

type ApiClientOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: ApiBody | BodyInit | null;
  headers?: HeadersInit;
  requiresCsrf?: boolean;
  skipAuthRedirect?: boolean;
  retryOnCsrfFailure?: boolean;
};

type ApiErrorPayload = {
  message?: string;
  errors?: Record<string, string[]>;
};

export class ApiClientError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(status: number, payload?: ApiErrorPayload) {
    super(payload?.message ?? "Request failed.");
    this.name = "ApiClientError";
    this.status = status;
    this.errors = payload?.errors;
  }
}

let unauthenticatedHandler: (() => void) | null = null;
let csrfCookieRequest: Promise<void> | null = null;

function isPlainObject(value: unknown): value is ApiBody {
  return typeof value === "object" && value !== null && !(value instanceof FormData) && !(value instanceof URLSearchParams);
}

function buildUrl(path: string): string {
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=")[1] ?? "") : null;
}

function createHeaders(options: ApiClientOptions): Headers {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const token = getCookie("XSRF-TOKEN");
  if (token && !headers.has("X-XSRF-TOKEN")) {
    headers.set("X-XSRF-TOKEN", token);
  }

  if (isPlainObject(options.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function createBody(body: ApiClientOptions["body"]): BodyInit | undefined {
  if (body == null) {
    return undefined;
  }

  if (isPlainObject(body)) {
    return JSON.stringify(body);
  }

  return body;
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload | undefined> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined;
  }

  return response.json().catch(() => undefined) as Promise<ApiErrorPayload | undefined>;
}

export async function ensureCsrfCookie(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (!csrfCookieRequest) {
    csrfCookieRequest = fetch(buildUrl("/sanctum/csrf-cookie"), {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    }).then((response) => {
      if (!response.ok) {
        throw new ApiClientError(response.status, { message: "Unable to initialize CSRF protection." });
      }
    }).finally(() => {
      csrfCookieRequest = null;
    });
  }

  return csrfCookieRequest;
}

async function request<T>(path: string, options: ApiClientOptions = {}, hasRetried = false): Promise<T> {
  if (options.requiresCsrf) {
    await ensureCsrfCookie();
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    credentials: "include",
    headers: createHeaders(options),
    body: createBody(options.body),
  });

  if (response.status === 419 && options.retryOnCsrfFailure !== false && !hasRetried) {
    await ensureCsrfCookie();
    return request<T>(path, options, true);
  }

  if (response.status === 401 && !options.skipAuthRedirect) {
    unauthenticatedHandler?.();
  }

  if (!response.ok) {
    throw new ApiClientError(response.status, await parseErrorPayload(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function setUnauthenticatedHandler(handler: (() => void) | null) {
  unauthenticatedHandler = handler;
}

export const apiClient = {
  request,
  get<T>(path: string, options: Omit<ApiClientOptions, "method" | "body"> = {}) {
    return request<T>(path, { ...options, method: "GET" });
  },
  post<T>(path: string, body?: ApiClientOptions["body"], options: Omit<ApiClientOptions, "method" | "body"> = {}) {
    return request<T>(path, {
      ...options,
      method: "POST",
      body,
      requiresCsrf: options.requiresCsrf ?? true,
    });
  },
  patch<T>(path: string, body?: ApiClientOptions["body"], options: Omit<ApiClientOptions, "method" | "body"> = {}) {
    return request<T>(path, {
      ...options,
      method: "PATCH",
      body,
      requiresCsrf: options.requiresCsrf ?? true,
    });
  },
  put<T>(path: string, body?: ApiClientOptions["body"], options: Omit<ApiClientOptions, "method" | "body"> = {}) {
    return request<T>(path, {
      ...options,
      method: "PUT",
      body,
      requiresCsrf: options.requiresCsrf ?? true,
    });
  },
  delete<T>(path: string, options: Omit<ApiClientOptions, "method" | "body"> = {}) {
    return request<T>(path, {
      ...options,
      method: "DELETE",
      requiresCsrf: options.requiresCsrf ?? true,
    });
  },
};
