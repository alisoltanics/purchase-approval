import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../../App";
import { copy, fill } from "../../copy";
import { ALEX } from "../../mocks/data";
import { errorResponse, resetMockSession, submissionLog } from "../../mocks/handlers";
import { server } from "../../mocks/server";
import { AppRoutes } from "../AppRoutes";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderForm(entry: string | { pathname: string; state: unknown } = "/requests/new") {
  resetMockSession(ALEX.id);
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <AppRoutes />
        <LocationProbe />
      </AppProviders>
    </MemoryRouter>,
  );
}

const f = copy.newRequest;
const here = () => screen.getByTestId("location").textContent;
const titleField = () => screen.getByLabelText(f.titleLabel);
const vendorField = () => screen.getByLabelText(f.vendorLabel);
const amountField = () => screen.getByLabelText(f.amountLabel);
const descriptionField = () => screen.getByLabelText(f.descriptionLabel);
const submitButton = () => screen.getByRole("button", { name: f.submit });
const cancelButton = () => screen.getByRole("button", { name: f.cancel });

async function openForm(entry?: Parameters<typeof renderForm>[0]) {
  renderForm(entry);
  await screen.findByRole("heading", { name: f.title });
}

// pasting is quick for long text; typing is used where keystrokes matter
async function fill_(field: HTMLElement, text: string) {
  await userEvent.click(field);
  await userEvent.paste(text);
}

async function fillValid(overrides: Partial<Record<"title" | "vendor" | "amount" | "description", string>> = {}) {
  const input = {
    title: "Standing desk",
    vendor: "Ergo Supply",
    amount: "25.5",
    description: "Needed for the new hire.",
    ...overrides,
  };
  await fill_(titleField(), input.title);
  await fill_(vendorField(), input.vendor);
  await fill_(amountField(), input.amount);
  await fill_(descriptionField(), input.description);
  return input;
}

describe("the form (supplied design)", () => {
  it("opens as a dialog over the list at /requests/new", async () => {
    await openForm();
    const dialog = screen.getByRole("dialog", { name: f.title });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(f.subtitle)).toBeInTheDocument();
    // The list stays behind the dialog but is out of the accessibility tree.
    expect(screen.queryByRole("heading", { name: copy.requests.title })).not.toBeInTheDocument();
  });

  it("shows the design's labels, placeholders, USD label, hint, note and counter", async () => {
    await openForm();
    expect(titleField()).toHaveAttribute("placeholder", f.titlePlaceholder);
    expect(vendorField()).toHaveAttribute("placeholder", f.vendorPlaceholder);
    expect(amountField()).toHaveAttribute("placeholder", f.amountPlaceholder);
    expect(amountField()).toHaveAttribute("inputmode", "decimal");
    expect(descriptionField()).toHaveAttribute("placeholder", f.descriptionPlaceholder);
    expect(screen.getByText(f.currencyLabel)).toBeInTheDocument();
    expect(screen.getByText(f.amountHint)).toBeInTheDocument();
    expect(amountField()).toHaveAccessibleDescription(f.amountHint);
    expect(screen.getByText(f.note)).toBeInTheDocument();
    expect(screen.getByText(fill(f.descriptionCounter, { count: "0" }))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: f.closeLabel })).toBeInTheDocument();
  });

  it("puts the cursor in the first field", async () => {
    await openForm();
    expect(titleField()).toHaveFocus();
  });

  it("counts the description in characters, not UTF-16 units", async () => {
    await openForm();
    await fill_(descriptionField(), "a\u{1f600}b");
    expect(screen.getByText(fill(f.descriptionCounter, { count: "3" }))).toBeInTheDocument();
  });
});

