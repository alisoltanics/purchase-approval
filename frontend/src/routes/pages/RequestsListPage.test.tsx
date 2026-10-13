import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../../App";
import type { RequestListItem } from "../../api/types";
import { copy, fill } from "../../copy";
import { ALEX, JORDAN, defaultRequests, makeListItem } from "../../mocks/data";
import { errorResponse, resetMockSession, setMockRequests } from "../../mocks/handlers";
import { server } from "../../mocks/server";
import { AppRoutes } from "../AppRoutes";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderList(path: string, userId: string) {
  resetMockSession(userId);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
        <LocationProbe />
      </AppProviders>
    </MemoryRouter>,
  );
}

const here = () => screen.getByTestId("location").textContent;
const pageText = (page: number, pageCount: number) =>
  fill(copy.requests.pageIndicator, { page: String(page), pageCount: String(pageCount) });
const footerText = (from: number, to: number, total: number) =>
  fill(copy.requests.showing, { from: String(from), to: String(to), total: String(total) });
const tab = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });
const previous = () => screen.getByRole("button", { name: copy.requests.previous });
const next = () => screen.getByRole("button", { name: copy.requests.next });
const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

async function listLoaded() {
  await screen.findByRole("table");
}

function many(count: number): RequestListItem[] {
  return Array.from({ length: count }, (_, index) => makeListItem(index + 1));
}

describe("employee view", () => {
  it("shows the page header, scope and only the employee's own requests", async () => {
    renderList("/requests", ALEX.id);
    await listLoaded();
    expect(screen.getByRole("heading", { level: 1, name: copy.requests.title })).toBeInTheDocument();
    expect(screen.getByText(copy.requests.subtitleEmployee)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: copy.requests.cardTitleEmployee })).toBeInTheDocument();
    expect(screen.getByText(copy.requests.scopeEmployee)).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
    expect(screen.queryByText("Team offsite catering")).not.toBeInTheDocument();
    expect(screen.queryByText("Premium coffee machine")).not.toBeInTheDocument();
  });

  it("has no requester column", async () => {
    renderList("/requests", ALEX.id);
    await listLoaded();
    expect(
      screen.queryByRole("columnheader", { name: copy.requests.columnRequester }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: copy.requests.columnRequest })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: copy.requests.columnSubmitted })).toBeInTheDocument();
  });

  it("shows reference, vendor, grouped USD amount, status and date for each row", async () => {
    renderList("/requests", ALEX.id);
    await listLoaded();
    const row = bodyRows().find((candidate) => within(candidate).queryByText("Annual design tool licenses"));
    expect(row).toBeDefined();
    const cells = within(row!);
    expect(cells.getByRole("link", { name: "Annual design tool licenses" })).toHaveAttribute(
      "href",
      `/requests/${defaultRequests()[1]!.id}`,
    );
    expect(cells.getByText(defaultRequests()[1]!.id)).toBeInTheDocument();
    expect(cells.getByText("Pixelforge Software")).toBeInTheDocument();
    expect(cells.getByText("USD")).toBeInTheDocument();
    expect(cells.getByText("4,200.00", { exact: false })).toBeInTheDocument();
    // Read as text (and by screen readers) the currency and the figure are separate words.
    expect(row!.textContent).toContain("USD 4,200.00");
    expect(cells.getByText(copy.requests.statusPending)).toBeInTheDocument();
    const time = cells.getByText("02 Oct 2026");
    expect(time).toHaveAttribute("datetime", "2026-10-02T13:40:00Z");
    expect(time).toHaveAttribute("title", "2 Oct 2026, 13:40 UTC");
  });

  it("lists newest submissions first", async () => {
    renderList("/requests", ALEX.id);
    await listLoaded();
    const titles = bodyRows().map((row) => within(row).getAllByRole("link")[0]?.textContent);
    expect(titles).toEqual([
      "Annual design tool licenses",
      "Standing desk for design team",
      "Laptop replacement",
    ]);
  });

  it("shows the status tabs with counts and the sidebar total", async () => {
    renderList("/requests", ALEX.id);
    await listLoaded();
    expect(await screen.findByRole("button", { name: `${copy.requests.statusAll}3` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(tab(copy.requests.statusPending)).toHaveTextContent(`${copy.requests.statusPending}2`);
    expect(tab(copy.requests.statusApproved)).toHaveTextContent(`${copy.requests.statusApproved}1`);
    expect(tab(copy.requests.statusRejected)).toHaveTextContent(`${copy.requests.statusRejected}0`);
    expect(within(screen.getByRole("navigation")).getByRole("link")).toHaveTextContent(
      `${copy.shell.navRequests}3`,
    );
  });

  it("shows the pending banner and its link filters to pending", async () => {
    renderList("/requests", ALEX.id);
    expect(
      await screen.findByText(fill(copy.requests.attentionMany, { count: "2" })),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.requests.attentionNoteEmployee)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: copy.requests.viewPending }));
    expect(here()).toBe("/requests?status=pending");
    expect(tab(copy.requests.statusPending)).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the footer count, page indicator and privacy line", async () => {
    renderList("/requests", ALEX.id);
    await listLoaded();
    expect(screen.getByText(footerText(1, 3, 3))).toBeInTheDocument();
    expect(screen.getByText(pageText(1, 1))).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
    expect(
      screen.getByText(
        fill(copy.requests.privateTo, {
          company: ALEX.company.name,
          scope: copy.requests.scopeFootEmployee,
        }),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.requests.footRight)).toBeInTheDocument();
  });

  it("opens the request from its title link", async () => {
    renderList("/requests", ALEX.id);
    await listLoaded();
    await userEvent.click(screen.getByRole("link", { name: "Laptop replacement" }));
    expect(here()).toBe(`/requests/${defaultRequests()[4]!.id}`);
  });

  it("offers New request in the header", async () => {
    renderList("/requests", ALEX.id);
    await listLoaded();
    await userEvent.click(screen.getAllByRole("link", { name: copy.requests.newRequest })[0]!);
    expect(here()).toBe("/requests/new");
  });
});

