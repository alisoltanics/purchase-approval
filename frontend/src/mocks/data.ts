// Mock records shaped exactly like docs/api-contract.md section 4, using the seed spec people.
import type { RequestDetail, User } from "../api/types";

export const NORTHSTAR = { id: "587682aa-b865-4a50-9035-4b5551defd6b", name: "Northstar Labs" };
export const HARBOR = { id: "7ed2940e-82f6-4e2f-a1a1-624a982276a3", name: "Harbor Works" };

export const ALEX: User = {
  id: "2bc1188c-bc4c-4dc3-8536-0b3c667a7977",
  email: "alex@northstar.example",
  display_name: "Alex Morgan",
  role: "employee",
  company: NORTHSTAR,
};
export const JORDAN: User = {
  id: "3f78235c-d9b2-4dac-8767-79f4bbe833c2",
  email: "jordan@northstar.example",
  display_name: "Jordan Lee",
  role: "manager",
  company: NORTHSTAR,
};

export const PASSWORD = "correct-horse-battery";

export const USERS: readonly User[] = [ALEX, JORDAN];

export function makeDetail(overrides: Partial<RequestDetail> = {}): RequestDetail {
  return {
    id: "86935e09-143b-482a-bf3c-f7400bc4b6de",
    title: "Standing desk for design team",
    vendor: "Ergo Office Supply",
    amount: "649.00",
    currency: "USD",
    status: "pending",
    submitted_at: "2026-10-01T09:15:00Z",
    requester: { id: ALEX.id, display_name: ALEX.display_name },
    description: "Two sit-stand desks, 160 cm wide.",
    decided_by: null,
    decided_at: null,
    rejection_reason: null,
    can_decide: false,
    events: [
      {
        type: "submitted",
        actor: { id: ALEX.id, display_name: ALEX.display_name },
        created_at: "2026-10-01T09:15:00Z",
        reason: null,
      },
    ],
    ...overrides,
  };
}
