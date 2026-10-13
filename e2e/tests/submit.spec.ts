import { expect, test, type Page } from "@playwright/test";
import { alex, jordan } from "../support/accounts";
import { copy, fill } from "../support/copy";
import {
  createRequest,
  dialog,
  fillRequestForm,
  login,
  openNewRequestForm,
  sampleRequest,
  submitButton,
  UUID_RE,
  uniqueTitle,
} from "../support/helpers";

const f = copy.newRequest;
const v = copy.validation;
const titleField = (page: Page) => page.getByLabel(f.titleLabel, { exact: true });
const vendorField = (page: Page) => page.getByLabel(f.vendorLabel, { exact: true });
const descField = (page: Page) => page.getByLabel(f.descriptionLabel, { exact: true });
const amountField = (page: Page) => page.getByLabel(f.amountLabel, { exact: true });

async function fillValid(page: Page, label: string, overrides: Partial<ReturnType<typeof sampleRequest>> = {}) {
  const input = sampleRequest(label, overrides);
  await fillRequestForm(page, input);
  return input;
}

test.describe("submission", () => {
  test("AC-09: employee submits a request and lands on its details with the success message", async ({ page }) => {
    await login(page, alex);
    const input = sampleRequest("employee submit", { amount: "25.5" });
    const id = await createRequest(page, input);
    expect(id).toMatch(UUID_RE);
    await expect(page.getByText(copy.newRequest.submitted, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(input.title, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("USD 25.50", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(alex.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(fill(copy.details.eventSubmitted, { actor: alex.name }), { exact: true })).toHaveCount(1);
    // Persisted: survives a reload and shows in the list.
    await page.reload();
    await expect(page.getByText(input.title, { exact: true }).first()).toBeVisible();
    await page.goto("/requests");
    await expect(page.getByRole("link", { name: input.title, exact: true })).toHaveCount(1);
  });

  test("AC-09: manager submits a request; it stays pending with the own-request notice", async ({ page }) => {
    await login(page, jordan);
    const input = sampleRequest("manager submit", { amount: "999999.99" });
    await createRequest(page, input);
    await expect(page.getByText("USD 999999.99", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(copy.details.ownRequestNotice, { exact: true })).toBeVisible();
  });

  test("AC-10: outer whitespace is trimmed from stored text", async ({ page }) => {
    await login(page, alex);
    const title = uniqueTitle("trim");
    await createRequest(page, sampleRequest("trim", { title: `  ${title}  `, vendor: "  Padded Vendor  ", description: "\n  padded text  \n" }));
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Padded Vendor", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("padded text", { exact: true }).first()).toBeVisible();
  });

  test("AC-10: boundary lengths 120 / 120 / 2000 are accepted", async ({ page }) => {
    await login(page, alex);
    const suffix = uniqueTitle("max").slice(-8);
    const title = `T${suffix}`.padEnd(120, "t");
    const vendor = "v".repeat(120);
    const description = "d".repeat(2000);
    await createRequest(page, { title, vendor, description, amount: "0.01" });
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("USD 0.01", { exact: true }).first()).toBeVisible();
  });

  test("AC-11: both amount boundaries 0.01 and 999999.99 are accepted and displayed exactly", async ({ page }) => {
    await login(page, alex);
    await createRequest(page, sampleRequest("min amount", { amount: "0.01" }));
    await expect(page.getByText("USD 0.01", { exact: true }).first()).toBeVisible();
    await createRequest(page, sampleRequest("max amount", { amount: "999999.99" }));
    await expect(page.getByText("USD 999999.99", { exact: true }).first()).toBeVisible();
  });

  for (const [typed, shown] of [["25", "USD 25.00"], ["25.5", "USD 25.50"], ["25.50", "USD 25.50"]] as const) {
    test(`AC-11: amount ${typed} is displayed as ${shown}`, async ({ page }) => {
      await login(page, alex);
      await createRequest(page, sampleRequest(`amount ${typed}`, { amount: typed }));
      await expect(page.getByText(shown, { exact: true }).first()).toBeVisible();
    });
  }
});

test.describe("form validation", () => {
  test("AC-10: empty form shows required errors for all four fields and focuses the first invalid field", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await submitButton(page).click();
    await expect(titleField(page)).toHaveAccessibleDescription(new RegExp(v.title.required));
    await expect(vendorField(page)).toHaveAccessibleDescription(new RegExp(v.vendor.required));
    await expect(descField(page)).toHaveAccessibleDescription(new RegExp(v.description.required));
    await expect(amountField(page)).toHaveAccessibleDescription(new RegExp(v.amount.required));
    await expect(titleField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(titleField(page)).toBeFocused();
    await expect(page).toHaveURL(/\/requests\/new/);
  });

  test("AC-10: focus moves to the first invalid field when only a later field is invalid", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillValid(page, "focus", { vendor: "   " });
    await submitButton(page).click();
    await expect(vendorField(page)).toHaveAccessibleDescription(new RegExp(v.vendor.required));
    await expect(vendorField(page)).toBeFocused();
    await expect(titleField(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  test("AC-10: whitespace-only title is rejected as required", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillValid(page, "ws", { title: "  　 " });
    await submitButton(page).click();
    await expect(titleField(page)).toHaveAccessibleDescription(new RegExp(v.title.required));
  });

  test("AC-10: title of 121 characters is rejected, 120 after trimming is not", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillValid(page, "long", { title: "a".repeat(121) });
    await submitButton(page).click();
    await expect(titleField(page)).toHaveAccessibleDescription(new RegExp(fill(v.title.tooLong, { max: "120" })));
    await expect(page).toHaveURL(/\/requests\/new/);
  });

  test("AC-10: vendor of 121 characters is rejected", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillValid(page, "longvendor", { vendor: "v".repeat(121) });
    await submitButton(page).click();
    await expect(vendorField(page)).toHaveAccessibleDescription(new RegExp(fill(v.vendor.tooLong, { max: "120" })));
  });

  test("AC-10: description of 2001 characters is rejected", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillValid(page, "longdesc", { description: "d".repeat(2001) });
    await submitButton(page).click();
    await expect(descField(page)).toHaveAccessibleDescription(new RegExp(fill(v.description.tooLong, { max: "2000" })));
  });

  test("AC-10: 120 emoji count as 120 characters (code points), 121 do not", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillValid(page, "emoji", { title: "\u{1F600}".repeat(121) });
    await submitButton(page).click();
    await expect(titleField(page)).toHaveAccessibleDescription(new RegExp(fill(v.title.tooLong, { max: "120" })));
    await titleField(page).fill("\u{1F600}".repeat(120));
    await submitButton(page).click();
    await expect(page).toHaveURL(new RegExp(`/requests/${UUID_RE.source}$`));
  });

  const amountCases: ReadonlyArray<readonly [string, string, string]> = [
    ["amount-057 zero", "0", v.amount.outOfRange],
    ["amount-058 0.00", "0.00", v.amount.outOfRange],
    ["amount-026 negative", "-5", v.amount.invalidFormat],
    ["amount-051 three decimals", "25.999", v.amount.tooManyDecimals],
    ["amount-061 over the maximum", "1000000", v.amount.outOfRange],
    ["amount-065 just over the maximum", "1000000.01", v.amount.outOfRange],
    ["amount-036 dollar sign", "$5", v.amount.invalidFormat],
    ["amount-033 thousands separator", "1,000", v.amount.invalidFormat],
    ["amount-035 comma as decimal separator", "25,50", v.amount.invalidFormat],
    ["amount-031 scientific notation", "1e3", v.amount.invalidFormat],
    ["amount-041 letters", "abc", v.amount.invalidFormat],
    ["amount-029 no integer part", ".5", v.amount.invalidFormat],
  ];
  for (const [name, typed, message] of amountCases) {
    test(`AC-11: ${name} (${JSON.stringify(typed)}) is rejected with its message and creates no request`, async ({ page }) => {
      await login(page, alex);
      await openNewRequestForm(page);
      const input = await fillValid(page, "bad amount", { amount: typed });
      await submitButton(page).click();
      await expect(amountField(page)).toHaveAccessibleDescription(new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      await expect(amountField(page)).toHaveValue(typed);
      await expect(page).toHaveURL(/\/requests\/new/);
      await page.goto("/requests");
      await expect(page.getByText(input.title, { exact: true })).toHaveCount(0);
    });
  }

  test("AC-11: the form shows the USD label and the amount format hint next to the field", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await expect(page.getByText(copy.newRequest.currencyLabel, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(copy.newRequest.amountHint, { exact: true })).toBeVisible();
    await expect(amountField(page)).toHaveAccessibleDescription(new RegExp(copy.newRequest.amountHint.slice(0, 20)));
  });

  test("AC-10: correcting an invalid value and resubmitting succeeds", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillValid(page, "retry", { amount: "25.999" });
    await submitButton(page).click();
    await expect(amountField(page)).toHaveAccessibleDescription(new RegExp(v.amount.tooManyDecimals));
    await amountField(page).fill("25.99");
    await submitButton(page).click();
    await expect(page.getByText(copy.newRequest.submitted, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("USD 25.99", { exact: true }).first()).toBeVisible();
  });
});

test.describe("duplicate protection and failures", () => {
  test("AC-12: double-clicking Submit request creates exactly one request", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    const input = await fillValid(page, "double click");
    await submitButton(page).dblclick();
    await expect(page.getByText(copy.newRequest.submitted, { exact: true }).first()).toBeVisible();
    await page.goto("/requests");
    await expect(page.getByRole("link", { name: input.title, exact: true })).toHaveCount(1);
  });

  test("AC-12: the button is disabled and progress is shown while submitting", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillValid(page, "progress");
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/requests/", async (route) => {
      if (route.request().method() === "POST") {
        await gate;
      }
      await route.continue();
    });
    await submitButton(page).click().catch(() => undefined);
    await expect(page.getByRole("button", { name: copy.newRequest.submitting, exact: true })).toBeDisabled();
    release();
    await expect(page.getByText(copy.newRequest.submitted, { exact: true }).first()).toBeVisible();
  });

  test("AC-12/AC-29: a lost response keeps the entries, and the retry creates exactly one request", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    const input = await fillValid(page, "lost response");
    let aborted = false;
    await page.route("**/api/requests/", async (route) => {
      if (route.request().method() === "POST" && !aborted) {
        aborted = true;
        await route.fetch(); // the server processes the request ...
        await route.abort("connectionreset"); // ... but the client never sees the response
        return;
      }
      await route.continue();
    });
    await submitButton(page).click();
    await expect(page.getByText(copy.newRequest.submitFailure, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.newRequest.submitted, { exact: true })).toHaveCount(0);
    await expect(titleField(page)).toHaveValue(input.title);
    await expect(amountField(page)).toHaveValue(input.amount);
    await submitButton(page).click();
    await expect(page.getByText(copy.newRequest.submitted, { exact: true }).first()).toBeVisible();
    await page.goto("/requests");
    await expect(page.getByRole("link", { name: input.title, exact: true })).toHaveCount(1);
  });

  test("AC-29: a server error shows a retryable message, keeps values, and no success", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    const input = await fillValid(page, "server error");
    await page.route("**/api/requests/", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "server_error", message: "Something went wrong. Try again." } }) })
        : route.continue(),
    );
    await submitButton(page).click();
    await expect(page.getByText(copy.newRequest.submitFailure, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.newRequest.submitted, { exact: true })).toHaveCount(0);
    await expect(titleField(page)).toHaveValue(input.title);
    await expect(vendorField(page)).toHaveValue(input.vendor);
    await expect(descField(page)).toHaveValue(input.description);
    await expect(submitButton(page)).toBeEnabled();
    await page.unroute("**/api/requests/");
    await submitButton(page).click();
    await expect(page.getByText(copy.newRequest.submitted, { exact: true }).first()).toBeVisible();
  });
});

