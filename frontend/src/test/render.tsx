import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "../App";
import { AppRoutes } from "../routes/AppRoutes";

export function renderApp(initialEntry = "/requests") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}