describe("manager view", () => {
  it("shows the company's requests with the requester column", async () => {
    renderList("/requests", JORDAN.id);
    await listLoaded();
    expect(screen.getByText(copy.requests.subtitleManager)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: copy.requests.cardTitleManager })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: copy.requests.columnRequester })).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(6);
    const row = bodyRows().find((candidate) => within(candidate).queryByText("Team offsite catering"));
    expect(within(row!).getByText("Sam Rivera")).toBeInTheDocument();
    expect(screen.getByText(copy.requests.attentionNoteManager)).toBeInTheDocument();
  });

  it("counts pending requests across the company in the banner", async () => {
    renderList("/requests", JORDAN.id);
    expect(
      await screen.findByText(fill(copy.requests.attentionMany, { count: "4" })),
    ).toBeInTheDocument();
  });

  it("uses the singular banner for one pending request", async () => {
    setMockRequests([makeListItem(1), makeListItem(2, { status: "approved" })]);
    renderList("/requests", JORDAN.id);
    expect(
      await screen.findByText(fill(copy.requests.attentionOne, { count: "1" })),
    ).toBeInTheDocument();
  });

  it("says everything is up to date when nothing is pending", async () => {
    setMockRequests([makeListItem(1, { status: "approved" })]);
    renderList("/requests", JORDAN.id);
    expect(await screen.findByText(copy.requests.upToDateTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.requests.upToDateNote)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.requests.viewPending })).not.toBeInTheDocument();
  });

  it("names the company in the scope label and the privacy line", async () => {
    renderList("/requests", JORDAN.id);
    await listLoaded();
    const card = within(screen.getByRole("region", { name: copy.requests.cardLabel }));
    expect(card.getByText(JORDAN.company.name)).toBeInTheDocument();
    expect(
      screen.getByText(
        fill(copy.requests.privateTo, {
          company: JORDAN.company.name,
          scope: copy.requests.scopeFootManager,
        }),
      ),
    ).toBeInTheDocument();
  });
});

