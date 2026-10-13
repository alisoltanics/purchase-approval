import { ApiError, NetworkError, errorFromResponse } from "./errors";

const CSRF_COOKIE = "csrftoken";
const CSRF_HEADER = "X-CSRFToken";
const SAFE_METHODS = new Set(["GET", "HEAD"]);

export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  // False for calls where 401 is an expected answer (the session check, logout).
  notifyOnUnauthenticated?: boolean;
}

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// The one place that talks to the network (D-34, plan 7.2): adds the CSRF header, parses the
// error format, and reports a lost session. Components never call fetch.
export class ApiClient {
  private unauthenticatedHandler: (() => void) | null = null;

  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  setUnauthenticatedHandler(handler: (() => void) | null): void {
    this.unauthenticatedHandler = handler;
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", path, options);
  }

  private async send(method: string, path: string, options: RequestOptions): Promise<Response> {
    const url = new URL(path, window.location.origin);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
    if (!SAFE_METHODS.has(method)) headers[CSRF_HEADER] = await this.csrfToken();
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    try {
      return await this.fetchImpl(url, { method, headers, body, credentials: "same-origin" });
    } catch (error) {
      if (error instanceof TypeError) throw new NetworkError();
      throw error;
    }
  }

  // Login rotates the token, so the cookie is read again before every unsafe request.
  private async csrfToken(): Promise<string> {
    const existing = readCookie(CSRF_COOKIE);
    if (existing) return existing;
    const response = await this.send("GET", "/api/auth/csrf/", {});
    if (!response.ok) throw errorFromResponse(response.status, await this.readBody(response));
    const token = readCookie(CSRF_COOKIE);
    if (!token) {
      throw new ApiError({ code: "csrf_failed", status: 403, message: "csrf_failed" });
    }
    return token;
  }

  private async readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text === "") return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  }

  private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const response = await this.send(method, path, options);
    const body = await this.readBody(response);
    if (!response.ok) {
      const error = errorFromResponse(response.status, body);
      if (error.code === "not_authenticated" && options.notifyOnUnauthenticated !== false) {
        this.unauthenticatedHandler?.();
      }
      throw error;
    }
    if (response.status !== 204 && body === undefined) {
      throw new ApiError({ code: "server_error", status: response.status, message: "bad_body" });
    }
    return body as T;
  }
}
