import { expect, test } from "@playwright/test";
import { alex, casey, demoAccounts, jordan, seed } from "../support/accounts";
import { copy } from "../support/copy";
import { demoPassword } from "../support/env";
import {
  fillRequestForm,
  fillSignIn,
  login,
  logout,
  openNewRequestForm,
  roleLabel,
  sampleRequest,
  selectStatusFilter,
  submitButton,
  submitSignIn,
  unavailable,
} from "../support/helpers";

test.describe("sign-in", () => {
  for (const account of demoAccounts) {
    test(`AC-01: ${account.name} (${account.role}) signs in and lands on Requests`, async ({ page }) => {
      await login(page, account);
      await expect(page).toHaveURL(/\/requests(\?.*)?$/);
      await expect(page.getByRole("heading", { name: copy.requests.title, exact: true })).toBeVisible();
      await expect(page.getByText(account.company, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(account.name, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(roleLabel(account), { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: copy.shell.signOut, exact: true })).toBeVisible();
    });
  }

  test("AC-01: sign-in screen has no signup or password recovery link", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: copy.signIn.title, exact: true })).toBeVisible();
    await expect(page.getByText(copy.product.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /sign ?up|register|forgot|reset password/i })).toHaveCount(0);
  });

  test("AC-02: wrong password shows the generic message and keeps the email", async ({ page }) => {
    await page.goto("/login");
    await fillSignIn(page, alex.email, `${demoPassword()}-wrong`);
    await submitSignIn(page);
    await expect(page.getByText(copy.signIn.invalidCredentials, { exact: true })).toBeVisible();
    await expect(page.getByLabel(copy.signIn.email, { exact: true })).toHaveValue(alex.email);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: copy.shell.signOut })).toHaveCount(0);
  });

  test("AC-02: unknown email shows the same generic message", async ({ page }) => {
    await page.goto("/login");
    await fillSignIn(page, "nobody@northstar.example", demoPassword());
    await submitSignIn(page);
    await expect(page.getByText(copy.signIn.invalidCredentials, { exact: true })).toBeVisible();
    await expect(page.getByLabel(copy.signIn.email, { exact: true })).toHaveValue("nobody@northstar.example");
  });

  test("AC-02: empty fields show required errors at the inputs", async ({ page }) => {
    await page.goto("/login");
    await submitSignIn(page);
    await expect(page.getByText(copy.signIn.emailRequired, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.signIn.passwordRequired, { exact: true })).toBeVisible();
    await expect(page.getByLabel(copy.signIn.email, { exact: true })).toHaveAccessibleDescription(copy.signIn.emailRequired);
    await expect(page.getByLabel(copy.signIn.password, { exact: true })).toHaveAccessibleDescription(copy.signIn.passwordRequired);
    await expect(page).toHaveURL(/\/login/);
  });

  test("AC-02: only the password missing keeps the email and flags the password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(copy.signIn.email, { exact: true }).fill(alex.email);
    await submitSignIn(page);
    await expect(page.getByText(copy.signIn.passwordRequired, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.signIn.emailRequired, { exact: true })).toHaveCount(0);
    await expect(page.getByLabel(copy.signIn.email, { exact: true })).toHaveValue(alex.email);
  });
});

test.describe("deep links", () => {
  test("AC-03: signed-out deep link to an accessible request returns to it after sign-in", async ({ page }) => {
    await page.goto(`/requests/${seed.N1.id}`);
    await expect(page).toHaveURL(/\/login/);
    await fillSignIn(page, alex.email, demoPassword());
    await submitSignIn(page);
    await expect(page).toHaveURL(new RegExp(`/requests/${seed.N1.id}$`));
    await expect(page.getByText(seed.N1.title, { exact: true }).first()).toBeVisible();
  });

  test("AC-03: signed-out deep link to another company's request shows the neutral state after sign-in", async ({ page }) => {
    await page.goto(`/requests/${seed.H1.id}`);
    await expect(page).toHaveURL(/\/login/);
    await fillSignIn(page, alex.email, demoPassword());
    await submitSignIn(page);
    await expect(unavailable(page)).toBeVisible();
    await expect(page.getByText(seed.H1.title)).toHaveCount(0);
    await expect(page.getByText(seed.H1.vendor)).toHaveCount(0);
  });

  test("AC-03: deep link to a colleague's request as an employee shows the neutral state", async ({ page }) => {
    await page.goto(`/requests/${seed.N3.id}`); // Sam's request, opened by Alex
    await fillSignIn(page, alex.email, demoPassword());
    await submitSignIn(page);
    await expect(unavailable(page)).toBeVisible();
    await expect(page.getByRole("link", { name: copy.details.backToRequests, exact: true })).toBeVisible();
  });

  test("AC-03: a manager signing in from a deep link sees the colleague's request", async ({ page }) => {
    await page.goto(`/requests/${seed.N3.id}`);
    await fillSignIn(page, jordan.email, demoPassword());
    await submitSignIn(page);
    await expect(page.getByText(seed.N3.title, { exact: true }).first()).toBeVisible();
  });

  test("AC-03: an unsafe next target is not followed after sign-in", async ({ page }) => {
    await page.goto(`/login?next=${encodeURIComponent("//evil.example/path")}`);
    await fillSignIn(page, alex.email, demoPassword());
    await submitSignIn(page);
    await expect(page).toHaveURL(/\/requests(\?.*)?$/);
    expect(new URL(page.url()).hostname).not.toBe("evil.example");
  });
});

test.describe("session", () => {
  test("AC-04: a refresh keeps the session", async ({ page }) => {
    await login(page, casey);
    await page.reload();
    await expect(page.getByRole("heading", { name: copy.requests.title, exact: true })).toBeVisible();
    await expect(page.getByText(casey.name, { exact: true }).first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("AC-04: after sign-out, Back shows sign-in and no private data", async ({ page }) => {
    await login(page, alex);
    await expect(page.getByText(seed.N1.title).first()).toBeVisible();
    await logout(page);
    await page.goBack();
    await expect(page.getByRole("button", { name: copy.signIn.submit, exact: true })).toBeVisible();
    await expect(page.getByText(seed.N1.title)).toHaveCount(0);
    await expect(page.getByText(alex.name, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: copy.shell.signOut })).toHaveCount(0);
  });

  test("AC-04: after sign-out a protected URL requires sign-in again", async ({ page }) => {
    await login(page, alex);
    await logout(page);
    await page.goto("/requests");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(seed.N1.title)).toHaveCount(0);
  });

  test("AC-30: a session that disappears mid-use requires sign-in and reports no success", async ({ page, context }) => {
    await login(page, alex);
    await context.clearCookies();
    await selectStatusFilter(page, copy.requests.statusPending); // new query -> API call -> 401
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(copy.session.expired, { exact: true })).toBeVisible();
    await expect(page.getByText(seed.N1.title)).toHaveCount(0);
  });

  test("AC-30: submitting after the session disappeared is not reported as success", async ({ page, context }) => {
    const input = sampleRequest("expired session");
    await login(page, alex);
    await openNewRequestForm(page);
    await fillRequestForm(page, input);
    await context.clearCookies();
    await submitButton(page).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(copy.session.expired, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.newRequest.submitted, { exact: true })).toHaveCount(0);
    await login(page, alex);
    await expect(page.getByText(input.title)).toHaveCount(0);
  });
});
