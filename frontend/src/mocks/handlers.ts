// MSW handlers built from the frozen contract (docs/api-contract.md). Screens (T09-T12) reuse
// these and override single endpoints with server.use(...) for their own states.
import { http, HttpResponse } from "msw";
import type { ErrorCode, FieldError, RequestListItem, RequestStatus } from "../api/types";
import { ALEX, JORDAN, PASSWORD, USERS, defaultRequests, makeDetail } from "./data";

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

// The requests the mock server knows about. Tests replace them with setMockRequests().
const requestStore: { items: RequestListItem[] } = { items: defaultRequests() };

export function setMockRequests(items: RequestListItem[]): void {
  requestStore.items = items;
}

export function resetMockRequests(): void {
  requestStore.items = defaultRequests();
}

const PAGE_SIZE = 20;
const STATUSES: readonly RequestStatus[] = ["pending", "approved", "rejected"];

// Same visibility rule as the server: employees see their own, managers the whole company.
function visibleItems(): RequestListItem[] {
  const user = currentUser();
  if (!user) return [];
  const own = requestStore.items.filter((item) => item.requester.id === user.id);
  const all = [...requestStore.items];
  const visible = user.role === "manager" ? all : own;
  // Newest first, id descending as the tie-breaker (D-13).
  return visible.sort(
    (a, b) => b.submitted_at.localeCompare(a.submitted_at) || b.id.localeCompare(a.id),
  );
}

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
  http.get("/api/requests/summary/", () => {
    if (!currentUser()) return errorResponse(401, "not_authenticated");
    const visible = visibleItems();
    const count = (status: RequestStatus) =>
      visible.filter((item) => item.status === status).length;
    return HttpResponse.json({
      all: visible.length,
      pending: count("pending"),
      approved: count("approved"),
      rejected: count("rejected"),
    });
  }),
  http.get("/api/requests/", ({ request }) => {
    if (!currentUser()) return errorResponse(401, "not_authenticated");
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const filtered = visibleItems().filter(
      (item) => status === null || item.status === (status as RequestStatus),
    );
    if (status !== null && !STATUSES.includes(status as RequestStatus)) {
      return errorResponse(400, "validation_error", {
        fields: { status: [{ code: "invalid_choice", message: "Choose one of the allowed values." }] },
      });
    }
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(Number(params.get("page") ?? "1") || 1, pageCount);
    return HttpResponse.json({
      count: filtered.length,
      page,
      page_size: PAGE_SIZE,
      page_count: pageCount,
      results: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
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
