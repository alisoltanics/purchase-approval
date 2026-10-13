import { expect, test } from "@playwright/test";
import { alex, casey, eli, jordan, mia, noa, ola, riley, seed } from "../support/accounts";
import { copy } from "../support/copy";
import { fixtureRequests, newestFirst, titlesOnPage } from "../support/fixtures";
import {
  collectAllMatching,
  formatAmount,
  listEntry,
  loadingIndicator,
  login,
  nextControl,
  pageIndicator,
  previousControl,
  selectStatusFilter,
} from "../support/helpers";

const northstarTitles = [seed.N1, seed.N2, seed.N3, seed.N4, seed.N5, seed.N6].map((r) => r.title);
const harborTitles = [seed.H1.title, seed.H2.title];

function titleRegex(titles: readonly string[]): RegExp {
  return new RegExp(`^(${titles.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`);
}

test.describe("visibility", () => {
  test("AC-05: employee sees only own requests, no requester column", async ({ page }) => {
    await login(page, alex);
    const seen = await collectAllMatching(page, titleRegex([...northstarTitles, ...harborTitles]));
    expect(seen).toEqual(expect.arrayContaining([seed.N1.title, seed.N2.title, seed.N5.title]));
    for (const other of [seed.N3, seed.N4, seed.N6, seed.H1, seed.H2]) {
      expect(seen).not.toContain(other.title);
    }
    await expect(page.getByText(copy.requests.columnRequester, { exact: true })).toHaveCount(0);
  });

  test("AC-05: employee of the other company sees only own company requests", async ({ page }) => {
    await login(page, casey);
    const seen = await collectAllMatching(page, titleRegex([...northstarTitles, ...harborTitles]));
    expect([...seen].sort()).toEqual([...harborTitles].sort());
  });

  test("AC-06: manager sees all company requests including own, with requester names", async ({ page }) => {
    await login(page, jordan);
    await expect(page.getByText(copy.requests.columnRequester, { exact: true }).first()).toBeVisible();
    const seen = await collectAllMatching(page, titleRegex([...northstarTitles, ...harborTitles]));
    for (const title of northstarTitles) {
      expect(seen).toContain(title);
    }
    for (const title of harborTitles) {
      expect(seen).not.toContain(title);
    }
  });

  test("AC-06: manager list shows the requester's name on each entry", async ({ page }) => {
    await login(page, riley);
    await expect(listEntry(page, seed.H1.title).first()).toContainText(casey.name);
    await expect(listEntry(page, seed.H2.title).first()).toContainText(casey.name);
  });

  test("AC-22: a cross-company manager never sees the other company's requests", async ({ page }) => {
    await login(page, riley);
    const seen = await collectAllMatching(page, titleRegex([...northstarTitles, ...harborTitles]));
    expect([...seen].sort()).toEqual([...harborTitles].sort());
  });

  test("AC-14/AC-05: list entry shows reference, title, vendor, amount with USD, status text and date", async ({ page }) => {
    await login(page, casey);
    const entry = listEntry(page, seed.H2.title).first();
    await expect(entry).toContainText(seed.H2.id);
    await expect(entry).toContainText(seed.H2.vendor);
    await expect(entry).toContainText(formatAmount(seed.H2.amount));
    await expect(entry).toContainText(copy.status.approved);
    await expect(entry).toContainText(/30 Sep 2026/);
    const pending = listEntry(page, seed.H1.title).first();
    await expect(pending).toContainText(copy.status.pending);
    await expect(pending).toContainText(formatAmount(seed.H1.amount));
  });

  test("AC-05: status filter offers All statuses, Pending, Approved, Rejected and defaults to All", async ({ page }) => {
    await login(page, casey);
    const filter = page.getByLabel(copy.requests.statusFilterLabel, { exact: true });
    await expect(filter).toBeVisible();
    await expect(filter.getByRole("option")).toHaveText([
      copy.requests.statusAll,
      copy.requests.statusPending,
      copy.requests.statusApproved,
      copy.requests.statusRejected,
    ]);
    await expect(filter.locator("option:checked")).toHaveText(copy.requests.statusAll);
  });

  test("AC-07: status filter shows the matching subset only", async ({ page }) => {
    await login(page, casey);
    await selectStatusFilter(page, copy.requests.statusApproved);
    await expect(listEntry(page, seed.H2.title).first()).toBeVisible();
    await expect(page.getByText(seed.H1.title, { exact: true })).toHaveCount(0);
    await selectStatusFilter(page, copy.requests.statusPending);
    await expect(listEntry(page, seed.H1.title).first()).toBeVisible();
    await expect(page.getByText(seed.H2.title, { exact: true })).toHaveCount(0);
    await selectStatusFilter(page, copy.requests.statusRejected);
    await expect(page.getByText(copy.requests.filteredEmpty, { exact: true })).toBeVisible();
  });
});

