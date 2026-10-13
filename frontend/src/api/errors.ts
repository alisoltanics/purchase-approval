import {
  ERROR_CODES,
  FIELD_ERROR_CODES,
  type ErrorCode,
  type FieldError,
  type FieldErrorCode,
  type RequestDetail,
} from "./types";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields: Readonly<Record<string, readonly FieldError[]>>;
  readonly request: RequestDetail | null;

  constructor(init: {
    code: ErrorCode;
    status: number;
    message: string;
    fields?: Record<string, readonly FieldError[]>;
    request?: RequestDetail | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.code = init.code;
    this.status = init.status;
    this.fields = init.fields ?? {};
    this.request = init.request ?? null;
  }
}

// The request never produced an HTTP response (offline, DNS, connection reset).
export class NetworkError extends Error {
  constructor() {
    super("network");
    this.name = "NetworkError";
  }
}

export function isApiError(error: unknown, code?: ErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

// Clients use the first error of a field (docs/api-contract.md section 5).
export function firstFieldCode(error: ApiError, field: string): FieldErrorCode | undefined {
  return error.fields[field]?.[0]?.code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

function parseFields(value: unknown): Record<string, readonly FieldError[]> {
  const fields: Record<string, FieldError[]> = {};
  if (!isRecord(value)) return fields;
  for (const [name, items] of Object.entries(value)) {
    if (!Array.isArray(items)) continue;
    const parsed: FieldError[] = [];
    for (const item of items) {
      if (!isRecord(item)) continue;
      const code = item["code"];
      const message = item["message"];
      if (
        typeof code === "string" &&
        (FIELD_ERROR_CODES as readonly string[]).includes(code) &&
        typeof message === "string"
      ) {
        parsed.push({ code: code as FieldErrorCode, message });
      }
    }
    fields[name] = parsed;
  }
  return fields;
}

// Turns any non-2xx response into an ApiError. A body that is not the project's error format
// (for example an HTML 502 from a proxy) becomes a generic server_error.
export function errorFromResponse(status: number, body: unknown): ApiError {
  const envelope = isRecord(body) ? body["error"] : undefined;
  if (!isRecord(envelope) || !isErrorCode(envelope["code"])) {
    return new ApiError({ code: "server_error", status, message: "server_error" });
  }
  const request = envelope["request"];
  return new ApiError({
    code: envelope["code"],
    status,
    message: typeof envelope["message"] === "string" ? envelope["message"] : envelope["code"],
    fields: parseFields(envelope["fields"]),
    // The server is the only producer of this value; it is typed by the contract.
    request: isRecord(request) ? (request as unknown as RequestDetail) : null,
  });
}
