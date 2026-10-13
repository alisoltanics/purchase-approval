import { expect, test } from "@playwright/test";
import { alex, jordan, riley, sam, seed, taylor } from "../support/accounts";
import { copy, fill } from "../support/copy";
import {
  approveButton,
  createRequest,
  formatAmount,
  login,
  logout,
  openRequest,
  rejectButton,
  sampleRequest,
  unavailable,
} from "../support/helpers";

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("details of seed requests (read only)", () => {
  test("AC-14: pending request shows every field, USD and UTC", async ({ page }) => {
    await login(page, alex);
    await openRequest(page, seed.N1.id);
    await expect(page.getByText(seed.N1.title, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(seed.N1.id, { exact: true })).toBeVisible();
    await expect(page.getByText(seed.N1.vendor, { exact: true })).toBeVisible();
    await expect(page.getByText(formatAmount(seed.N1.amount), { exact: true })).toBeVisible();
    await expect(page.getByText(copy.status.pending, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(alex.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(seed.N1.submittedText).first()).toBeVisible();
    for (const label of [copy.details.referenceLabel, copy.details.vendorLabel, copy.details.descriptionLabel, copy.details.amountLabel, copy.details.statusLabel, copy.details.requesterLabel, copy.details.submittedLabel, copy.details.activityTitle]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(fill(copy.details.eventSubmitted, { actor: alex.name }), { exact: true })).toBeVisible();
    await expect(page.getByText(/UTC/).first()).toBeVisible();
    await expect(page.getByText(copy.details.rejectionReasonLabel, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.details.backToRequests, exact: true })).toBeVisible();
  });

  test("AC-14: multiline description keeps its line breaks", async ({ page }) => {
    await login(page, alex);
    await openRequest(page, seed.N1.id);
    const lines = seed.N1.description.split("\n");
    for (const line of lines) {
      await expect(page.getByText(line, { exact: false }).first()).toBeVisible();
    }
    // Rendered text (innerText) must keep each description line on its own line.
    const rendered = await page.locator("body").innerText();
    expect(rendered).toMatch(new RegExp(`${escapeRe(lines[0] ?? "")}\\s*\\n\\s*${escapeRe(lines[1] ?? "")}\\s*\\n\\s*${escapeRe(lines[2] ?? "")}`));
  });

  test("AC-14/AC-19: approved request shows decision maker, time and activity oldest first", async ({ page }) => {
    await login(page, alex);
    await openRequest(page, seed.N5.id);
    await expect(page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(jordan.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(seed.N5.decidedText ?? /x/).first()).toBeVisible();
    const submitted = page.getByText(fill(copy.details.eventSubmitted, { actor: alex.name }), { exact: true });
    const approved = page.getByText(fill(copy.details.eventApproved, { actor: jordan.name }), { exact: true });
    await expect(submitted).toBeVisible();
    await expect(approved).toBeVisible();
    const a = await submitted.boundingBox();
    const b = await approved.boundingBox();
    expect(a && b ? a.y < b.y : false).toBe(true);
    await expect(approveButton(page)).toHaveCount(0);
    await expect(rejectButton(page)).toHaveCount(0);
  });

  test("AC-14/AC-19: rejected request shows the reason, the decision maker and the rejection event", async ({ page }) => {
    await login(page, sam);
    await openRequest(page, seed.N6.id);
    await expect(page.getByText(copy.status.rejected, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(copy.details.rejectionReasonLabel, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(seed.N6.rejectionReason ?? "", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(jordan.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(seed.N6.decidedText ?? /x/).first()).toBeVisible();
    await expect(page.getByText(fill(copy.details.eventRejected, { actor: jordan.name }), { exact: true })).toBeVisible();
    await expect(approveButton(page)).toHaveCount(0);
  });

  test("AC-27: details offer no edit, delete, cancel or reopen controls", async ({ page }) => {
    await login(page, jordan);
    for (const id of [seed.N3.id, seed.N5.id, seed.N6.id]) {
      await openRequest(page, id);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /edit|delete|remove|cancel request|withdraw|reopen|resubmit/i })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /edit|delete|remove|reopen|resubmit/i })).toHaveCount(0);
    }
  });
});

test.describe("plain text rendering", () => {
  test("AC-14: markup in title and description is shown as literal text", async ({ page }) => {
    await login(page, alex);
    const marker = Math.random().toString(36).slice(2, 8);
    const title = `<script>alert(1)</script> ${marker}`;
    const description = `<b>x</b> ${marker}\n<img src=x onerror=alert(2)>`;
    const dialogs: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await createRequest(page, sampleRequest("markup", { title, description }));
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`<b>x</b> ${marker}`, { exact: false }).first()).toBeVisible();
    await expect(page.getByText("<img src=x onerror=alert(2)>", { exact: false }).first()).toBeVisible();
    await expect(page.locator("b", { hasText: "x" })).toHaveCount(0);
    await expect(page.locator("img[src='x']")).toHaveCount(0);
    await page.goto("/requests");
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    expect(dialogs).toEqual([]);
  });
});

