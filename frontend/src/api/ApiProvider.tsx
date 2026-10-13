import { createContext, useContext, type ReactNode } from "react";
import type { Api } from "./endpoints";
import type { ApiClient } from "./client";

interface ApiContextValue {
  api: Api;
  client: ApiClient;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ value, children }: { value: ApiContextValue; children: ReactNode }) {
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApiContext(): ApiContextValue {
  const value = useContext(ApiContext);
  if (!value) throw new Error("ApiProvider is missing");
  return value;
}

export function useApi(): Api {
  return useApiContext().api;
}
