import { Navigate, Route, Routes } from "react-router-dom";
import { LoginRoute } from "./LoginRoute";
import { RequireSession } from "./RequireSession";
import { NewRequestPage } from "./pages/NewRequestPage";
import { RequestDetailsPage } from "./pages/RequestDetailsPage";
import { RequestsListPage } from "./pages/RequestsListPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireSession />}>
        <Route path="/requests" element={<RequestsListPage />} />
        <Route path="/requests/new" element={<NewRequestPage />} />
        {/* Unknown ids render the neutral state inside the page, not a 404 route (plan 7.1). */}
        <Route path="/requests/:id" element={<RequestDetailsPage />} />
        <Route path="*" element={<Navigate to="/requests" replace />} />
      </Route>
    </Routes>
  );
}