describe("validation", () => {
  it("shows all four required errors inline, links them, and focuses the first field", async () => {
    await openForm();
    await userEvent.click(submitButton());
    expect(await screen.findByText(copy.validation.title.required)).toBeInTheDocument();
    expect(screen.getByText(copy.validation.vendor.required)).toBeInTheDocument();
    expect(screen.getByText(copy.validation.amount.required)).toBeInTheDocument();
    expect(screen.getByText(copy.validation.description.required)).toBeInTheDocument();
    for (const field of [titleField(), vendorField(), amountField(), descriptionField()]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
    }
    expect(titleField()).toHaveAccessibleDescription(copy.validation.title.required);
    expect(titleField()).toHaveFocus();
    expect(submissionLog).toHaveLength(0);
  });

  it("focuses the first invalid field when only a later one is invalid", async () => {
    await openForm();
    await fillValid({ amount: "abc" });
    await userEvent.click(submitButton());
    expect(await screen.findByText(copy.validation.amount.invalidFormat)).toBeInTheDocument();
    expect(amountField()).toHaveFocus();
    expect(titleField()).not.toHaveAttribute("aria-invalid");
  });

  it("treats whitespace-only text as missing", async () => {
    await openForm();
    await fillValid({ title: "   " });
    await userEvent.click(submitButton());
    expect(await screen.findByText(copy.validation.title.required)).toBeInTheDocument();
    expect(titleField()).toHaveFocus();
  });

  it.each([
    ["title", "x".repeat(121), "120"],
    ["vendor", "x".repeat(121), "120"],
    ["description", "x".repeat(2001), "2000"],
  ] as const)("rejects a %s over the limit with the limit in the message", async (field, text, max) => {
    await openForm();
    await fillValid({ [field]: text });
    await userEvent.click(submitButton());
    expect(
      await screen.findByText(fill(copy.validation[field].tooLong, { max })),
    ).toBeInTheDocument();
  });

  it("counts 120 emoji as 120 characters", async () => {
    await openForm();
    await fillValid({ title: "\u{1f600}".repeat(120) });
    await userEvent.click(submitButton());
    await waitFor(() => expect(submissionLog).toHaveLength(1));
    await openForm();
    await fillValid({ title: "\u{1f600}".repeat(121) });
    await userEvent.click(submitButton());
    expect(await screen.findByText(fill(copy.validation.title.tooLong, { max: "120" }))).toBeInTheDocument();
  });

  it("asks for a single line in title and vendor", async () => {
    await openForm();
    // A text input strips "\n" on its own, so a control character stands in for a line break.
    await fillValid({ vendor: "Line one\u0007Line two" });
    await userEvent.click(submitButton());
    expect(await screen.findByText(copy.validation.vendor.invalidCharacters)).toBeInTheDocument();
    expect(vendorField()).toHaveFocus();
  });

  it.each([
    ["25.999", copy.validation.amount.tooManyDecimals],
    ["0", copy.validation.amount.outOfRange],
    ["1000000", copy.validation.amount.outOfRange],
    ["$5", copy.validation.amount.invalidFormat],
    ["1,000", copy.validation.amount.invalidFormat],
    ["-5", copy.validation.amount.invalidFormat],
  ])("rejects the amount %s", async (amount, message) => {
    await openForm();
    await fillValid({ amount });
    await userEvent.click(submitButton());
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(submissionLog).toHaveLength(0);
  });

  it("clears an error after the value is corrected and submitted", async () => {
    await openForm();
    await fillValid({ amount: "abc" });
    await userEvent.click(submitButton());
    await screen.findByText(copy.validation.amount.invalidFormat);
    await userEvent.clear(amountField());
    await userEvent.type(amountField(), "12.50");
    await userEvent.click(submitButton());
    await waitFor(() => expect(here()).toMatch(/^\/requests\/[0-9a-f-]{36}$/));
    expect(submissionLog).toHaveLength(1);
  });
});

