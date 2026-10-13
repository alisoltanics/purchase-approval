// One formatter per type (plan 7.5). Nothing here depends on the browser locale or time zone.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}Z$/;

// "2026-10-10T14:30:05Z" -> "10 Oct 2026, 14:30 UTC". Anything else is returned unchanged so a
// malformed value is visible rather than hidden.
export function formatTimestamp(value: string): string {
  const match = TIMESTAMP.exec(value);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return value;
  return `${Number(day)} ${monthName} ${year}, ${hour}:${minute} UTC`;
}

// Built from the API string; never converted to a number.
export function formatAmount(amount: string, currency: string): string {
  return `${currency} ${amount}`;
}

// D-33: only same-origin relative paths are accepted as a return target.
export function sanitizeNextPath(next: string | null | undefined): string {
  const fallback = "/requests";
  if (typeof next !== "string" || next === "") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Reject control characters and anything that browsers may normalise into another origin.
  for (const char of next) {
    const codePoint = char.codePointAt(0)!;
    if (codePoint <= 0x1f || codePoint === 0x7f || char === "\\") return fallback;
  }
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/login/")) {
    return fallback;
  }
  return next;
}

export function codePointLength(value: string): number {
  return Array.from(value).length;
}
