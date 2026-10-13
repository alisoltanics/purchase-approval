import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../copy";
import { ALEX, JORDAN } from "../mocks/data";
import { resetMockSession } from "../mocks/handlers";
import { renderApp } from "../test/render";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubNarrowScreen(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("shell (supplied design)", () => {
  it("shows the workspace card, navigation, process guide and profile in the sidebar", async () => {
    resetMockSession(ALEX.id);
    renderApp("/requests");
    const sidebar = within(await screen.findByRole("complementary"));
    expect(sidebar.getByText(ALEX.company.name)).toBeInTheDocument();
    expect(sidebar.getByText(copy.shell.workspaceCaption)).toBeInTheDocument();
    expect(sidebar.getByText(copy.shell.navHeading)).toBeInTheDocument();
    expect(sidebar.getByRole("navigation", { name: copy.shell.mainNavigation })).toBeInTheDocument();
    expect(sidebar.getByText(copy.shell.flowTitle)).toBeInTheDocument();
    expect(sidebar.getByText(copy.shell.flowSubmit)).toBeInTheDocument();
    expect(sidebar.getByText(copy.shell.flowReview)).toBeInTheDocument();
    expect(sidebar.getByText(copy.shell.flowDecision)).toBeInTheDocument();
    expect(sidebar.getByText(ALEX.display_name)).toBeInTheDocument();
    expect(sidebar.getByText(copy.shell.roleEmployee)).toBeInTheDocument();
    expect(screen.getByText(copy.shell.topbarNote)).toBeInTheDocument();
  });

  it("shows the company and the current page in the breadcrumbs", async () => {
    resetMockSession(ALEX.id);
    renderApp("/requests");
    const crumbs = await screen.findByText(copy.shell.topbarNote);
    const topbar = within(crumbs.closest("header")!);
    expect(topbar.getByText(ALEX.company.name)).toBeInTheDocument();
    expect(topbar.getByText(copy.requests.title)).toBeInTheDocument();
  });

  it.each([
    ["/requests/new", copy.newRequest.title],
    ["/requests/abc", copy.shell.crumbDetails],
  ])("names %s in the breadcrumbs", async (path, crumb) => {
    resetMockSession(ALEX.id);
    renderApp(path);
    const note = await screen.findByText(copy.shell.topbarNote);
    expect(within(note.closest("header")!).getByText(crumb)).toBeInTheDocument();
  });

  it("marks Requests as the current page and shows the visible request total", async () => {
    resetMockSession(JORDAN.id);
    renderApp("/requests");
    const link = await screen.findByRole("link", { name: copy.shell.navRequests });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("6")).toBeInTheDocument();
  });

  it("signs out through the icon button in the profile", async () => {
    resetMockSession(ALEX.id);
    renderApp("/requests");
    const button = await screen.findByRole("button", { name: copy.shell.signOut });
    expect(button).toHaveAttribute("title", copy.shell.signOut);
    expect(within(screen.getByRole("complementary")).getByRole("button")).toBe(button);
    await userEvent.click(button);
    expect(
      await screen.findByRole("heading", { name: copy.signIn.title }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("has no prototype control", async () => {
    resetMockSession(ALEX.id);
    renderApp("/requests");
    await screen.findByRole("complementary");
    expect(screen.queryByText(/prototype/i)).not.toBeInTheDocument();
  });

  it("keeps a skip link to the main content", async () => {
    resetMockSession(ALEX.id);
    renderApp("/requests");
    const link = await screen.findByRole("link", { name: copy.shell.skipToContent });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(document.getElementById("main-content")).not.toBeNull();
  });

  it("uses the compact header on a narrow screen: brand, context line, sign-out in the top bar", async () => {
    stubNarrowScreen(true);
    resetMockSession(JORDAN.id);
    renderApp("/requests");
    const button = await screen.findByRole("button", { name: copy.shell.signOut });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(within(button.closest("header")!).getByRole("button")).toBe(button);
    expect(screen.getByText(copy.product.name)).toBeInTheDocument();
    expect(screen.getAllByText(JORDAN.company.name).length).toBeGreaterThan(0);
    const context = screen.getByText(JORDAN.display_name).parentElement;
    expect(context).toHaveTextContent(`${JORDAN.display_name} · ${copy.shell.roleManager}`);
    await userEvent.click(button);
    expect(
      await screen.findByRole("heading", { name: copy.signIn.title }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
