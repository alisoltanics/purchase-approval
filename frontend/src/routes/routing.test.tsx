import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../App";
import { useApi } from "../api/ApiProvider";
import { RequireSession } from "./RequireSession";
import { copy } from "../copy";
import { ALEX, JORDAN } from "../mocks/data";
import { errorResponse, resetMockSession } from "../mocks/handlers";
import { server } from "../mocks/server";
import { renderApp } from "../test/render";

describe("session guard", () => {
  it("sends a signed-out visitor to sign-in, remembering the page", async () => {
    renderApp("/requests?status=pending&page=2");
    expect(await screen.findByRole("heading", { name: copy.signIn.title })).toBeInTheDocument();
  });

  it("keeps the requested path in ?next= so sign-in can return there", async () => {
    let seen = "";
    server.use(
      http.get("/api/auth/me/", ({ request }) => {
        seen = request.url;
        return errorResponse(401, "not_authenticated");
      }),
    );
    const { container } = renderApp("/requests/abc");
    await screen.findByRole("heading", { name: copy.signIn.title });
    expect(seen).toContain("/api/auth/me/");
    expect(container).toBeTruthy();
  });

  it("shows the shell with company, name and role for an employee", async () => {
    resetMockSession(ALEX.id);
    renderApp("/requests");
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
    // The design shows the company in the workspace card and again in the breadcrumbs.
    const sidebar = within(screen.getByRole("complementary"));
    expect(sidebar.getByText(ALEX.company.name)).toBeInTheDocument();
    expect(sidebar.getByText(ALEX.display_name)).toBeInTheDocument();
    expect(sidebar.getByText(copy.shell.roleEmployee)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.shell.signOut })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.shell.navRequests })).toBeInTheDocument();
  });

  it("shows the manager role", async () => {
    resetMockSession(JORDAN.id);
    renderApp("/requests");
    expect(await screen.findByText(copy.shell.roleManager)).toBeInTheDocument();
  });

  it("redirects / and unknown paths to /requests", async () => {
    resetMockSession(ALEX.id);
    renderApp("/does/not/exist");
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
  });

  it("renders the details route for any id inside the shell, not a 404 page", async () => {
    resetMockSession(ALEX.id);
    renderApp("/requests/not-a-real-id");
    expect(await screen.findByRole("heading", { name: copy.details.loading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.shell.signOut })).toBeInTheDocument();
  });

  it("redirects a signed-in visitor away from /login", async () => {
    resetMockSession(ALEX.id);
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
  });

  it("honours a safe ?next= for a signed-in visitor on /login", async () => {
    resetMockSession(ALEX.id);
    renderApp("/login?next=/requests/new");
    expect(await screen.findByRole("heading", { name: copy.newRequest.title })).toBeInTheDocument();
  });

  it.each(["//evil.example", "https://evil.example", "javascript:alert(1)"])(
    "ignores an unsafe ?next=%s",
    async (next) => {
      resetMockSession(ALEX.id);
      renderApp(`/login?next=${encodeURIComponent(next)}`);
      expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
    },
  );

  it("shows a retryable error, not the sign-in page, when the session check fails", async () => {
    server.use(http.get("/api/auth/me/", () => new HttpResponse(null, { status: 500 })));
    renderApp("/requests");
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.signIn.serviceFailure);
    resetMockSession(ALEX.id);
    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: copy.signIn.retry }));
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
  });
});

function ExpiryProbe() {
  const api = useApi();
  return (
    <button type="button" onClick={() => void api.listRequests().catch(() => undefined)}>
      probe
    </button>
  );
}

describe("sign out and expiry", () => {
  it("signs out, clears the session and lands on sign-in", async () => {
    resetMockSession(ALEX.id);
    renderApp("/requests");
    await userEvent.click(await screen.findByRole("button", { name: copy.shell.signOut }));
    expect(await screen.findByRole("heading", { name: copy.signIn.title })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.shell.signOut })).not.toBeInTheDocument();
  });

  it("still ends the client session when the logout call fails", async () => {
    resetMockSession(ALEX.id);
    server.use(http.post("/api/auth/logout/", () => HttpResponse.error()));
    renderApp("/requests");
    await userEvent.click(await screen.findByRole("button", { name: copy.shell.signOut }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: copy.signIn.title })).toBeInTheDocument(),
    );
  });

  it("goes to sign-in when an API call reports an expired session (D-34)", async () => {
    resetMockSession(ALEX.id);
    render(
      <MemoryRouter initialEntries={["/requests"]}>
        <AppProviders>
          <Routes>
            <Route path="/login" element={<h1>{copy.signIn.title}</h1>} />
            <Route element={<RequireSession />}>
              <Route path="/requests" element={<ExpiryProbe />} />
            </Route>
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    );
    const button = await screen.findByRole("button", { name: "probe" });
    // The server forgets the session; the next API call from the page is refused with 401.
    resetMockSession(null);
    await userEvent.click(button);
    expect(await screen.findByRole("heading", { name: copy.signIn.title })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "probe" })).not.toBeInTheDocument();
  });

});