test.describe("neutral unavailable state", () => {
  test("AC-23: an employee opening a colleague's request sees the neutral state", async ({ page }) => {
    await login(page, alex);
    await openRequest(page, seed.N3.id); // Sam's
    await expect(unavailable(page)).toBeVisible();
    await expect(page.getByText(seed.N3.title)).toHaveCount(0);
    await expect(page.getByText(seed.N3.vendor)).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.details.backToRequests, exact: true })).toBeVisible();
  });

  test("AC-22: another company's request id shows the same neutral state to employee and manager", async ({ page }) => {
    await login(page, alex);
    await openRequest(page, seed.H1.id);
    await expect(unavailable(page)).toBeVisible();
    await expect(page.getByText(seed.H1.title)).toHaveCount(0);
    await logout(page);
    await login(page, jordan);
    await openRequest(page, seed.H2.id);
    await expect(unavailable(page)).toBeVisible();
    await expect(page.getByText(seed.H2.title)).toHaveCount(0);
    await expect(page.getByText(seed.H2.vendor)).toHaveCount(0);
  });

  test("AC-22: Harbor users cannot open Northstar requests either", async ({ page }) => {
    await login(page, riley);
    await openRequest(page, seed.N1.id);
    await expect(unavailable(page)).toBeVisible();
    await expect(approveButton(page)).toHaveCount(0);
  });

  test("AC-23: a nonexistent id and a malformed id show the identical neutral state", async ({ page }) => {
    await login(page, alex);
    await openRequest(page, "00000000-0000-4000-8000-000000000000");
    await expect(unavailable(page)).toBeVisible();
    await page.goto("/requests/not-a-uuid");
    await expect(unavailable(page)).toBeVisible();
    await page.getByRole("link", { name: copy.details.backToRequests, exact: true }).click();
    await expect(page.getByRole("heading", { name: copy.requests.title, exact: true })).toBeVisible();
  });
});

test.describe("decision controls visibility", () => {
  test("AC-20: an employee never sees decision controls, on any status or on own requests", async ({ page }) => {
    await login(page, alex);
    for (const id of [seed.N1.id, seed.N2.id, seed.N5.id]) {
      await openRequest(page, id);
      await expect(page.getByText(seed.N1.id === id ? seed.N1.title : id === seed.N2.id ? seed.N2.title : seed.N5.title, { exact: true }).first()).toBeVisible();
      await expect(approveButton(page)).toHaveCount(0);
      await expect(rejectButton(page)).toHaveCount(0);
      await expect(page.getByText(copy.details.ownRequestNotice, { exact: true })).toHaveCount(0);
    }
  });

  test("AC-21: a manager sees the notice, and no controls, on their own pending request (seed N4)", async ({ page }) => {
    await login(page, jordan);
    await openRequest(page, seed.N4.id);
    await expect(page.getByText(seed.N4.title, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(copy.details.ownRequestNotice, { exact: true })).toBeVisible();
    await expect(approveButton(page)).toHaveCount(0);
    await expect(rejectButton(page)).toHaveCount(0);
  });

  test("AC-21: another manager sees controls on that same request (read only check)", async ({ page }) => {
    await login(page, taylor);
    await openRequest(page, seed.N4.id);
    await expect(approveButton(page)).toBeVisible();
    await expect(rejectButton(page)).toBeVisible();
    await expect(page.getByText(copy.details.ownRequestNotice, { exact: true })).toHaveCount(0);
  });

  test("AC-21: managers see no controls on decided requests", async ({ page }) => {
    await login(page, jordan);
    await openRequest(page, seed.N5.id);
    await expect(page.getByText(copy.status.approved, { exact: true }).first()).toBeVisible();
    await expect(approveButton(page)).toHaveCount(0);
    await expect(rejectButton(page)).toHaveCount(0);
    await expect(page.getByText(copy.details.ownRequestNotice, { exact: true })).toHaveCount(0);
  });
});