describe("submitting", () => {
  it("sends trimmed text and a two-decimal amount with an Idempotency-Key, then opens the request", async () => {
    await openForm();
    await fillValid({ title: "  Standing desk  ", amount: " 25.5 ", description: "  Needed.  " });
    await userEvent.click(submitButton());
    await waitFor(() => expect(here()).toMatch(/^\/requests\/[0-9a-f-]{36}$/));
    expect(submissionLog).toHaveLength(1);
    expect(submissionLog[0]?.payload).toEqual({
      title: "Standing desk",
      vendor: "Ergo Supply",
      amount: "25.50",
      description: "Needed.",
    });
    expect(submissionLog[0]?.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("shows 'Request submitted.' on the details page, as its own text", async () => {
    await openForm();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByText(f.submitted)).toBeInTheDocument();
    expect(screen.getByText(f.submittedNote)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(`${f.submitted} ${f.submittedNote}`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the new request in the list afterwards", async () => {
    await openForm();
    await fillValid({ title: "Brand new thing" });
    await userEvent.click(submitButton());
    await waitFor(() => expect(here()).toMatch(/^\/requests\/[0-9a-f-]{36}$/));
    await userEvent.click(screen.getByRole("link", { name: copy.shell.navRequests }));
    expect(await screen.findByText("Brand new thing")).toBeInTheDocument();
  });

  it("disables the button, shows progress, and sends one request however often it is clicked", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post("/api/requests/", async () => {
        await gate;
        return errorResponse(500, "server_error");
      }),
    );
    await openForm();
    await fillValid();
    await userEvent.click(submitButton());
    const busy = await screen.findByRole("button", { name: f.submitting });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    await userEvent.dblClick(busy);
    await userEvent.type(descriptionField(), "{Control>}{Enter}{/Control}");
    release();
    await screen.findByText(f.submitFailure);
  });

  it("sends exactly one request when the button is double-clicked", async () => {
    await openForm();
    await fillValid();
    await userEvent.dblClick(submitButton());
    await waitFor(() => expect(here()).toMatch(/^\/requests\/[0-9a-f-]{36}$/));
    expect(submissionLog).toHaveLength(1);
  });

  it("keeps the entries and offers a retry after a lost response, and the retry reuses the key", async () => {
    let attempts = 0;
    server.use(
      http.post("/api/requests/", () => {
        attempts += 1;
        return HttpResponse.error();
      }),
    );
    await openForm();
    const input = await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(f.submitFailure);
    expect(attempts).toBe(1);
    expect(titleField()).toHaveValue(input.title);
    expect(vendorField()).toHaveValue(input.vendor);
    expect(amountField()).toHaveValue(input.amount);
    expect(descriptionField()).toHaveValue(input.description);
    expect(screen.queryByText(f.submitted)).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();

    server.resetHandlers();
    await userEvent.click(submitButton());
    await waitFor(() => expect(here()).toMatch(/^\/requests\/[0-9a-f-]{36}$/));
    expect(submissionLog).toHaveLength(1);
  });

  it("uses the same Idempotency-Key for every attempt of one form", async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post("/api/requests/", ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return errorResponse(500, "server_error");
      }),
    );
    await openForm();
    await fillValid();
    await userEvent.click(submitButton());
    await screen.findByText(f.submitFailure);
    await userEvent.click(submitButton());
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
  });

  it("shows a retryable error for a server error and never reports success", async () => {
    server.use(http.post("/api/requests/", () => errorResponse(500, "server_error")));
    await openForm();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(f.submitFailure);
    expect(here()).toBe("/requests/new");
    expect(screen.queryByText(f.submitted)).not.toBeInTheDocument();
    expect(titleField()).toHaveValue("Standing desk");
  });

  it("explains a reused key with different values", async () => {
    server.use(http.post("/api/requests/", () => errorResponse(409, "idempotency_conflict")));
    await openForm();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(f.duplicateKeyConflict);
  });

  it("shows field errors reported by the server inline and focuses the first", async () => {
    server.use(
      http.post("/api/requests/", () =>
        errorResponse(400, "validation_error", {
          fields: {
            vendor: [{ code: "too_long", message: "x" }],
            amount: [{ code: "out_of_range", message: "x" }],
          },
        }),
      ),
    );
    await openForm();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByText(fill(copy.validation.vendor.tooLong, { max: "120" }))).toBeInTheDocument();
    expect(screen.getByText(copy.validation.amount.outOfRange)).toBeInTheDocument();
    expect(vendorField()).toHaveFocus();
  });

  it("sends a lost session to sign-in without reporting success (AC-30)", async () => {
    server.use(http.post("/api/requests/", () => errorResponse(401, "not_authenticated")));
    await openForm();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole("heading", { name: copy.signIn.title })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(copy.session.expired);
    expect(screen.queryByText(f.submitted)).not.toBeInTheDocument();
  });
});

