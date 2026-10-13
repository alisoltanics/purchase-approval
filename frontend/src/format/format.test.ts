import { describe, expect, it } from "vitest";
import { codePointLength, formatAmount, formatTimestamp, sanitizeNextPath } from "./format";

describe("formatTimestamp", () => {
  it("formats UTC without using the locale or time zone", () => {
    expect(formatTimestamp("2026-10-10T14:30:05Z")).toBe("10 Oct 2026, 14:30 UTC");
    expect(formatTimestamp("2026-01-02T00:05:00Z")).toBe("2 Jan 2026, 00:05 UTC");
    expect(formatTimestamp("2026-12-31T23:59:59Z")).toBe("31 Dec 2026, 23:59 UTC");
  });

  it("returns a malformed value unchanged", () => {
    expect(formatTimestamp("yesterday")).toBe("yesterday");
    expect(formatTimestamp("2026-13-01T00:00:00Z")).toBe("2026-13-01T00:00:00Z");
  });
});

describe("formatAmount", () => {
  it("keeps the API string and adds the currency", () => {
    expect(formatAmount("25.00", "USD")).toBe("USD 25.00");
    expect(formatAmount("999999.99", "USD")).toBe("USD 999999.99");
  });
});

describe("sanitizeNextPath (D-33)", () => {
  it("accepts same-origin paths with query strings", () => {
    expect(sanitizeNextPath("/requests/abc")).toBe("/requests/abc");
    expect(sanitizeNextPath("/requests?status=pending&page=2")).toBe(
      "/requests?status=pending&page=2",
    );
  });

  it.each([
    null,
    undefined,
    "",
    "requests",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/requests\nSet-Cookie: x",
    "/a\\b",
    "/login",
    "/login?next=/requests",
  ])("falls back to /requests for %j", (value) => {
    expect(sanitizeNextPath(value as string | null | undefined)).toBe("/requests");
  });
});

describe("codePointLength", () => {
  it("counts an emoji as one", () => {
    expect(codePointLength("a\u{1f600}")).toBe(2);
  });
});
