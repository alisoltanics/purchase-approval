import { expect, test, type Browser, type Page } from "@playwright/test";
import { alex, jordan, taylor } from "../support/accounts";
import { copy, fill } from "../support/copy";
import {
  approveBody,
  approveButton,
  approveViaUi,
  createRequest,
  dialog,
  login,
  logout,
  openRequest,
  reasonField,
  rejectBody,
  rejectButton,
  rejectViaUi,
  sampleRequest,
  type NewRequestInput,
} from "../support/helpers";
import { type Account } from "../support/accounts";

/** Employee Alex creates a fresh pending request in an isolated context; returns its id. */
async function employeeCreates(browser: Browser, label: string, overrides: Partial<NewRequestInput> = {}): Promise<{ id: string; input: NewRequestInput }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const input = sampleRequest(label, overrides);
  await login(page, alex);
  const id = await createRequest(page, input);
  await context.close();
  return { id, input };
}

async function managerPage(browser: Browser, account: Account, id: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, account);
  await openRequest(page, id);
  return { page, close: () => context.close() };
}

test.describe("approve", () => {
  test("AC-15: confirmation shows title and amount first; confirming approves without a reload", async ({ browser }) => {
    const { id, input } = await employeeCreates(browser, "approve", { amount: "120.5" });
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __noReload?: boolean }).__noReload = true;
    });
    await approveButton(page).click();
    const d = dialog(page);
    await expect(d.getByText(copy.approveDialog.title, { exact: true })).toBeVisible();
    await expect(d.getByText(approveBody(input.title, "120.50"), { exact: true })).toBeVisible();
    // Nothing happened yet.
    await expect(page.getByText(copy.status.approved, { exact: true })).toHaveCount(0);
    await d.getByRole("button", { name: copy.approveDialog.confirm, exact: true }).click();
    await expect(d).toBeHidden();
    await expect(page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(jordan.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(fill(copy.details.eventApproved, { actor: jordan.name }), { exact: true })).toHaveCount(1);
    await expect(page.getByText(fill(copy.details.eventSubmitted, { actor: alex.name }), { exact: true })).toHaveCount(1);
    await expect(page.getByText(/\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC/).first()).toBeVisible();
    await expect(approveButton(page)).toHaveCount(0);
    await expect(rejectButton(page)).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    await m.close();
  });

  test("AC-19: the requester sees the approval after reload and after a new login", async ({ browser }) => {
    const { id, input } = await employeeCreates(browser, "approve visible", { amount: "10" });
    const m = await managerPage(browser, taylor, id);
    await approveViaUi(m.page, input.title, "10.00");
    await m.close();

    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, alex);
    await openRequest(page, id);
    await expect(page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(taylor.name, { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    await logout(page);
    await login(page, alex);
    await openRequest(page, id);
    await expect(page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(fill(copy.details.eventApproved, { actor: taylor.name }), { exact: true })).toHaveCount(1);
    await expect(approveButton(page)).toHaveCount(0);
    await context.close();
  });

  test("AC-15: the decided status shows in the list as text", async ({ browser }) => {
    const { id, input } = await employeeCreates(browser, "approve list");
    const m = await managerPage(browser, jordan, id);
    await approveViaUi(m.page, input.title, "25.50");
    await m.page.goto("/requests");
    await expect(m.page.getByRole("row").or(m.page.getByRole("listitem")).filter({ hasText: input.title }).first()).toContainText(copy.status.approved);
    await m.close();
  });
});

