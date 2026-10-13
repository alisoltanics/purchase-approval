// Mirror of backend/common/validators.py (docs/api-contract.md section 6, D-25..D-30, D-56).
// Both are driven by testdata/validation-cases.json. Do not use String.trim: it differs from
// the contract's trim set (U+001C-001F, U+0085, U+FEFF).
import type { FieldErrorCode } from "../api/types";

export type Result = { ok: true; value: string } | { ok: false; code: FieldErrorCode };

const TRIM_CODE_POINTS = new Set<number>([
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x0085, 0x00a0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
]);
const AMOUNT_TRIM_CODE_POINTS = new Set<number>([0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020]);

export const LIMITS = { title: 120, vendor: 120, description: 2000, reason: 1000 } as const;

const AMOUNT_PATTERN = /^[0-9]+(?:\.[0-9]+)?$/;

const fail = (code: FieldErrorCode): Result => ({ ok: false, code });
const pass = (value: string): Result => ({ ok: true, value });

function trimSet(chars: string[], set: ReadonlySet<number>): string[] {
  let start = 0;
  let end = chars.length;
  while (start < end && set.has(chars[start]!.codePointAt(0)!)) start += 1;
  while (end > start && set.has(chars[end - 1]!.codePointAt(0)!)) end -= 1;
  return chars.slice(start, end);
}

function isLoneSurrogate(codePoint: number): boolean {
  return codePoint >= 0xd800 && codePoint <= 0xdfff;
}

// Cc = U+0000-001F and U+007F-009F.
function isControl(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}

function validateText(value: unknown, maxLength: number, multiline: boolean): Result {
  if (value === undefined || value === null) return fail("required");
  if (typeof value !== "string") return fail("invalid_format");
  const normalized = multiline ? value.replace(/\r\n|\r/g, "\n") : value;
  // Array.from on a string iterates code points; a lone surrogate stays a single element.
  const chars = trimSet(Array.from(normalized), TRIM_CODE_POINTS);
  if (chars.length === 0) return fail("required");
  for (const char of chars) {
    const codePoint = char.codePointAt(0)!;
    if (isLoneSurrogate(codePoint)) return fail("invalid_characters");
    if (isControl(codePoint) && !(multiline && codePoint === 0x0a)) {
      return fail("invalid_characters");
    }
    if (!multiline && (codePoint === 0x2028 || codePoint === 0x2029)) {
      return fail("invalid_characters");
    }
  }
  if (chars.length > maxLength) return fail("too_long");
  return pass(chars.join(""));
}

export const validateTitle = (value: unknown): Result => validateText(value, LIMITS.title, false);
export const validateVendor = (value: unknown): Result => validateText(value, LIMITS.vendor, false);
export const validateDescription = (value: unknown): Result =>
  validateText(value, LIMITS.description, true);
export const validateReason = (value: unknown): Result => validateText(value, LIMITS.reason, true);

// Amounts stay strings: no Number(), no parseFloat, no float math.
export function validateAmount(value: unknown): Result {
  if (value === undefined || value === null) return fail("required");
  if (typeof value !== "string") return fail("invalid_format");
  const trimmed = trimSet(Array.from(value), AMOUNT_TRIM_CODE_POINTS).join("");
  if (trimmed === "") return fail("required");
  if (!AMOUNT_PATTERN.test(trimmed)) return fail("invalid_format");
  const [integerPart = "", fraction = ""] = trimmed.split(".");
  if (fraction.length > 2) return fail("too_many_decimals");
  if (integerPart.length > 6) return fail("out_of_range");
  const cents = BigInt(integerPart) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
  if (cents < 1n || cents > 99999999n) return fail("out_of_range");
  const whole = (cents / 100n).toString();
  const rest = (cents % 100n).toString().padStart(2, "0");
  return pass(`${whole}.${rest}`);
}

export function validateLoginEmail(value: unknown): Result {
  if (value === undefined || value === null) return fail("required");
  if (typeof value !== "string") return fail("invalid_format");
  const trimmed = trimSet(Array.from(value), TRIM_CODE_POINTS).join("");
  return trimmed === "" ? fail("required") : pass(trimmed);
}

// The password is never trimmed.
export function validateLoginPassword(value: unknown): Result {
  if (value === undefined || value === null) return fail("required");
  if (typeof value !== "string") return fail("invalid_format");
  return value === "" ? fail("required") : pass(value);
}
