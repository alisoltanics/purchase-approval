import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useApiContext } from "../api/ApiProvider";
import { isApiError } from "../api/errors";
import type { User } from "../api/types";

export const SESSION_KEY = ["session"] as const;

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: User }
  | { status: "error"; retry: () => void };

interface AuthContextValue {
  session: SessionState;
  signIn: (email: string, password: string) => Promise<User>;
  // Resolves true when the server confirmed the logout. The client session ends either way.
  signOut: () => Promise<boolean>;
  // Called when any API call reports a lost session (D-34).
  endSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { api, client } = useApiContext();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async (): Promise<User | null> => {
      try {
        return await api.me();
      } catch (error) {
        if (isApiError(error, "not_authenticated")) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  // Replaces the session value and drops every other cached value. The session query itself
  // must stay in the cache: the hook above observes it. Nothing is kept in browser storage.
  const replaceSession = useCallback(
    (user: User | null) => {
      queryClient.setQueryData<User | null>(SESSION_KEY, user);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
    },
    [queryClient],
  );
  const endSession = useCallback(() => replaceSession(null), [replaceSession]);

  useEffect(() => {
    client.setUnauthenticatedHandler(endSession);
    return () => client.setUnauthenticatedHandler(null);
  }, [client, endSession]);

  // D-35: a page restored from the back/forward cache re-checks the session.
  const { refetch } = query;
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refetch();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [refetch]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const user = await api.login(email, password);
      replaceSession(user);
      return user;
    },
    [api, replaceSession],
  );

  const signOut = useCallback(async () => {
    let confirmed = true;
    try {
      await api.logout();
    } catch {
      // The client forgets the session even if the call failed; the server session expires.
      confirmed = false;
    }
    endSession();
    return confirmed;
  }, [api, endSession]);

  const session: SessionState = useMemo(() => {
    if (query.isError) return { status: "error", retry: () => void refetch() };
    if (query.isPending) return { status: "loading" };
    return query.data ? { status: "signed-in", user: query.data } : { status: "signed-out" };
  }, [query.isError, query.isPending, query.data, refetch]);

  const value = useMemo(
    () => ({ session, signIn, signOut, endSession }),
    [session, signIn, signOut, endSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}

export function useCurrentUser(): User {
  const { session } = useAuth();
  if (session.status !== "signed-in") throw new Error("No signed-in user");
  return session.user;
}