test.describe("pagination with the Fixture Co data", () => {
  test("AC-07: manager sees three pages with 45 requests, newest first, 20 per page", async ({ page }) => {
    await login(page, ola);
    const all = fixtureRequests;
    await expect(pageIndicator(page, 1, 3)).toBeVisible();
    expect(await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents()).toEqual(titlesOnPage(all, 1));
    await expect(previousControl(page)).toBeDisabled();
    await nextControl(page).click();
    await expect(pageIndicator(page, 2, 3)).toBeVisible();
    expect(await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents()).toEqual(titlesOnPage(all, 2));
    await nextControl(page).click();
    await expect(pageIndicator(page, 3, 3)).toBeVisible();
    const last = await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents();
    expect(last).toHaveLength(5);
    expect(last).toEqual(titlesOnPage(all, 3));
    await expect(nextControl(page)).toBeDisabled();
    await previousControl(page).click();
    await expect(pageIndicator(page, 2, 3)).toBeVisible();
  });

  test("AC-07: equal submission times keep a stable order (id descending) across reloads", async ({ page }) => {
    await login(page, ola);
    const expected = titlesOnPage(fixtureRequests, 1);
    for (let i = 0; i < 2; i += 1) {
      expect(await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents()).toEqual(expected);
      await page.reload();
      await expect(pageIndicator(page, 1, 3)).toBeVisible();
    }
    // The newest group (n = 44, 45) shares one timestamp: id order decides.
    const top = newestFirst(fixtureRequests).slice(0, 2).map((r) => r.n).sort();
    expect(top).toEqual([44, 45]);
  });

  test("AC-07: employee with 25 requests sees two pages (20 and 5)", async ({ page }) => {
    await login(page, noa);
    const own = fixtureRequests.filter((r) => r.owner === "noa");
    await expect(pageIndicator(page, 1, 2)).toBeVisible();
    expect(await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents()).toEqual(titlesOnPage(own, 1));
    await nextControl(page).click();
    await expect(pageIndicator(page, 2, 2)).toBeVisible();
    expect(await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents()).toEqual(titlesOnPage(own, 2));
    await expect(nextControl(page)).toBeDisabled();
  });

  test("AC-07: filter changes the page count and resets to page one", async ({ page }) => {
    await login(page, ola);
    await nextControl(page).click();
    await expect(pageIndicator(page, 2, 3)).toBeVisible();
    await selectStatusFilter(page, copy.requests.statusPending);
    // 28 pending requests -> 2 pages, back on page 1
    await expect(pageIndicator(page, 1, 2)).toBeVisible();
    const pending = fixtureRequests.filter((r) => r.status === "pending");
    expect(await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents()).toEqual(titlesOnPage(pending, 1));
    await nextControl(page).click();
    await expect(pageIndicator(page, 2, 2)).toBeVisible();
    await selectStatusFilter(page, copy.requests.statusApproved);
    // 9 approved requests -> one page
    await expect(pageIndicator(page, 1, 1)).toBeVisible();
    const approved = fixtureRequests.filter((r) => r.status === "approved");
    expect(await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents()).toEqual(titlesOnPage(approved, 1));
    await expect(previousControl(page)).toBeDisabled();
    await expect(nextControl(page)).toBeDisabled();
  });

  test("AC-07: a page beyond the end shows the last valid page", async ({ page }) => {
    await login(page, ola);
    await page.goto("/requests?page=99");
    await expect(pageIndicator(page, 3, 3)).toBeVisible();
    expect(await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents()).toEqual(titlesOnPage(fixtureRequests, 3));
  });

  test("AC-08: list page 2 with a filter -> details -> Back to Requests restores filter and page", async ({ page }) => {
    await login(page, ola);
    await selectStatusFilter(page, copy.requests.statusPending);
    await nextControl(page).click();
    await expect(pageIndicator(page, 2, 2)).toBeVisible();
    const pending = fixtureRequests.filter((r) => r.status === "pending");
    const target = titlesOnPage(pending, 2)[0];
    if (!target) {
      throw new Error("expected a request on page 2");
    }
    await page.getByRole("link", { name: target, exact: true }).click();
    await expect(page.getByText(target, { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: copy.details.backToRequests, exact: true }).click();
    await expect(pageIndicator(page, 2, 2)).toBeVisible();
    await expect(page.getByLabel(copy.requests.statusFilterLabel, { exact: true })).toHaveValue(/pending/i);
    expect(await page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents()).toEqual(titlesOnPage(pending, 2));
  });

  test("AC-08: the browser Back button also restores filter and page", async ({ page }) => {
    await login(page, ola);
    await nextControl(page).click();
    await expect(pageIndicator(page, 2, 3)).toBeVisible();
    const target = titlesOnPage(fixtureRequests, 2)[0];
    if (!target) {
      throw new Error("expected a request on page 2");
    }
    await page.getByRole("link", { name: target, exact: true }).click();
    await expect(page.getByText(target, { exact: true }).first()).toBeVisible();
    await page.goBack();
    await expect(pageIndicator(page, 2, 3)).toBeVisible();
  });
});

test.describe("empty and failure states", () => {
  test("AC-28: user without requests sees the empty state with New request", async ({ page }) => {
    await login(page, mia);
    await expect(page.getByText(copy.requests.empty, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: copy.requests.newRequest, exact: true }).or(page.getByRole("button", { name: copy.requests.newRequest, exact: true })).first()).toBeVisible();
    await expect(page.getByText(copy.requests.filteredEmpty, { exact: true })).toHaveCount(0);
    await expect(pageIndicator(page, 1, 1)).toBeVisible();
  });

  test("AC-28: no filter match shows the filtered-empty state and Clear filter restores the list", async ({ page }) => {
    await login(page, eli);
    await expect(page.getByText("Fixture request 1", { exact: true })).toBeVisible();
    await selectStatusFilter(page, copy.requests.statusApproved);
    await expect(page.getByText(copy.requests.filteredEmpty, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.requests.empty, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: copy.requests.clearFilter, exact: true }).or(page.getByRole("link", { name: copy.requests.clearFilter, exact: true })).first().click();
    await expect(page.getByLabel(copy.requests.statusFilterLabel, { exact: true }).locator("option:checked")).toHaveText(copy.requests.statusAll);
    for (const n of [1, 2, 3]) {
      await expect(page.getByText(`Fixture request ${n}`, { exact: true })).toBeVisible();
    }
  });

  test("AC-28: a failed load shows an error with retry, not an empty list", async ({ page }) => {
    await login(page, casey);
    await page.route("**/api/requests/?*", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "server_error", message: "Something went wrong. Try again." } }) }));
    await page.reload();
    await expect(page.getByText(copy.requests.loadFailure, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.requests.empty, { exact: true })).toHaveCount(0);
    await expect(page.getByText(copy.requests.filteredEmpty, { exact: true })).toHaveCount(0);
    await page.unroute("**/api/requests/?*");
    await page.getByRole("button", { name: copy.requests.retry, exact: true }).click();
    await expect(page.getByText(seed.H1.title, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.requests.loadFailure, { exact: true })).toHaveCount(0);
  });

  test("AC-28: loading is announced and never flashes the empty state", async ({ page }) => {
    await login(page, mia);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/requests/?*", async (route) => {
      await gate;
      await route.continue();
    });
    await page.reload();
    await expect(loadingIndicator(page)).toBeVisible();
    await expect(page.getByText(copy.requests.empty, { exact: true })).toHaveCount(0);
    release();
    await expect(page.getByText(copy.requests.empty, { exact: true })).toBeVisible();
    await expect(loadingIndicator(page)).toHaveCount(0);
  });
});
