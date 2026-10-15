import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../../App";
import { useApi } from "../../api/ApiProvider";
import { copy } from "../../copy";
import { ALEX, PASSWORD } from "../../mocks/data";
import { errorResponse, resetMockSession, sessionState } from "../../mocks/handlers";
import { server } from "../../mocks/server";
import { renderApp } from "../../test/render";
import { LoginRoute } from "../LoginRoute";
import { RequireSession } from "../RequireSession";

const emailField = () => screen.getByLabelText(copy.signIn.email);
const passwordField = () => screen.getByLabelText(copy.signIn.password);
const submitButton = () => screen.getByRole("button", { name: copy.signIn.submit });

async function openSignIn(path = "/login") {
  renderApp(path);
  await screen.findByRole("heading", { name: copy.signIn.title });
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(emailField(), email);
  if (password) await user.type(passwordField(), password);
  await user.click(submitButton());
}

describe("sign-in page content (supplied design)", () => {
  it("shows the design's text, placeholders and product name", async () => {
    await openSignIn();
    expect(screen.getByText(copy.product.name)).toBeInTheDocument();
    expect(screen.getByText(copy.signIn.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(copy.signIn.title);
    // Testing Library collapses the line break to a space; CSS (pre-line) keeps it on screen.
    expect(screen.getByText(copy.signIn.intro.replace("\n", " "))).toBeInTheDocument();
    expect(emailField()).toHaveAttribute("placeholder", copy.signIn.emailPlaceholder);
    expect(passwordField()).toHaveAttribute("placeholder", copy.signIn.passwordPlaceholder);
    expect(screen.getByText(copy.signIn.accessNote)).toBeInTheDocument();
    expect(screen.getByText(copy.signIn.footer)).toBeInTheDocument();
    expect(emailField()).toHaveAttribute("type", "email");
    expect(passwordField()).toHaveAttribute("type", "password");
  });

  it("offers no link: no signup, no recovery, no prototype control", async () => {
    await openSignIn();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("keeps the decorative panel out of the accessibility tree", async () => {
    await openSignIn();
    const art = copy.signIn.art;
    expect(screen.getByText(art.title).closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText(art.reference).closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText(art.approved, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(art.currency)).toBeInTheDocument();
  });

  it("shows no message on a first visit", async () => {
    await openSignIn();
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });
});

describe("sign-in validation", () => {
  it("flags both empty fields inline, links the errors, and focuses the first", async () => {
    let calls = 0;
    server.use(
      http.post("/api/auth/login/", () => {
        calls += 1;
        return errorResponse(401, "invalid_credentials");
      }),
    );
    await openSignIn();
    await userEvent.click(submitButton());

    expect(await screen.findByText(copy.signIn.emailRequired)).toBeInTheDocument();
    expect(screen.getByText(copy.signIn.passwordRequired)).toBeInTheDocument();
    expect(emailField()).toHaveAccessibleDescription(copy.signIn.emailRequired);
    expect(passwordField()).toHaveAccessibleDescription(copy.signIn.passwordRequired);
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).toHaveAttribute("aria-invalid", "true");
    expect(emailField()).toHaveFocus();
    expect(calls).toBe(0);
  });

  it("treats a blank-only email as missing", async () => {
    await openSignIn();
    await fillAndSubmit("   ", "secret");
    expect(await screen.findByText(copy.signIn.emailRequired)).toBeInTheDocument();
    expect(screen.queryByText(copy.signIn.passwordRequired)).not.toBeInTheDocument();
  });

  it("keeps the email and focuses the password when only the password is missing", async () => {
    await openSignIn();
    await fillAndSubmit(ALEX.email, "");
    expect(await screen.findByText(copy.signIn.passwordRequired)).toBeInTheDocument();
    expect(screen.queryByText(copy.signIn.emailRequired)).not.toBeInTheDocument();
    expect(emailField()).toHaveValue(ALEX.email);
    expect(emailField()).not.toHaveAttribute("aria-invalid");
    expect(emailField()).not.toHaveAccessibleDescription(copy.signIn.emailRequired);
    expect(passwordField()).toHaveFocus();
  });

  it("clears a field error once the field is valid on the next attempt", async () => {
    await openSignIn();
    const user = userEvent.setup();
    await user.click(submitButton());
    await screen.findByText(copy.signIn.emailRequired);
    await user.type(emailField(), ALEX.email);
    await user.type(passwordField(), "wrong-password");
    await user.click(submitButton());
    await screen.findByText(copy.signIn.invalidCredentials);
    expect(screen.queryByText(copy.signIn.emailRequired)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.signIn.passwordRequired)).not.toBeInTheDocument();
  });

  it("shows server-side field errors from the error format inline", async () => {
    server.use(
      http.post("/api/auth/login/", () =>
        errorResponse(400, "validation_error", {
          fields: { password: [{ code: "required", message: "Required." }] },
        }),
      ),
    );
    await openSignIn();
    await fillAndSubmit(ALEX.email, "x");
    expect(await screen.findByText(copy.signIn.passwordRequired)).toBeInTheDocument();
    expect(passwordField()).toHaveAttribute("aria-invalid", "true");
  });
});

describe("signing in", () => {
  it("signs in and lands on the requests list", async () => {
    await openSignIn();
    await fillAndSubmit(ALEX.email, PASSWORD);
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.shell.signOut })).toBeInTheDocument();
  });

  it("returns to a safe ?next= target after signing in (AC-03)", async () => {
    await openSignIn(`/login?next=${encodeURIComponent("/requests/new")}`);
    await fillAndSubmit(ALEX.email, PASSWORD);
    expect(await screen.findByRole("heading", { name: copy.newRequest.title })).toBeInTheDocument();
  });

  it("ignores an unsafe ?next= target after signing in", async () => {
    await openSignIn(`/login?next=${encodeURIComponent("//evil.example/path")}`);
    await fillAndSubmit(ALEX.email, PASSWORD);
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
  });

  it("redirects a signed-in visitor away from sign-in", async () => {
    resetMockSession(ALEX.id);
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
  });

  it("sends the email trimmed and the password exactly as typed", async () => {
    let body: { email?: string; password?: string } = {};
    server.use(
      http.post("/api/auth/login/", async ({ request }) => {
        body = (await request.json()) as typeof body;
        return errorResponse(401, "invalid_credentials");
      }),
    );
    await openSignIn();
    await fillAndSubmit("  Alex@Northstar.Example\t", "  spaced pass  ");
    await screen.findByText(copy.signIn.invalidCredentials);
    expect(body.email).toBe("Alex@Northstar.Example");
    expect(body.password).toBe("  spaced pass  ");
  });

  it("shows the generic message and keeps both entries after a refusal (AC-02)", async () => {
    await openSignIn();
    await fillAndSubmit(ALEX.email, "wrong-password");
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.signIn.invalidCredentials);
    expect(emailField()).toHaveValue(ALEX.email);
    expect(passwordField()).toHaveValue("wrong-password");
    expect(screen.getByRole("heading", { name: copy.signIn.title })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.shell.signOut })).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it("gives an unknown email the same message as a wrong password", async () => {
    await openSignIn();
    await fillAndSubmit("nobody@northstar.example", PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.signIn.invalidCredentials);
    expect(emailField()).toHaveValue("nobody@northstar.example");
  });

  it("tells the user to wait when sign-in is throttled, keeping both entries", async () => {
    server.use(http.post("/api/auth/login/", () => errorResponse(429, "throttled")));
    await openSignIn();
    await fillAndSubmit(ALEX.email, PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.signIn.throttled);
    expect(emailField()).toHaveValue(ALEX.email);
    expect(passwordField()).toHaveValue(PASSWORD);
    expect(submitButton()).toBeEnabled();
  });

  it("shows progress on the button, disables it, and sends one request while submitting", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    server.use(
      http.post("/api/auth/login/", async () => {
        calls += 1;
        await gate;
        sessionState.userId = ALEX.id;
        return HttpResponse.json(ALEX);
      }),
    );
    await openSignIn();
    const user = userEvent.setup();
    await user.type(emailField(), ALEX.email);
    await user.type(passwordField(), PASSWORD);
    await user.click(submitButton());

    const busy = await screen.findByRole("button", { name: copy.signIn.submitting });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    await user.click(busy);
    await user.type(passwordField(), "{Enter}");
    expect(calls).toBe(1);

    release();
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it("shows the service-failure text for a server error, keeps the values, and can be retried", async () => {
    server.use(http.post("/api/auth/login/", () => errorResponse(500, "server_error")));
    await openSignIn();
    await fillAndSubmit(ALEX.email, PASSWORD);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.signIn.serviceFailure);
    expect(alert).not.toHaveTextContent(copy.signIn.invalidCredentials);
    expect(emailField()).toHaveValue(ALEX.email);
    expect(passwordField()).toHaveValue(PASSWORD);
    expect(submitButton()).toBeEnabled();

    server.resetHandlers();
    await userEvent.click(submitButton());
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
  });

  it("treats a network failure as a service failure, not as a wrong password", async () => {
    server.use(http.post("/api/auth/login/", () => HttpResponse.error()));
    await openSignIn();
    await fillAndSubmit(ALEX.email, PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.signIn.serviceFailure);
    expect(submitButton()).toBeEnabled();
  });

  it("treats a failed CSRF check as a service failure", async () => {
    server.use(http.post("/api/auth/login/", () => errorResponse(403, "csrf_failed")));
    await openSignIn();
    await fillAndSubmit(ALEX.email, PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.signIn.serviceFailure);
  });

  it("never prints the password into the page", async () => {
    await openSignIn();
    await fillAndSubmit(ALEX.email, "wrong-password-xyz");
    await screen.findByText(copy.signIn.invalidCredentials);
    expect(document.body.textContent).not.toContain("wrong-password-xyz");
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

function renderExpiryApp() {
  resetMockSession(ALEX.id);
  render(
    <MemoryRouter initialEntries={["/requests"]}>
      <AppProviders>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<RequireSession />}>
            <Route path="/requests" element={<ExpiryProbe />} />
          </Route>
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("session notices", () => {
  it("explains a session that ended during use, in the error box (AC-30)", async () => {
    renderExpiryApp();
    const probe = await screen.findByRole("button", { name: "probe" });
    resetMockSession(null);
    await userEvent.click(probe);

    expect(await screen.findByRole("heading", { name: copy.signIn.title })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(copy.session.expired);
  });

  it("replaces the expiry message on the next sign-in attempt", async () => {
    renderExpiryApp();
    const probe = await screen.findByRole("button", { name: "probe" });
    resetMockSession(null);
    await userEvent.click(probe);
    await screen.findByText(copy.session.expired);

    await fillAndSubmit(ALEX.email, "wrong-password");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(copy.signIn.invalidCredentials),
    );
    expect(screen.queryByText(copy.session.expired)).not.toBeInTheDocument();
  });

  it("shows no message after an explicit sign-out", async () => {
    resetMockSession(ALEX.id);
    renderApp("/requests");
    await userEvent.click(await screen.findByRole("button", { name: copy.shell.signOut }));
    await screen.findByRole("heading", { name: copy.signIn.title });
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("drops the expiry message after a successful sign-in", async () => {
    renderExpiryApp();
    const probe = await screen.findByRole("button", { name: "probe" });
    resetMockSession(null);
    await userEvent.click(probe);
    await screen.findByText(copy.session.expired);
    await fillAndSubmit(ALEX.email, PASSWORD);
    expect(await screen.findByRole("button", { name: "probe" })).toBeInTheDocument();
    resetMockSession(null);
    await userEvent.click(screen.getByRole("button", { name: "probe" }));
    expect(await screen.findByText(copy.session.expired)).toBeInTheDocument();
  });
});
