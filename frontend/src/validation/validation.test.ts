import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIMITS,
  validateAmount,
  validateDescription,
  validateLoginEmail,
  validateLoginPassword,
  validateReason,
  validateTitle,
  validateVendor,
  type Result,
} from "./rules";

interface Case {
  id: string;
  name: string;
  input?: unknown;
  missing?: boolean;
  valid: boolean;
  normalized?: string;
  code?: string;
}
interface Fixture {
  limits: Record<string, number>;
  groups: Record<string, { cases: Case[] }>;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../../testdata/validation-cases.json"), "utf-8"),
) as Fixture;

const validators: Record<string, (value: unknown) => Result> = {
  title: validateTitle,
  vendor: validateVendor,
  description: validateDescription,
  rejection_reason: validateReason,
  amount: validateAmount,
  login_email: validateLoginEmail,
  login_password: validateLoginPassword,
};

describe("shared validation fixture", () => {
  it("has a validator for every group", () => {
    expect(Object.keys(fixture.groups).sort()).toEqual(Object.keys(validators).sort());
  });

  it("uses the same limits as the fixture", () => {
    expect(fixture.limits).toEqual({
      title: LIMITS.title,
      vendor: LIMITS.vendor,
      description: LIMITS.description,
      rejection_reason: LIMITS.reason,
    });
  });

  for (const [group, spec] of Object.entries(fixture.groups)) {
    describe(group, () => {
      for (const testCase of spec.cases) {
        it(`${testCase.id}: ${testCase.name}`, () => {
          const value = testCase.missing ? undefined : testCase.input;
          const result = validators[group]!(value);
          if (testCase.valid) {
            expect(result).toEqual({ ok: true, value: testCase.normalized });
          } else {
            expect(result).toEqual({ ok: false, code: testCase.code });
          }
        });
      }
    });
  }
});