describe("status filter", () => {
  it("filters through the tabs and keeps the filter in the URL", async () => {
    renderList("/requests", JORDAN.id);
    await listLoaded();
    await userEvent.click(tab(copy.requests.statusApproved));
    expect(here()).toBe("/requests?status=approved");
    expect(await screen.findByText("Laptop replacement")).toBeInTheDocument();
    expect(screen.queryByText("Team offsite catering")).not.toBeInTheDocument();
    expect(tab(copy.requests.statusApproved)).toHaveAttribute("aria-pressed", "true");
    expect(tab(copy.requests.statusAll)).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(tab(copy.requests.statusAll));
    expect(here()).toBe("/requests");
    expect(await screen.findByText("Team offsite catering")).toBeInTheDocument();
  });

  it("starts from a filter given in the URL", async () => {
    renderList("/requests?status=rejected", JORDAN.id);
    expect(await screen.findByText("Premium coffee machine")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(1);
    expect(tab(copy.requests.statusRejected)).toHaveAttribute("aria-pressed", "true");
  });

  it("goes back to page one when the filter changes", async () => {
    setMockRequests(many(45));
    renderList("/requests?page=3", JORDAN.id);
    await screen.findByText(pageText(3, 3));
    await userEvent.click(tab(copy.requests.statusPending));
    expect(here()).toBe("/requests?status=pending");
    expect(await screen.findByText(pageText(1, 3))).toBeInTheDocument();
  });

  it("ignores an unknown status in the URL instead of failing", async () => {
    renderList("/requests?status=bogus", JORDAN.id);
    await listLoaded();
    expect(tab(copy.requests.statusAll)).toHaveAttribute("aria-pressed", "true");
    expect(bodyRows()).toHaveLength(6);
  });

  it("explains an empty filter and clears it", async () => {
    setMockRequests([makeListItem(1), makeListItem(2)]);
    renderList("/requests?status=approved", JORDAN.id);
    expect(await screen.findByText(copy.requests.filteredEmptyTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.requests.filteredEmptyText)).toBeInTheDocument();
    expect(screen.queryByText(copy.requests.emptyTitle)).not.toBeInTheDocument();
    expect(screen.getByText(copy.requests.noRequestsCount)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: copy.requests.clearFilter }));
    expect(here()).toBe("/requests");
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);
  });
});

describe("pagination", () => {
  it("pages through 45 requests, 20 at a time", async () => {
    setMockRequests(many(45));
    renderList("/requests", JORDAN.id);
    await screen.findByText(footerText(1, 20, 45));
    expect(screen.getByText(pageText(1, 3))).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(20);
    expect(previous()).toBeDisabled();
    await userEvent.click(next());
    expect(here()).toBe("/requests?page=2");
    expect(await screen.findByText(footerText(21, 40, 45))).toBeInTheDocument();
    expect(previous()).toBeEnabled();
    await userEvent.click(next());
    expect(await screen.findByText(footerText(41, 45, 45))).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(5);
    expect(next()).toBeDisabled();
    await userEvent.click(previous());
    expect(here()).toBe("/requests?page=2");
    expect(await screen.findByText(pageText(2, 3))).toBeInTheDocument();
  });

  it("keeps the filter while paging", async () => {
    setMockRequests(many(45));
    renderList("/requests?status=pending", JORDAN.id);
    await screen.findByText(pageText(1, 3));
    await userEvent.click(next());
    expect(here()).toBe("/requests?status=pending&page=2");
  });

  it("opens a deep-linked page", async () => {
    setMockRequests(many(45));
    renderList("/requests?page=2", JORDAN.id);
    expect(await screen.findByText(footerText(21, 40, 45))).toBeInTheDocument();
  });

  it("clamps a page past the end and rewrites the URL (D-12)", async () => {
    setMockRequests(many(45));
    renderList("/requests?page=99", JORDAN.id);
    expect(await screen.findByText(pageText(3, 3))).toBeInTheDocument();
    await screen.findByText(footerText(41, 45, 45));
    expect(here()).toBe("/requests?page=3");
  });

  it.each(["abc", "0", "-1", "1.5", ""])("treats page=%s as page one", async (page) => {
    setMockRequests(many(45));
    renderList(`/requests?page=${encodeURIComponent(page)}`, JORDAN.id);
    expect(await screen.findByText(pageText(1, 3))).toBeInTheDocument();
  });
});

