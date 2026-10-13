// MSW handlers built from the frozen contract (docs/api-contract.md). Screens (T09-T12) reuse
// these and override single endpoints with server.use(...) for their own states.
import { http, HttpResponse } from "msw";
import type { ErrorCode, FieldError } from "../api/types";
import { ALEX, JORDAN, PASSWORD, USERS, makeDetail } from "./data";

const MESSAGES: Record<ErrorCode, string> = {
  validation_error: "Check the highlighted fields.",
  not_authenticated: "Sign in to continue.",
  invalid_credentials: "Email or password is incorrect.",
  csrf_failed: "Your session could not be verified. Reload the page and try again.",
  not_permitted: "You do not have permission to decide requests.",
  own_request: "Another manager must review your request.",
  request_unavailable: "Request unavailable. It may not exist or you may not have access.",
  not_found: "Not found.",
  method_not_allowed: "Method not allowed.",
  already_decided: "This request has already been decided.",
  idempotency_conflict: "This submission key was already used with different values.",
  server_error: "Something went wrong. Try again.",
};

export function errorBody(
  code: ErrorCode,
  extra: { fields?: Record<string, FieldError[]>; request?: unknown } = {},
) {
  return { error: { code, message: MESSAGES[code], ...extra } };
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  extra: { fields?: Record<string, FieldError[]>; request?: unknown } = {},
) {
  return HttpResponse.json(errorBody(code, extra), { status });
}

// Minimal in-memory session so sign-in, sign-out and expiry can be exercised end to end.
export const sessionState: { userId: string | null } = { userId: null };

export function resetMockSession(userId: string | null = null): void {
  sessionState.userId = userId;
}

const currentUser = () => USERS.find((user) => user.id === sessionState.userId) ?? null;

export const handlers = [
  http.get("/api/auth/csrf/", () => {
    document.cookie = "csrftoken=test-csrf-token; path=/";
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/auth/me/", () => {
    const user = currentUser();
    return user ? HttpResponse.json(user) : errorResponse(401, "not_authenticated");
  }),
  http.post("/api/auth/login/", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = USERS.find((candidate) => candidate.email === body.email?.toLowerCase());
    if (!user || body.password !== PASSWORD) return errorResponse(401, "invalid_credentials");
    sessionState.userId = user.id;
    return HttpResponse.json(user);
  }),
  http.post("/api/auth/logout/", () => {
    sessionState.userId = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/requests/", () => {
    if (!currentUser()) return errorResponse(401, "not_authenticated");
    const item = makeDetail();
    return HttpResponse.json({
      count: 1,
      page: 1,
      page_size: 20,
      page_count: 1,
      results: [item],
    });
  }),
  http.get("/api/requests/:id/", ({ params }) => {
    const user = currentUser();
    if (!user) return errorResponse(401, "not_authenticated");
    const detail = makeDetail();
    return params["id"] === detail.id
      ? HttpResponse.json(detail)
      : errorResponse(404, "request_unavailable");
  }),
];

export { ALEX, JORDAN };