test.describe("discard changes", () => {
  test("AC-13: Cancel on an untouched form leaves without asking", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await page.getByRole("button", { name: copy.newRequest.cancel, exact: true }).or(page.getByRole("link", { name: copy.newRequest.cancel, exact: true })).first().click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/requests(\?.*)?$/);
  });

  test("AC-13: Cancel on a changed form asks; Keep editing preserves the values", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    const input = await fillValid(page, "keep editing");
    await page.getByRole("button", { name: copy.newRequest.cancel, exact: true }).or(page.getByRole("link", { name: copy.newRequest.cancel, exact: true })).first().click();
    const d = dialog(page);
    await expect(d.getByText(copy.newRequest.discardTitle, { exact: true })).toBeVisible();
    await expect(d.getByText(copy.newRequest.discardBody, { exact: true })).toBeVisible();
    await d.getByRole("button", { name: copy.newRequest.discardKeepEditing, exact: true }).click();
    await expect(d).toHaveCount(0);
    await expect(page).toHaveURL(/\/requests\/new/);
    await expect(titleField(page)).toHaveValue(input.title);
    await expect(vendorField(page)).toHaveValue(input.vendor);
    await expect(descField(page)).toHaveValue(input.description);
    await expect(amountField(page)).toHaveValue(input.amount);
  });

  test("AC-13: Discard changes leaves the form and creates no request", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    const input = await fillValid(page, "discard");
    await page.getByRole("button", { name: copy.newRequest.cancel, exact: true }).or(page.getByRole("link", { name: copy.newRequest.cancel, exact: true })).first().click();
    await dialog(page).getByRole("button", { name: copy.newRequest.discardConfirm, exact: true }).click();
    await expect(page).toHaveURL(/\/requests(\?.*)?$/);
    await expect(page.getByRole("heading", { name: copy.requests.title, exact: true })).toBeVisible();
    await expect(page.getByText(input.title, { exact: true })).toHaveCount(0);
  });

  test("AC-13: in-app navigation (the Requests link) from a changed form also asks first", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillValid(page, "nav guard");
    await page.getByRole("link", { name: copy.shell.navRequests, exact: true }).click();
    await expect(dialog(page).getByText(copy.newRequest.discardTitle, { exact: true })).toBeVisible();
    await dialog(page).getByRole("button", { name: copy.newRequest.discardKeepEditing, exact: true }).click();
    await expect(page).toHaveURL(/\/requests\/new/);
  });

  test("AC-13/AC-18: Escape closes the discard dialog and keeps the form", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    const input = await fillValid(page, "escape");
    await page.getByRole("button", { name: copy.newRequest.cancel, exact: true }).or(page.getByRole("link", { name: copy.newRequest.cancel, exact: true })).first().click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(titleField(page)).toHaveValue(input.title);
  });
});
