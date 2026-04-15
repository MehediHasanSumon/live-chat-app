import { getSocketId } from "@/lib/reverb";
import { pushToast } from "@/lib/stores/toast-store";
import { getCrudToastConfig, getToastErrorMessage } from "@/lib/toast-config";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_SESSION_HINT_KEY = "chat-app:has-session";
const sessionCookiePattern = /(?:^|;\s)[^=]*session[^=]*=/i;

type ApiPrimitive = string | number | boolean | null;
type ApiBodyValue = ApiPrimitive | ApiBodyValue[] | { [key: string]: ApiBodyValue };
type ApiBody = Record<string, ApiBodyValue>;

type ApiClientOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: ApiBody | BodyInit | null;
  headers?: HeadersInit;
  requiresCsrf?: boolean;
  skipAuthRedirect?: boolean;
  retryOnCsrfFailure?: boolean;
  toast?: false;
};

export type ApiErrorPayload = {
  message?: string;
  errors?: Record<string, string[]>;
  email_verification_required?: boolean;
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

export function hasSessionCookie(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return sessionCookiePattern.test(document.cookie);
}

export function hasSessionHint(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (!hasSessionCookie()) {
    clearSessionHint();
    return false;
  }

  return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === "1";
}

export function shouldBootstrapAuth(): boolean {
  return hasSessionCookie() || hasSessionHint();
}

export function markSessionHintAuthenticated(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_HINT_KEY, "1");
}

export function clearSessionHint(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
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

  const socketId = getSocketId();
  if (socketId && !headers.has("X-Socket-Id")) {
    headers.set("X-Socket-Id", socketId);
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

function dispatchEmailVerificationRequired(payload?: ApiErrorPayload): void {
  if (typeof window === "undefined" || payload?.email_verification_required !== true) {
    return;
  }

  window.dispatchEvent(new CustomEvent("chat-app:email-verification-required"));
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

  const method = options.method?.toUpperCase() ?? "GET";
  const crudToastConfig = options.toast === false ? null : getCrudToastConfig(path, method);
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
    clearSessionHint();
    unauthenticatedHandler?.();
  }

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    dispatchEmailVerificationRequired(errorPayload);
    if (crudToastConfig) {
      pushToast({
        kind: "crud",
        tone: "error",
        title: crudToastConfig.errorTitle,
        message: getToastErrorMessage(errorPayload, crudToastConfig.fallbackErrorMessage),
      });
    }

    throw new ApiClientError(response.status, errorPayload);
  }

  if (crudToastConfig) {
    pushToast({
      kind: "crud",
      tone: "success",
      title: crudToastConfig.successTitle,
      message: crudToastConfig.successMessage,
    });
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
  delete<T>(path: string, options: Omit<ApiClientOptions, "method"> = {}) {
    return request<T>(path, {
      ...options,
      method: "DELETE",
      requiresCsrf: options.requiresCsrf ?? true,
    });
  },
};