test.describe("reject", () => {
  test("AC-16: rejecting with a reason records reason, actor and time; details update without reload", async ({ browser }) => {
    const { id, input } = await employeeCreates(browser, "reject", { amount: "99" });
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    await page.evaluate(() => {
      (window as unknown as { __noReload?: boolean }).__noReload = true;
    });
    await rejectButton(page).click();
    const d = dialog(page);
    await expect(d.getByText(copy.rejectDialog.title, { exact: true })).toBeVisible();
    await expect(d.getByText(rejectBody(input.title, "99.00"), { exact: true })).toBeVisible();
    await expect(d.getByText(copy.rejectDialog.reasonHint, { exact: true })).toBeVisible();
    await reasonField(page).fill("Over budget.\nSecond line of the reason.");
    await d.getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();
    await expect(d).toBeHidden();
    await expect(page.getByText(copy.status.rejected, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(copy.details.rejectionReasonLabel, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Over budget.", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(fill(copy.details.eventRejected, { actor: jordan.name }), { exact: true })).toHaveCount(1);
    await expect(approveButton(page)).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    await m.close();
  });

  test("AC-19: the requester sees status, actor, time and reason after reload and after a new login", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "reject visible");
    const reason = `Not needed this quarter ${Math.random().toString(36).slice(2, 8)}.`;
    const m = await managerPage(browser, taylor, id);
    await rejectViaUi(m.page, reason);
    await m.close();

    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, alex);
    for (const step of ["first view", "after reload", "after new login"]) {
      if (step === "after reload") {
        await page.reload();
      }
      if (step === "after new login") {
        await logout(page);
        await login(page, alex);
      }
      if (step !== "after reload") {
        await openRequest(page, id);
      }
      await expect(page.getByText(copy.status.rejected, { exact: true }).first(), step).toBeVisible();
      await expect(page.getByText(reason, { exact: true }).first(), step).toBeVisible();
      await expect(page.getByText(taylor.name, { exact: true }).first(), step).toBeVisible();
      await expect(page.getByText(/UTC/).first(), step).toBeVisible();
    }
    await expect(page.getByText(fill(copy.details.eventRejected, { actor: taylor.name }), { exact: true })).toHaveCount(1);
    await context.close();
  });

  test("AC-17: empty reason is rejected and nothing is decided", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "empty reason");
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    await rejectButton(page).click();
    await dialog(page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(reasonField(page)).toHaveAccessibleDescription(new RegExp(copy.validation.reason.required));
    await expect(reasonField(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(fill(copy.details.eventRejected, { actor: jordan.name }), { exact: true })).toHaveCount(0);
    await m.close();
  });

  test("AC-17: whitespace-only reason is rejected", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "blank reason");
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    await rejectButton(page).click();
    await reasonField(page).fill("  \n\t   ");
    await dialog(page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();
    await expect(reasonField(page)).toHaveAccessibleDescription(new RegExp(copy.validation.reason.required));
    await expect(dialog(page)).toBeVisible();
    await m.close();
  });

  test("AC-17: a reason of 1001 characters is rejected; 1000 characters is accepted", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "long reason");
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    await rejectButton(page).click();
    await reasonField(page).fill("r".repeat(1001));
    await dialog(page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();
    await expect(reasonField(page)).toHaveAccessibleDescription(new RegExp(fill(copy.validation.reason.tooLong, { max: "1000" })));
    await expect(page.getByText(copy.status.rejected, { exact: true })).toHaveCount(0);
    await reasonField(page).fill("r".repeat(1000));
    await dialog(page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByText(copy.status.rejected, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("r".repeat(1000), { exact: true }).first()).toBeVisible();
    await m.close();
  });

  test("AC-17: the reason is trimmed (outer whitespace is not stored)", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "trim reason");
    const reason = `Trim me ${Math.random().toString(36).slice(2, 8)}`;
    const m = await managerPage(browser, jordan, id);
    await rejectViaUi(m.page, `   ${reason}  \n\n`);
    await expect(m.page.getByText(reason, { exact: true }).first()).toBeVisible();
    await m.close();
  });
});

