import type { ApiClient } from "./client";
import type {
  NewRequestPayload,
  RequestDetail,
  RequestList,
  RequestStatus,
  RequestSummary,
  User,
} from "./types";

export interface ListParams {
  status?: RequestStatus;
  page?: number;
}

export function createApi(client: ApiClient) {
  const requestPath = (id: string) => `/api/requests/${encodeURIComponent(id)}/`;
  return {
    me: () => client.get<User>("/api/auth/me/", { notifyOnUnauthenticated: false }),
    login: (email: string, password: string) =>
      client.post<User>("/api/auth/login/", { body: { email, password } }),
    logout: () => client.post<void>("/api/auth/logout/", { notifyOnUnauthenticated: false }),
    listRequests: ({ status, page }: ListParams = {}) =>
      client.get<RequestList>("/api/requests/", { query: { status, page } }),
    getRequestSummary: () => client.get<RequestSummary>("/api/requests/summary/"),
    getRequest: (id: string) => client.get<RequestDetail>(requestPath(id)),
    createRequest: (payload: NewRequestPayload, idempotencyKey: string) =>
      client.post<RequestDetail>("/api/requests/", {
        body: payload,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    approveRequest: (id: string) => client.post<RequestDetail>(`${requestPath(id)}approve/`),
    rejectRequest: (id: string, reason: string) =>
      client.post<RequestDetail>(`${requestPath(id)}reject/`, { body: { reason } }),
  };
}

export type Api = ReturnType<typeof createApi>;
