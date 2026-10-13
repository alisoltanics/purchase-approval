import { expect, type Locator, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { type Account } from "./accounts";
import { copy, fill } from "./copy";
import { demoPassword } from "./env";

export const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** Unique, readable title so each spec only touches requests it created. */
export function uniqueTitle(label: string): string {
  return `E2E ${label} ${randomBytes(4).toString("hex")}`;
}

export function roleLabel(account: Account): string {
  return account.role === "manager" ? copy.shell.roleManager : copy.shell.roleEmployee;
}

/** Whole page: the PRD does not specify the shell landmark, so shell text is looked up page-wide. */
export function shell(page: Page): Locator {
  return page.locator("body");
}

export async function fillSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel(copy.signIn.email, { exact: true }).fill(email);
  await page.getByLabel(copy.signIn.password, { exact: true }).fill(password);
}

export async function submitSignIn(page: Page): Promise<void> {
  await page.getByRole("button", { name: copy.signIn.submit, exact: true }).click();
}

/** Signs in through the UI. Ends on /requests unless `next` is given. */
export async function login(page: Page, account: Account, opts: { next?: string } = {}): Promise<void> {
  const target = opts.next ? `/login?next=${encodeURIComponent(opts.next)}` : "/login";
  await page.goto(target);
  await fillSignIn(page, account.email, demoPassword());
  await submitSignIn(page);
  await expect(page.getByText(account.name, { exact: true }).first()).toBeVisible();
  // The first screen loads its data after the shell appears. A test that then changes the session
  // (clears cookies, signs out) must not race that request: its response renews the cookie.
  await page.waitForLoadState("networkidle");
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: copy.shell.signOut, exact: true }).click();
  await expect(page.getByRole("button", { name: copy.signIn.submit, exact: true })).toBeVisible();
}

export interface NewRequestInput {
  title: string;
  vendor: string;
  description: string;
  amount: string;
}

export function sampleRequest(label: string, overrides: Partial<NewRequestInput> = {}): NewRequestInput {
  return {
    title: uniqueTitle(label),
    vendor: "E2E Vendor Ltd",
    description: "Created by the end-to-end suite.\nSecond line.",
    amount: "25.5",
    ...overrides,
  };
}

export async function openNewRequestForm(page: Page): Promise<void> {
  await page.goto("/requests/new");
  await expect(page.getByRole("heading", { name: copy.newRequest.title, exact: true })).toBeVisible();
}

export async function fillRequestForm(page: Page, input: NewRequestInput): Promise<void> {
  await page.getByLabel(copy.newRequest.titleLabel, { exact: true }).fill(input.title);
  await page.getByLabel(copy.newRequest.vendorLabel, { exact: true }).fill(input.vendor);
  await page.getByLabel(copy.newRequest.descriptionLabel, { exact: true }).fill(input.description);
  await page.getByLabel(copy.newRequest.amountLabel, { exact: true }).fill(input.amount);
}

export function submitButton(page: Page): Locator {
  return page.getByRole("button", { name: copy.newRequest.submit, exact: true });
}

