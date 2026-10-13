import { useQuery } from "@tanstack/react-query";
import { useApi } from "./ApiProvider";
import type { RequestStatus } from "./types";

// One prefix for everything about requests, so a submit or a decision can invalidate it all.
export const requestKeys = {
  all: ["requests"] as const,
  list: (status: RequestStatus | undefined, page: number) =>
    ["requests", "list", status ?? "all", page] as const,
  summary: ["requests", "summary"] as const,
};

export function useRequestList(status: RequestStatus | undefined, page: number) {
  const api = useApi();
  return useQuery({
    queryKey: requestKeys.list(status, page),
    queryFn: () => api.listRequests({ status, page }),
  });
}

// Counts for the status tabs, the pending banner and the sidebar. Never blocks the screen.
export function useRequestSummary() {
  const api = useApi();
  return useQuery({
    queryKey: requestKeys.summary,
    queryFn: () => api.getRequestSummary(),
  });
}
