import type { NewRequestPayload } from "../api/types";
import {
  validateAmount,
  validateDescription,
  validateLoginEmail,
  validateLoginPassword,
  validateReason,
  validateTitle,
  validateVendor,
  type Result,
} from "./rules";
import type { FieldErrorCode } from "../api/types";

export type FieldErrors<Name extends string> = Partial<Record<Name, FieldErrorCode>>;

export type NewRequestField = keyof NewRequestPayload;

export type FormResult<Value, Name extends string> =
  | { ok: true; value: Value }
  | { ok: false; errors: FieldErrors<Name> };

// Order of the fields in the form: used to focus the first invalid one.
export const NEW_REQUEST_FIELD_ORDER: readonly NewRequestField[] = [
  "title",
  "vendor",
  "amount",
  "description",
];

function collect<Name extends string>(
  checks: Record<Name, Result>,
): FormResult<Record<Name, string>, Name> {
  const errors: FieldErrors<Name> = {};
  const values = {} as Record<Name, string>;
  let failed = false;
  for (const name of Object.keys(checks) as Name[]) {
    const result = checks[name];
    if (result.ok) {
      values[name] = result.value;
    } else {
      errors[name] = result.code;
      failed = true;
    }
  }
  return failed ? { ok: false, errors } : { ok: true, value: values };
}

export function validateNewRequest(input: {
  [Name in NewRequestField]: unknown;
}): FormResult<NewRequestPayload, NewRequestField> {
  return collect<NewRequestField>({
    title: validateTitle(input.title),
    vendor: validateVendor(input.vendor),
    amount: validateAmount(input.amount),
    description: validateDescription(input.description),
  });
}

export function validateLogin(input: { email: unknown; password: unknown }) {
  return collect<"email" | "password">({
    email: validateLoginEmail(input.email),
    password: validateLoginPassword(input.password),
  });
}

export function validateRejection(input: { reason: unknown }) {
  return collect<"reason">({ reason: validateReason(input.reason) });
}
