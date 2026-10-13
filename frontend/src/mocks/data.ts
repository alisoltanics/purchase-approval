// Mock records shaped exactly like docs/api-contract.md section 4, using the seed spec people.
import type { RequestDetail, RequestListItem, RequestStatus, User } from "../api/types";

export const NORTHSTAR = { id: "587682aa-b865-4a50-9035-4b5551defd6b", name: "Northstar Labs" };
export const HARBOR = { id: "7ed2940e-82f6-4e2f-a1a1-624a982276a3", name: "Harbor Works" };

export const ALEX: User = {
  id: "2bc1188c-bc4c-4dc3-8536-0b3c667a7977",
  email: "alex@northstar.example",
  display_name: "Alex Morgan",
  role: "employee",
  company: NORTHSTAR,
};
export const SAM: User = {
  id: "a66ad261-6322-43d0-b2fa-307c87e52f69",
  email: "sam@northstar.example",
  display_name: "Sam Rivera",
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

export const USERS: readonly User[] = [ALEX, SAM, JORDAN];

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

export function makeListItem(
  index: number,
  overrides: Partial<RequestListItem> = {},
): RequestListItem {
  const day = String(1 + (index % 28)).padStart(2, "0");
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `Request ${index}`,
    vendor: `Vendor ${index}`,
    amount: `${index}.00`,
    currency: "USD",
    status: "pending",
    submitted_at: `2026-10-${day}T09:15:00Z`,
    requester: { id: ALEX.id, display_name: ALEX.display_name },
    ...overrides,
  };
}

// Default dataset for the list screen: Alex has 3 requests, Sam 2, Jordan 1.
export function defaultRequests(): RequestListItem[] {
  const owned = (user: User) => ({ requester: { id: user.id, display_name: user.display_name } });
  const status = (value: RequestStatus) => ({ status: value });
  return [
    makeListItem(1, {
      ...owned(ALEX),
      ...status("pending"),
      title: "Standing desk for design team",
      vendor: "Ergo Office Supply",
      amount: "649.00",
      submitted_at: "2026-10-01T09:15:00Z",
    }),
    makeListItem(2, {
      ...owned(ALEX),
      ...status("pending"),
      title: "Annual design tool licenses",
      vendor: "Pixelforge Software",
      amount: "4200.00",
      submitted_at: "2026-10-02T13:40:00Z",
    }),
    makeListItem(3, {
      ...owned(SAM),
      ...status("pending"),
      title: "Team offsite catering",
      vendor: "Green Fork Catering",
      amount: "1250.50",
      submitted_at: "2026-10-03T08:05:00Z",
    }),
    makeListItem(4, {
      ...owned(JORDAN),
      ...status("pending"),
      title: "Conference travel for Q4 summit",
      vendor: "Skyway Travel",
      amount: "2380.75",
      submitted_at: "2026-10-04T16:20:00Z",
    }),
    makeListItem(5, {
      ...owned(ALEX),
      ...status("approved"),
      title: "Laptop replacement",
      vendor: "Byte Hardware Direct",
      amount: "1899.99",
      submitted_at: "2026-09-28T10:00:00Z",
    }),
    makeListItem(6, {
      ...owned(SAM),
      ...status("rejected"),
      title: "Premium coffee machine",
      vendor: "Barista Pro Equipment",
      amount: "3299.00",
      submitted_at: "2026-09-26T14:10:00Z",
    }),
  ];
}
