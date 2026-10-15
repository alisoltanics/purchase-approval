// Hand-written from docs/api-contract.md section 4 (frozen). Money and timestamps stay strings.

export type Role = "employee" | "manager";
export type RequestStatus = "pending" | "approved" | "rejected";
export type EventType = "submitted" | "approved" | "rejected";

export interface Company {
  id: string;
  name: string;
}

export interface UserRef {
  id: string;
  display_name: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  company: Company;
}

export interface RequestListItem {
  id: string;
  title: string;
  vendor: string;
  amount: string;
  currency: "USD";
  status: RequestStatus;
  submitted_at: string;
  requester: UserRef;
}

export interface RequestEvent {
  type: EventType;
  actor: UserRef;
  created_at: string;
  reason: string | null;
}

export interface RequestDetail extends RequestListItem {
  description: string;
  decided_by: UserRef | null;
  decided_at: string | null;
  rejection_reason: string | null;
  can_decide: boolean;
  events: RequestEvent[];
}

export interface RequestList {
  count: number;
  page: number;
  page_size: 20;
  page_count: number;
  results: RequestListItem[];
}

// How many requests the caller can see, in total and per status; ignores filter and page.
export interface RequestSummary {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface NewRequestPayload {
  title: string;
  vendor: string;
  description: string;
  amount: string;
}

export const ERROR_CODES = [
  "validation_error",
  "not_authenticated",
  "invalid_credentials",
  "csrf_failed",
  "not_permitted",
  "own_request",
  "request_unavailable",
  "not_found",
  "method_not_allowed",
  "already_decided",
  "idempotency_conflict",
  "throttled",
  "server_error",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const FIELD_ERROR_CODES = [
  "required",
  "too_long",
  "invalid_characters",
  "invalid_format",
  "too_many_decimals",
  "out_of_range",
  "invalid_choice",
] as const;
export type FieldErrorCode = (typeof FIELD_ERROR_CODES)[number];

export interface FieldError {
  code: FieldErrorCode;
  message: string;
}
