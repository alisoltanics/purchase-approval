import { describe, expect, it } from "vitest";
import {
  codePointLength,
  formatAmount,
  formatShortDate,
  formatTimestamp,
  groupThousands,
  sanitizeNextPath,
} from "./format";

describe("formatShortDate", () => {
  it.each([
    ["2026-10-01T09:15:00Z", "01 Oct 2026"],
    ["2026-09-28T23:59:59Z", "28 Sep 2026"],
    ["2026-01-31T00:00:00Z", "31 Jan 2026"],
    ["2026-12-05T12:00:00Z", "05 Dec 2026"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatShortDate(value)).toBe(expected);
  });

  it("returns malformed values unchanged so they stay visible", () => {
    expect(formatShortDate("yesterday")).toBe("yesterday");
    expect(formatShortDate("2026-13-01T00:00:00Z")).toBe("2026-13-01T00:00:00Z");
  });
});

describe("groupThousands", () => {
  it.each([
    ["0.01", "0.01"],
    ["25.00", "25.00"],
    ["999.99", "999.99"],
    ["1000.00", "1,000.00"],
    ["4200.00", "4,200.00"],
    ["12345.50", "12,345.50"],
    ["999999.99", "999,999.99"],
    ["1234567.00", "1,234,567.00"],
  ])("groups %s as %s without touching the digits", (value, expected) => {
    expect(groupThousands(value)).toBe(expected);
  });

  it("works on a string with no fraction", () => {
    expect(groupThousands("1000")).toBe("1,000");
  });
});

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