test.describe("cancel dialogs", () => {
  test("AC-18: cancelling Approve changes nothing and returns focus to the Approve button", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "cancel approve");
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    await approveButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole("button", { name: copy.approveDialog.cancel, exact: true }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(approveButton(page)).toBeFocused();
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(fill(copy.details.eventApproved, { actor: jordan.name }), { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await m.close();
  });

  test("AC-18: cancelling Reject discards the typed reason, returns focus, and the dialog reopens empty", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "cancel reject");
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    await rejectButton(page).click();
    await reasonField(page).fill("This text must not survive.");
    await dialog(page).getByRole("button", { name: copy.rejectDialog.cancel, exact: true }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(rejectButton(page)).toBeFocused();
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await rejectButton(page).click();
    await expect(reasonField(page)).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(rejectButton(page)).toBeFocused();
    await rejectButton(page).click();
    await expect(reasonField(page)).toHaveValue("");
    await m.close();
  });

  test("AC-18/AC-31: dialog moves focus inside, traps Tab, and Escape closes it", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "dialog keyboard");
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    await approveButton(page).focus();
    await page.keyboard.press("Enter");
    const d = dialog(page);
    await expect(d).toBeVisible();
    expect(await d.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(await d.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await d.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(d).toBeHidden();
    await expect(approveButton(page)).toBeFocused();
    await m.close();
  });

  test("AC-31: a reject journey is possible by keyboard alone", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "keyboard reject");
    const m = await managerPage(browser, taylor, id);
    const { page } = m;
    await rejectButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(reasonField(page)).toBeVisible();
    await page.keyboard.type("Keyboard only rejection.");
    await dialog(page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByText(copy.status.rejected, { exact: true }).first()).toBeVisible();
    await m.close();
  });
});

