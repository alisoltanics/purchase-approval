import { Navigate, useLocation } from "react-router-dom";
import { Shell } from "../components/Shell";
import { useAuth } from "../auth/AuthContext";
import { copy } from "../copy";
import { StatusMessage } from "../components/StatusMessage";
import { ToastProvider } from "../components/Toast";

// Every route except /login sits behind this guard (plan 7.1). A signed-out visitor is sent to
// /login with the page they asked for, so sign-in can return them there (D-33, AC-03).
export function RequireSession() {
  const { session, explicitSignOut } = useAuth();
  const location = useLocation();

  switch (session.status) {
    case "loading":
      return <StatusMessage kind="loading" text={copy.a11y.loadingStatus} />;
    case "error":
      return (
        <StatusMessage
          kind="error"
          text={copy.signIn.serviceFailure}
          actionLabel={copy.signIn.retry}
          onAction={session.retry}
        />
      );
    case "signed-out": {
      const next = `${location.pathname}${location.search}`;
      // An explicit sign-out adds a history entry; everything else replaces the guarded one.
      return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace={!explicitSignOut} />;
    }
    case "signed-in":
      // Toasts outlive page changes: "Request submitted." is shown after navigating to details.
      return (
        <ToastProvider>
          <Shell />
        </ToastProvider>
      );
  }
}