describe("leaving the form", () => {
  it("cancels an untouched form without asking and returns to the list", async () => {
    await openForm();
    await userEvent.click(cancelButton());
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
    expect(here()).toBe("/requests");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns to the list state the form was opened from", async () => {
    await openForm({
      pathname: "/requests/new",
      state: { listSearch: "?status=approved" },
    });
    await userEvent.click(cancelButton());
    await waitFor(() => expect(here()).toBe("/requests?status=approved"));
  });

  it("closes through the X button the same way", async () => {
    await openForm();
    await userEvent.click(screen.getByRole("button", { name: f.closeLabel }));
    await waitFor(() => expect(here()).toBe("/requests"));
  });

  it("closes an untouched form with Escape", async () => {
    await openForm();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(here()).toBe("/requests"));
  });

  it("asks before discarding changes, and Keep editing preserves every value", async () => {
    await openForm();
    const input = await fillValid();
    await userEvent.click(cancelButton());
    const discard = await screen.findByRole("dialog", { name: f.discardTitle });
    expect(within(discard).getByText(f.discardBody)).toBeInTheDocument();
    await userEvent.click(within(discard).getByRole("button", { name: f.discardKeepEditing }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: f.discardTitle })).not.toBeInTheDocument());
    expect(here()).toBe("/requests/new");
    expect(titleField()).toHaveValue(input.title);
    expect(vendorField()).toHaveValue(input.vendor);
    expect(amountField()).toHaveValue(input.amount);
    expect(descriptionField()).toHaveValue(input.description);
  });

  it("discards the changes, leaves, and creates no request", async () => {
    await openForm();
    await fillValid();
    await userEvent.click(cancelButton());
    const discard = await screen.findByRole("dialog", { name: f.discardTitle });
    await userEvent.click(within(discard).getByRole("button", { name: f.discardConfirm }));
    await waitFor(() => expect(here()).toBe("/requests"));
    expect(submissionLog).toHaveLength(0);
    expect(await screen.findByRole("heading", { name: copy.requests.title })).toBeInTheDocument();
  });

  it("asks first when Escape is pressed on a changed form", async () => {
    await openForm();
    await fillValid();
    await userEvent.keyboard("{Escape}");
    expect(await screen.findByRole("dialog", { name: f.discardTitle })).toBeInTheDocument();
    expect(here()).toBe("/requests/new");
  });

  it("closes only the discard dialog on Escape and keeps the form", async () => {
    await openForm();
    const input = await fillValid();
    await userEvent.click(cancelButton());
    await screen.findByRole("dialog", { name: f.discardTitle });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: f.discardTitle })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: f.title })).toBeInTheDocument();
    expect(titleField()).toHaveValue(input.title);
  });

  it("does not leave while a submission is in progress", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post("/api/requests/", async () => {
        await gate;
        return errorResponse(500, "server_error");
      }),
    );
    await openForm();
    await fillValid();
    await userEvent.click(submitButton());
    await screen.findByRole("button", { name: f.submitting });
    await userEvent.click(cancelButton());
    await userEvent.keyboard("{Escape}");
    expect(here()).toBe("/requests/new");
    expect(screen.queryByRole("dialog", { name: f.discardTitle })).not.toBeInTheDocument();
    release();
    await screen.findByText(f.submitFailure);
  });

  it("keeps focus inside the dialog when tabbing", async () => {
    await openForm();
    const dialog = screen.getByRole("dialog", { name: f.title });
    for (let step = 0; step < 12; step += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});
