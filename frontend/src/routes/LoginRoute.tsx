import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { sanitizeNextPath } from "../format/format";
import { SignInPage } from "./pages/Placeholders";

// A signed-in visitor never sees the sign-in form (plan 7.1).
export function LoginRoute() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  if (session.status === "signed-in") {
    return <Navigate to={sanitizeNextPath(params.get("next"))} replace />;
  }
  return <SignInPage />;
}
