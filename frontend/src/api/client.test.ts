import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { errorResponse } from "../mocks/handlers";
import { server } from "../mocks/server";
import { ApiClient } from "./client";
import { ApiError, NetworkError, isApiError, isNetworkError } from "./errors";
import { newIdempotencyKey } from "./idempotency";

describe("ApiClient", () => {
  it("parses a successful JSON body", async () => {
    server.use(http.get("/api/ping/", () => HttpResponse.json({ ok: true })));
    expect(await new ApiClient().get("/api/ping/")).toEqual({ ok: true });
  });

  it("sends the CSRF header on POST, fetching the cookie first when missing", async () => {
    let header: string | null = null;
    server.use(
      http.post("/api/things/", ({ request }) => {
        header = request.headers.get("X-CSRFToken");
        return HttpResponse.json({ ok: true });
      }),
    );
    await new ApiClient().post("/api/things/", { body: { a: 1 } });
    expect(header).toBe("test-csrf-token");
  });

  it("does not send the CSRF header on GET", async () => {
    let header: string | null = "unset";
    server.use(
      http.get("/api/ping/", ({ request }) => {
        header = request.headers.get("X-CSRFToken");
        return HttpResponse.json({});
      }),
    );
    await new ApiClient().get("/api/ping/");
    expect(header).toBeNull();
  });

  it("re-reads the CSRF cookie before each unsafe request", async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.post("/api/things/", ({ request }) => {
        seen.push(request.headers.get("X-CSRFToken"));
        return HttpResponse.json({});
      }),
    );
    const client = new ApiClient();
    document.cookie = "csrftoken=first; path=/";
    await client.post("/api/things/");
    document.cookie = "csrftoken=second; path=/";
    await client.post("/api/things/");
    expect(seen).toEqual(["first", "second"]);
  });

  it("builds the query string and skips undefined values", async () => {
    let search = "";
    server.use(
      http.get("/api/requests/", ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({});
      }),
    );
    await new ApiClient().get("/api/requests/", { query: { status: "pending", page: 2, x: undefined } });
    expect(search).toBe("?status=pending&page=2");
  });

  it("turns the project error format into an ApiError with field errors", async () => {
    server.use(
      http.post("/api/things/", () =>
        errorResponse(400, "validation_error", {
          fields: { title: [{ code: "required", message: "x" }] },
        }),
      ),
    );
    document.cookie = "csrftoken=t; path=/";
    const error = await new ApiClient().post("/api/things/").catch((e: unknown) => e);
    expect(isApiError(error, "validation_error")).toBe(true);
    expect((error as ApiError).fields["title"]?.[0]?.code).toBe("required");
    expect((error as ApiError).status).toBe(400);
  });

  it("keeps the current request of an already_decided error", async () => {
    server.use(
      http.get("/api/x/", () =>
        errorResponse(409, "already_decided", { request: { id: "r1", status: "approved" } }),
      ),
    );
    const error = (await new ApiClient().get("/api/x/").catch((e: unknown) => e)) as ApiError;
    expect(error.request).toMatchObject({ id: "r1", status: "approved" });
  });

  it("maps a non-JSON error page (for example a proxy 502) to server_error", async () => {
    server.use(http.get("/api/x/", () => new HttpResponse("<html>Bad gateway</html>", { status: 502 })));
    const error = await new ApiClient().get("/api/x/").catch((e: unknown) => e);
    expect(isApiError(error, "server_error")).toBe(true);
  });

  it("maps an unknown error code to server_error", async () => {
    server.use(http.get("/api/x/", () => HttpResponse.json({ error: { code: "weird" } }, { status: 400 })));
    const error = await new ApiClient().get("/api/x/").catch((e: unknown) => e);
    expect(isApiError(error, "server_error")).toBe(true);
  });

  it("throws NetworkError when the request never gets a response", async () => {
    server.use(http.get("/api/x/", () => HttpResponse.error()));
    const error = await new ApiClient().get("/api/x/").catch((e: unknown) => e);
    expect(isNetworkError(error)).toBe(true);
    expect(error).toBeInstanceOf(NetworkError);
  });

  it("reports a lost session once, but not for calls that expect 401", async () => {
    server.use(http.get("/api/x/", () => errorResponse(401, "not_authenticated")));
    const client = new ApiClient();
    const lost = vi.fn();
    client.setUnauthenticatedHandler(lost);
    await client.get("/api/x/").catch(() => undefined);
    expect(lost).toHaveBeenCalledTimes(1);
    await client.get("/api/x/", { notifyOnUnauthenticated: false }).catch(() => undefined);
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it("does not treat invalid_credentials as a lost session", async () => {
    server.use(http.get("/api/x/", () => errorResponse(401, "invalid_credentials")));
    const client = new ApiClient();
    const lost = vi.fn();
    client.setUnauthenticatedHandler(lost);
    await client.get("/api/x/").catch(() => undefined);
    expect(lost).not.toHaveBeenCalled();
  });

  it("returns undefined for 204 responses", async () => {
    server.use(http.get("/api/x/", () => new HttpResponse(null, { status: 204 })));
    expect(await new ApiClient().get("/api/x/")).toBeUndefined();
  });
});

describe("newIdempotencyKey", () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("returns a UUID v4", () => {
    expect(newIdempotencyKey()).toMatch(UUID_V4);
  });

  it("falls back to getRandomValues when randomUUID is unavailable (D-40)", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const keys = new Set([newIdempotencyKey(), newIdempotencyKey()]);
      expect(keys.size).toBe(2);
      for (const key of keys) expect(key).toMatch(UUID_V4);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