test.describe("own request and already decided", () => {
  test("AC-21: a manager's own request shows the notice; Taylor then approves it", async ({ browser }) => {
    const context = await browser.newContext();
    const jPage = await context.newPage();
    await login(jPage, jordan);
    const input = sampleRequest("manager own");
    const id = await createRequest(jPage, input);
    await expect(jPage.getByText(copy.details.ownRequestNotice, { exact: true })).toBeVisible();
    await expect(approveButton(jPage)).toHaveCount(0);
    await expect(rejectButton(jPage)).toHaveCount(0);
    await jPage.reload();
    await expect(jPage.getByText(copy.details.ownRequestNotice, { exact: true })).toBeVisible();
    await expect(approveButton(jPage)).toHaveCount(0);

    const t = await managerPage(browser, taylor, id);
    await expect(t.page.getByText(copy.details.ownRequestNotice, { exact: true })).toHaveCount(0);
    await approveViaUi(t.page, input.title, "25.50");
    await expect(t.page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();

    await jPage.reload();
    await expect(jPage.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    await expect(jPage.getByText(taylor.name, { exact: true }).first()).toBeVisible();
    await expect(jPage.getByText(copy.details.ownRequestNotice, { exact: true })).toHaveCount(0);
    await t.close();
    await context.close();
  });

  test("AC-25/AC-26: two managers open the same pending request; the second to act sees the already-decided message and the winner's decision", async ({ browser }) => {
    const { id, input } = await employeeCreates(browser, "conflict");
    const j = await managerPage(browser, jordan, id);
    const t = await managerPage(browser, taylor, id);
    await expect(approveButton(j.page)).toBeVisible();
    await expect(approveButton(t.page)).toBeVisible();

    await approveViaUi(j.page, input.title, "25.50");
    await expect(j.page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();

    // Taylor's page is stale: still shows Pending with controls.
    await expect(t.page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await rejectButton(t.page).click();
    await reasonField(t.page).fill("Too late, should not be stored.");
    await dialog(t.page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();

    await expect(t.page.getByText(copy.details.alreadyDecided, { exact: true })).toBeVisible();
    await expect(dialog(t.page)).toBeHidden();
    await expect(t.page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    await expect(t.page.getByText(jordan.name, { exact: true }).first()).toBeVisible();
    await expect(t.page.getByText(fill(copy.details.eventApproved, { actor: jordan.name }), { exact: true })).toHaveCount(1);
    await expect(t.page.getByText(fill(copy.details.eventRejected, { actor: taylor.name }), { exact: true })).toHaveCount(0);
    await expect(t.page.getByText("Too late, should not be stored.")).toHaveCount(0);
    await expect(t.page.getByText(copy.status.rejected, { exact: true })).toHaveCount(0);
    await expect(approveButton(t.page)).toHaveCount(0);
    await expect(rejectButton(t.page)).toHaveCount(0);

    // Persisted state is the winner's.
    await t.page.reload();
    await expect(t.page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    // The shell shows the signed-in user's name; only the request content must not mention Taylor.
    await expect(t.page.getByRole("main").getByText(taylor.name, { exact: true })).toHaveCount(0);
    await j.close();
    await t.close();
  });

  test("AC-25: approve on a stale page after another manager rejected shows the rejection and the reason", async ({ browser }) => {
    const { id, input } = await employeeCreates(browser, "conflict reject first");
    const j = await managerPage(browser, jordan, id);
    const t = await managerPage(browser, taylor, id);
    const reason = `Winner reason ${Math.random().toString(36).slice(2, 8)}`;
    await rejectViaUi(j.page, reason);

    await approveButton(t.page).click();
    await expect(dialog(t.page).getByText(approveBody(input.title, "25.50"), { exact: true })).toBeVisible();
    await dialog(t.page).getByRole("button", { name: copy.approveDialog.confirm, exact: true }).click();
    await expect(t.page.getByText(copy.details.alreadyDecided, { exact: true })).toBeVisible();
    await expect(dialog(t.page)).toBeHidden();
    await expect(t.page.getByText(copy.status.rejected, { exact: true }).first()).toBeVisible();
    await expect(t.page.getByText(reason, { exact: true }).first()).toBeVisible();
    await expect(t.page.getByText(fill(copy.details.eventApproved, { actor: taylor.name }), { exact: true })).toHaveCount(0);
    await j.close();
    await t.close();
  });

  test("AC-25: a manager re-opening an already decided request has no controls to repeat or change the decision", async ({ browser }) => {
    const { id, input } = await employeeCreates(browser, "decided final");
    const j = await managerPage(browser, jordan, id);
    await approveViaUi(j.page, input.title, "25.50");
    await j.page.reload();
    await expect(approveButton(j.page)).toHaveCount(0);
    await expect(rejectButton(j.page)).toHaveCount(0);
    await expect(j.page.getByText(fill(copy.details.eventApproved, { actor: jordan.name }), { exact: true })).toHaveCount(1);
    await j.close();
  });
});

test.describe("decision failures", () => {
  test("AC-29: a lost approval response is not shown as success; reloading reconciles with stored state", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "lost approve");
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    let aborted = false;
    await page.route(`**/api/requests/${id}/approve/`, async (route) => {
      if (!aborted) {
        aborted = true;
        await route.fetch(); // server applies the decision
        await route.abort("connectionreset"); // client never sees the answer
        return;
      }
      await route.continue();
    });
    await approveButton(page).click();
    await dialog(page).getByRole("button", { name: copy.approveDialog.confirm, exact: true }).click();
    await expect(page.getByText(copy.details.decisionFailure, { exact: true })).toBeVisible();
    await expect(page.getByText(fill(copy.details.eventApproved, { actor: jordan.name }), { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: copy.details.reloadRequest, exact: true }).click();
    // Reconciled: the stored state (approved by Jordan) is shown, exactly one decision event, no repeat controls.
    await expect(page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(fill(copy.details.eventApproved, { actor: jordan.name }), { exact: true })).toHaveCount(1);
    await expect(approveButton(page)).toHaveCount(0);
    await m.close();
  });

  test("AC-29: a server error on rejection keeps the reason for retry and shows no success", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "reject server error");
    const m = await managerPage(browser, jordan, id);
    const { page } = m;
    const reason = "Retry me after the outage.";
    await page.route(`**/api/requests/${id}/reject/`, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "server_error", message: "Something went wrong. Try again." } }) }),
    );
    await rejectButton(page).click();
    await reasonField(page).fill(reason);
    await dialog(page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();
    await expect(page.getByText(copy.status.rejected, { exact: true })).toHaveCount(0);
    await expect(reasonField(page)).toHaveValue(reason);
    await page.unroute(`**/api/requests/${id}/reject/`);
    await dialog(page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByText(copy.status.rejected, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(reason, { exact: true }).first()).toBeVisible();
    await m.close();
  });

  test("AC-30: a decision attempted after the session ended is not reported as success", async ({ browser }) => {
    const { id } = await employeeCreates(browser, "expired decide");
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, jordan);
    await openRequest(page, id);
    await approveButton(page).click();
    await context.clearCookies();
    await dialog(page).getByRole("button", { name: copy.approveDialog.confirm, exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(copy.session.expired, { exact: true })).toBeVisible();
    await login(page, jordan);
    await openRequest(page, id);
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await context.close();
  });
});
