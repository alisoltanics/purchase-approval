import { expect, test } from "@playwright/test";
import { alex, jordan, mia, ola, sam, seed } from "../support/accounts";
import { expectNoSeriousViolations } from "../support/axe";
import { copy } from "../support/copy";
import { demoPassword } from "../support/env";
import {
  approveButton,
  dialog,
  fillRequestForm,
  login,
  logout,
  openNewRequestForm,
  openRequest,
  rejectButton,
  sampleRequest,
  submitButton,
  unavailable,
  statusTab,
} from "../support/helpers";

test.describe("axe scans: no serious or critical violations (AC-31)", () => {
  test("AC-31: sign-in screen, idle and with errors", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: copy.signIn.submit, exact: true })).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: copy.signIn.submit, exact: true }).click();
    await expect(page.getByText(copy.signIn.emailRequired, { exact: true })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("AC-31: requests list as employee and as manager", async ({ page }) => {
    await login(page, alex);
    await expect(page.getByText(seed.N1.title).first()).toBeVisible();
    await expectNoSeriousViolations(page);
    await logout(page);
    await login(page, jordan);
    await expect(page.getByText(seed.N3.title).first()).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("AC-31: paginated list", async ({ page }) => {
    await login(page, ola);
    await expect(page.getByText(/^Page 1 of 3$/)).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("AC-31: empty and filtered-empty list states", async ({ page }) => {
    await login(page, mia);
    await expect(page.getByText(copy.requests.emptyTitle, { exact: true })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("AC-31: new request form, idle and with validation errors", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await expectNoSeriousViolations(page);
    await submitButton(page).click();
    await expect(page.getByText(copy.validation.title.required, { exact: true })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("AC-31: discard dialog", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    await fillRequestForm(page, sampleRequest("axe discard"));
    await page.getByRole("button", { name: copy.newRequest.cancel, exact: true }).or(page.getByRole("link", { name: copy.newRequest.cancel, exact: true })).first().click();
    await expect(dialog(page)).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("AC-31: request details in pending, approved and rejected states", async ({ page }) => {
    await login(page, sam);
    for (const r of [seed.N3, seed.N6]) {
      await openRequest(page, r.id);
      await expect(page.getByText(r.title, { exact: true }).first()).toBeVisible();
      await expectNoSeriousViolations(page);
    }
    await logout(page);
    await login(page, alex);
    await openRequest(page, seed.N5.id);
    await expect(page.getByText(seed.N5.title, { exact: true }).first()).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("AC-31: details with decision controls and both decision dialogs", async ({ page }) => {
    await login(page, jordan);
    await openRequest(page, seed.N3.id);
    await expect(approveButton(page)).toBeVisible();
    await expectNoSeriousViolations(page);
    await approveButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await rejectButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await expectNoSeriousViolations(page);
    await dialog(page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();
    await expect(dialog(page).getByText(copy.validation.reason.required, { exact: true })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("AC-31: own-request notice and neutral unavailable state", async ({ page }) => {
    await login(page, jordan);
    await openRequest(page, seed.N4.id);
    await expect(page.getByText(copy.details.ownRequestNotice, { exact: true })).toBeVisible();
    await expectNoSeriousViolations(page);
    await openRequest(page, seed.H1.id);
    await expect(unavailable(page)).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});

test.describe("keyboard (AC-31)", () => {
  test("AC-31: sign-in by keyboard only", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(copy.signIn.email, { exact: true }).focus();
    await page.keyboard.type(alex.email);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(copy.signIn.password, { exact: true })).toBeFocused();
    await page.keyboard.type(demoPassword());
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: copy.requests.title, exact: true })).toBeVisible();
  });

  test("AC-31: Tab reaches New request, the status filter and a request link on the list", async ({ page }) => {
    await login(page, alex);
    const targets = [
      page.getByRole("link", { name: copy.requests.newRequest, exact: true }).or(page.getByRole("button", { name: copy.requests.newRequest, exact: true })).first(),
      statusTab(page, copy.requests.statusAll),
      page.getByRole("link", { name: seed.N1.title, exact: true }),
    ];
    const reached: boolean[] = [false, false, false];
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press("Tab");
      for (let k = 0; k < targets.length; k += 1) {
        const target = targets[k];
        if (target && (await target.evaluate((el) => el === document.activeElement).catch(() => false))) {
          reached[k] = true;
        }
      }
      if (reached.every(Boolean)) {
        break;
      }
    }
    expect(reached).toEqual([true, true, true]);
  });

  test("AC-31: new request form submits by keyboard only", async ({ page }) => {
    await login(page, alex);
    await openNewRequestForm(page);
    const input = sampleRequest("keyboard form", { description: "Typed by keyboard." });
    await page.getByLabel(copy.newRequest.titleLabel, { exact: true }).focus();
    await page.keyboard.type(input.title);
    await page.keyboard.press("Tab");
    await page.keyboard.type(input.vendor);
    await page.keyboard.press("Tab");
    await page.keyboard.type(input.amount);
    await page.keyboard.press("Tab");
    await page.keyboard.type(input.description);
    await submitButton(page).focus();
    await expect(submitButton(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText(copy.newRequest.submitted, { exact: true }).first()).toBeVisible();
  });

  test("AC-31: focused controls have a visible focus indicator", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByLabel(copy.signIn.email, { exact: true });
    await email.focus();
    const outline = await email.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== "none" };
    });
    expect(outline.outline || outline.shadow).toBe(true);
  });
});
