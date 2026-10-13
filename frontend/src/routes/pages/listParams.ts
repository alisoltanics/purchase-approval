import type { RequestStatus } from "../../api/types";

export const STATUS_FILTERS: readonly RequestStatus[] = ["pending", "approved", "rejected"];

// Beyond this many digits the page is clamped by the server anyway.
const MAX_PAGE_DIGITS = 9;

export interface ListParams {
  status: RequestStatus | undefined;
  page: number;
}

// The URL is the list state (D-14). Anything unusable falls back to "all, page 1".
export function parseListParams(params: URLSearchParams): ListParams {
  const rawStatus = params.get("status");
  const status = STATUS_FILTERS.find((candidate) => candidate === rawStatus);
  const rawPage = params.get("page") ?? "";
  const digits = rawPage.replace(/^0+/, "");
  const page = /^[0-9]+$/.test(rawPage) && digits !== "" ? Number(digits.slice(0, MAX_PAGE_DIGITS)) : 1;
  return { status, page };
}

export function buildListParams({ status, page }: ListParams): URLSearchParams {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return params;
}