/** Creates a request through the UI (form must be reachable). Returns its id (reference). */
export async function createRequest(page: Page, input: NewRequestInput): Promise<string> {
  await openNewRequestForm(page);
  await fillRequestForm(page, input);
  await submitButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/requests/${UUID_RE.source}$`));
  await expect(page.getByText(copy.newRequest.submitted, { exact: true }).first()).toBeVisible();
  const match = UUID_RE.exec(new URL(page.url()).pathname);
  if (!match) {
    throw new Error(`No request id in URL ${page.url()}`);
  }
  return match[0];
}

export async function openRequest(page: Page, id: string): Promise<void> {
  await page.goto(`/requests/${id}`);
}

export function unavailable(page: Page): Locator {
  return page.getByText(copy.details.unavailable, { exact: true });
}

export function approveButton(page: Page): Locator {
  return page.getByRole("button", { name: copy.details.approve, exact: true });
}

export function rejectButton(page: Page): Locator {
  return page.getByRole("button", { name: copy.details.reject, exact: true });
}

export function dialog(page: Page): Locator {
  return page.getByRole("dialog");
}

export function reasonField(page: Page): Locator {
  return dialog(page).getByLabel(copy.rejectDialog.reasonLabel, { exact: true });
}

export function formatAmount(amount: string): string {
  return `USD ${amount}`;
}

export function approveBody(title: string, amount: string): string {
  return fill(copy.approveDialog.body, { title, amount: formatAmount(amount) });
}

export function rejectBody(title: string, amount: string): string {
  return fill(copy.rejectDialog.body, { title, amount: formatAmount(amount) });
}

export async function approveViaUi(page: Page, title: string, amount: string): Promise<void> {
  await approveButton(page).click();
  await expect(dialog(page).getByText(approveBody(title, amount), { exact: true })).toBeVisible();
  await dialog(page).getByRole("button", { name: copy.approveDialog.confirm, exact: true }).click();
  await expect(dialog(page)).toBeHidden();
}

export async function rejectViaUi(page: Page, reason: string): Promise<void> {
  await rejectButton(page).click();
  await reasonField(page).fill(reason);
  await dialog(page).getByRole("button", { name: copy.rejectDialog.confirm, exact: true }).click();
  await expect(dialog(page)).toBeHidden();
}

/** Visible list row/card containing the title (list may render as table rows or cards). */
export function requestLink(page: Page, title: string): Locator {
  return page.getByRole("link", { name: title, exact: false });
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

export function pageIndicator(page: Page, current: number, total: number): Locator {
  return page.getByText(fill(copy.requests.pageIndicator, { page: String(current), pageCount: String(total) }), { exact: true });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The status filter is a group of toggle buttons; each one's name starts with its label and ends with its count. */
export function statusFilterGroup(page: Page): Locator {
  return page.getByRole("group", { name: copy.requests.statusFilterLabel, exact: true });
}

export function statusTab(page: Page, label: string): Locator {
  return statusFilterGroup(page).getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}`) });
}

export async function selectStatusFilter(page: Page, label: string): Promise<void> {
  await statusTab(page, label).click();
}

/** A list entry (table row or card) containing the text. The PRD leaves the layout open. */
export function listEntry(page: Page, text: string | RegExp): Locator {
  return page.getByRole("row").or(page.getByRole("listitem")).filter({ hasText: text });
}

function pagerControl(page: Page, name: string): Locator {
  return page.getByRole("button", { name, exact: true }).or(page.getByRole("link", { name, exact: true }));
}

export function previousControl(page: Page): Locator {
  return pagerControl(page, copy.requests.previous);
}

export function nextControl(page: Page): Locator {
  return pagerControl(page, copy.requests.next);
}

/** Visible text of every element that is exactly a fixture title ("Fixture request N"), in DOM order. */
export async function visibleFixtureTitles(page: Page): Promise<string[]> {
  return page.getByText(/^Fixture request \d+$/).locator("visible=true").allTextContents();
}

/** Walks every page of the current list with Next and returns all visible E2E-independent titles matching the pattern. */
export async function collectAllMatching(page: Page, pattern: RegExp): Promise<string[]> {
  const found: string[] = [];
  for (let guard = 0; guard < 50; guard += 1) {
    // The page indicator only appears once the page has loaded.
    await expect(page.getByText(/^Page \d+ of \d+$/)).toBeVisible();
    const texts = await page.getByText(pattern).locator("visible=true").allTextContents();
    found.push(...texts);
    const next = nextControl(page);
    if (await next.isDisabled()) {
      break;
    }
    const before = await page.getByText(/^Page \d+ of \d+$/).textContent();
    await next.click();
    // The old indicator stays in the DOM for a moment after the click; wait for the new page.
    await expect(page.getByText(/^Page \d+ of \d+$/)).not.toHaveText(before ?? "");
  }
  return found;
}

export function loadingIndicator(page: Page): Locator {
  return page.getByRole("status", { name: copy.requests.loadingLabel, exact: true });
}
