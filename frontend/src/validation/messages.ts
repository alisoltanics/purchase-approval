import type { FieldErrorCode } from "../api/types";
import { copy, fill } from "../copy";
import { groupThousands } from "../format/format";
import { LIMITS } from "./rules";

export type MessageField = "title" | "vendor" | "description" | "amount" | "reason";

const MAX: Record<Exclude<MessageField, "amount">, string> = {
  title: groupThousands(String(LIMITS.title)),
  vendor: groupThousands(String(LIMITS.vendor)),
  description: groupThousands(String(LIMITS.description)),
  reason: groupThousands(String(LIMITS.reason)),
};

// The text shown beside a field for one error code (docs/api-contract.md section 5). The server
// and the form use the same codes, so both resolve here and the wording never drifts.
export function fieldMessage(field: MessageField, code: FieldErrorCode): string {
  if (field === "amount") {
    const messages = copy.validation.amount;
    if (code === "required") return messages.required;
    if (code === "too_many_decimals") return messages.tooManyDecimals;
    if (code === "out_of_range") return messages.outOfRange;
    return messages.invalidFormat;
  }
  const messages = copy.validation[field];
  if (code === "required") return messages.required;
  if (code === "too_long") return fill(messages.tooLong, { max: MAX[field] });
  if (code === "invalid_characters") return messages.invalidCharacters;
  return copy.validation.invalidFormat;
}