describe("loading, empty and failure states", () => {
  it("shows a loading indicator and never flashes the empty state", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("/api/requests/", async () => {
        await gate;
        return HttpResponse.json({
          count: 0,
          page: 1,
          page_size: 20,
          page_count: 1,
          results: [],
        });
      }),
    );
    renderList("/requests", ALEX.id);
    const loading = await screen.findByRole("status", { name: copy.requests.loadingLabel });
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByText(copy.requests.loading).length).toBeGreaterThan(0);
    expect(screen.queryByText(copy.requests.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.requests.filteredEmptyTitle)).not.toBeInTheDocument();
    // No page indicator until there is data: "Page 1 of 1" would be a guess.
    expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
    release();
    expect(await screen.findByText(copy.requests.emptyTitle)).toBeInTheDocument();
  });

  it("explains an empty list and offers New request", async () => {
    setMockRequests([]);
    renderList("/requests", ALEX.id);
    expect(await screen.findByText(copy.requests.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.requests.emptyText)).toBeInTheDocument();
    expect(screen.getByText(copy.requests.noRequestsCount)).toBeInTheDocument();
    expect(screen.queryByText(copy.requests.clearFilter)).not.toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: copy.requests.newRequest });
    expect(links).toHaveLength(2);
    expect(links[1]).toHaveAttribute("href", "/requests/new");
  });

  it("shows a retryable failure, not an empty list, when the list cannot load", async () => {
    server.use(http.get("/api/requests/", () => errorResponse(500, "server_error")));
    renderList("/requests", ALEX.id);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.requests.loadFailureTitle);
    expect(alert).toHaveTextContent(copy.requests.loadFailureText);
    expect(screen.queryByText(copy.requests.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(copy.requests.unavailableCount)).toBeInTheDocument();

    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: copy.requests.retry }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.queryByText(copy.requests.loadFailureTitle)).not.toBeInTheDocument();
  });

  it("treats a network failure like any other load failure", async () => {
    server.use(http.get("/api/requests/", () => HttpResponse.error()));
    renderList("/requests", ALEX.id);
    expect(await screen.findByText(copy.requests.loadFailureTitle)).toBeInTheDocument();
  });

  it("still shows the list when only the counts fail", async () => {
    server.use(http.get("/api/requests/summary/", () => errorResponse(500, "server_error")));
    renderList("/requests", ALEX.id);
    await listLoaded();
    expect(bodyRows()).toHaveLength(3);
    expect(tab(copy.requests.statusPending)).toHaveTextContent(/^Pending$/);
    expect(screen.queryByText(copy.requests.upToDateTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(/awaiting a decision/)).not.toBeInTheDocument();
  });

  it("sends a lost session back to sign-in with the expiry message (AC-30)", async () => {
    server.use(http.get("/api/requests/", () => errorResponse(401, "not_authenticated")));
    renderList("/requests", ALEX.id);
    expect(await screen.findByRole("heading", { name: copy.signIn.title })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(copy.session.expired);
    expect(screen.queryByText("Annual design tool licenses")).not.toBeInTheDocument();
  });
});

describe("user text", () => {
  it("renders titles and vendors as plain text", async () => {
    setMockRequests([
      makeListItem(1, {
        title: "<img src=x onerror=alert(1)>",
        vendor: "<b>Bold & Co</b>",
      }),
    ]);
    renderList("/requests", JORDAN.id);
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(screen.getByText("<b>Bold & Co</b>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
