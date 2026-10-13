import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiProvider } from "./api/ApiProvider";
import { ApiClient } from "./api/client";
import { createApi } from "./api/endpoints";
import { AuthProvider } from "./auth/AuthContext";
import { AppRoutes } from "./routes/AppRoutes";

export function createQueryClient(): QueryClient {
  // Mutations are never retried automatically (plan 7.2): a retry must be the user's choice.
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
  });
}

export function AppProviders({ client, children }: { client?: ApiClient; children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [apiValue] = useState(() => {
    const apiClient = client ?? new ApiClient();
    return { client: apiClient, api: createApi(apiClient) };
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={apiValue}>
        <AuthProvider>{children}</AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

export function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
