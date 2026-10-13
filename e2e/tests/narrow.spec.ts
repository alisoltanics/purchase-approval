import { expect, test } from "@playwright/test";
import { alex, jordan, mia, ola, seed } from "../support/accounts";
import { copy } from "../support/copy";
import {
  approveButton,
  collectAllMatching,
  dialog,
  expectNoHorizontalOverflow,
  fillRequestForm,
  login,
  logout,
  openNewRequestForm,
  openRequest,
  rejectButton,
  sampleRequest,
  submitButton,
  unavailable,
} from "../support/helpers";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("390 px width: no page-level horizontal scrolling (AC-31)", () => {
  test("AC-31: sign-in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: copy.signIn.submit, exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: copy.signIn.submit, exact: true }).click();
    await expect(page.getByText(copy.signIn.emailRequired, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("AC-31: requests list for employee, manager, paginated and empty", async ({ page }) => {
    await login(page, alex);
    expect(await collectAllMatching(page, new RegExp(`^${seed.N1.title}$`))).not.toHaveLength(0);
    await expectNoHorizontalOverflow(page);
    await logout(page);
    await login(page, jordan);
    expect(await collectAllMatching(page, new RegExp(`^${seed.N3.title}$`))).not.toHaveLength(0);
    await expectNoHorizontalOverflow(page);
    await logout(page);
    await login(page, ola);
    await expect(page.getByText(/^Page 1 of 3$/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await logout(page);
    await login(page, mia);
    await expect(page.getByText(copy.requests.emptyTitle, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("AC-31: new request form with a long unbroken title and errors", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await expectNoHorizontalOverflow(page);
    await submitButton(page).click();
    await expect(page.getByText(copy.validation.title.required, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("AC-31: details with the UUID, long text and decision dialogs", async ({ page }) => {
    await login(page, jordan);
    for (const id of [seed.N1.id, seed.N5.id, seed.N6.id, seed.N3.id]) {
      await openRequest(page, id);
      await expect(page.getByText(id, { exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
    await approveButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await rejectButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("AC-31: submitted request with long unbroken title, vendor and description wraps", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    const input = sampleRequest("narrow", { title: "W".repeat(110), vendor: "V".repeat(110), description: "D".repeat(1500) });
    await fillRequestForm(page, input);
    await submitButton(page).click();
    await expect(page.getByText(copy.newRequest.submitted, { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto("/requests");
    await expect(page.getByText(input.title, { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("AC-31: unavailable state", async ({ page }) => {
    await login(page, alex);
    await openRequest(page, seed.H1.id);
    await expect(unavailable(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
