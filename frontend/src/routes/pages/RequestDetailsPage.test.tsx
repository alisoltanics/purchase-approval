import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../../App";
import { copy, fill } from "../../copy";
import { ALEX, JORDAN, SAM, defaultRequests, makeDetail } from "../../mocks/data";
import {
  decisionLog,
  errorResponse,
  resetMockSession,
  setMockDetail,
} from "../../mocks/handlers";
import { server } from "../../mocks/server";
import { AppRoutes } from "../AppRoutes";

const REQUESTS = defaultRequests();
const idOf = (index: number) => REQUESTS[index - 1]!.id;
const ALEX_PENDING = idOf(1); // Standing desk, 649.00, Alex
const SAM_PENDING = idOf(3); // Team offsite catering, 1250.50, Sam
const JORDAN_PENDING = idOf(4); // Conference travel, 2380.75, Jordan (a manager)
const ALEX_APPROVED = idOf(5);
const SAM_REJECTED = idOf(6);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderDetails(entry: string | { pathname: string; state: unknown }, userId: string) {
  resetMockSession(userId);
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <AppRoutes />
        <LocationProbe />
      </AppProviders>
    </MemoryRouter>,
  );
}

const here = () => screen.getByTestId("location").textContent;
const d = copy.details;
const approveButton = () => screen.getByRole("button", { name: d.approve });
const rejectButton = () => screen.getByRole("button", { name: d.reject });
const loaded = (title: string) => screen.findByRole("heading", { level: 1, name: title });

describe("reading a request", () => {
  it("shows reference, title, vendor, description, amount, status, requester and time", async () => {
    renderDetails(`/requests/${ALEX_PENDING}`, ALEX.id);
    await loaded("Standing desk for design team");
    expect(screen.getByText(ALEX_PENDING)).toBeInTheDocument();
    expect(screen.getAllByText(copy.requests.statusPending).length).toBeGreaterThan(0);
    expect(screen.getByText("Ergo Office Supply")).toBeInTheDocument();
    expect(screen.getByText(/^Details for Standing desk/)).toBeInTheDocument();
    expect(screen.getByText("USD 649.00")).toBeInTheDocument();
    expect(
      screen.getByText(
        fill(d.submittedBy, { actor: "Alex Morgan", time: "1 Oct 2026, 09:15 UTC" }),
      ),
    ).toBeInTheDocument();
  });

  it("shows multi-line descriptions and markup as plain text", async () => {
    setMockDetail(ALEX_PENDING, { description: "Line one\nLine two <b>bold</b>" });
    renderDetails(`/requests/${ALEX_PENDING}`, ALEX.id);
    await loaded("Standing desk for design team");
    const text = screen.getByText(/Line one/);
    expect(text.textContent).toBe("Line one\nLine two <b>bold</b>");
    expect(text.querySelector("b")).toBeNull();
  });

  it("lists the submission in the activity, with actor and time", async () => {
    renderDetails(`/requests/${ALEX_PENDING}`, ALEX.id);
    await loaded("Standing desk for design team");
    const activity = screen.getByRole("region", { name: d.activityTitle });
    const items = within(activity).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(fill(d.eventSubmitted, { actor: "Alex Morgan" }));
    expect(items[0]).toHaveTextContent("Alex Morgan");
    expect(items[0]).toHaveTextContent("1 Oct 2026, 09:15 UTC");
  });

  it("shows decider, time and activity for an approved request", async () => {
    renderDetails(`/requests/${ALEX_APPROVED}`, ALEX.id);
    await loaded("Laptop replacement");
    expect(screen.getAllByText(copy.requests.statusApproved).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        fill(d.decidedText, {
          actor: "Jordan Lee",
          verb: d.verbApproved,
          time: "5 Oct 2026, 11:00 UTC",
        }),
      ),
    ).toBeInTheDocument();
    const items = within(screen.getByRole("region", { name: d.activityTitle })).getAllByRole(
      "listitem",
    );
    expect(items.map((item) => item.querySelector("h3")?.textContent)).toEqual([
      fill(d.eventSubmitted, { actor: "Alex Morgan" }),
      fill(d.eventApproved, { actor: "Jordan Lee" }),
    ]);
    expect(screen.queryByText(d.rejectionReasonLabel)).not.toBeInTheDocument();
  });

  it("labels the rejection reason clearly on a rejected request", async () => {
    renderDetails(`/requests/${SAM_REJECTED}`, SAM.id);
    await loaded("Premium coffee machine");
    expect(screen.getAllByText(copy.requests.statusRejected).length).toBeGreaterThan(0);
    const box = screen.getByRole("heading", { name: d.rejectionReasonLabel }).parentElement!;
    expect(box).toHaveTextContent("Over budget for this quarter.");
    const items = within(screen.getByRole("region", { name: d.activityTitle })).getAllByRole(
      "listitem",
    );
    expect(items.map((item) => item.querySelector("h3")?.textContent)).toEqual([
      fill(d.eventSubmitted, { actor: "Sam Rivera" }),
      fill(d.eventRejected, { actor: "Jordan Lee" }),
    ]);
  });
});

describe("states", () => {
  it("shows loading first, never an empty or unavailable flash", async () => {
    renderDetails(`/requests/${ALEX_PENDING}`, ALEX.id);
    expect(await screen.findByText(d.loading)).toBeInTheDocument();
    expect(screen.queryByText(d.unavailableTitle)).not.toBeInTheDocument();
    await loaded("Standing desk for design team");
  });

  it("offers Retry after a service failure and recovers", async () => {
    server.use(
      http.get("/api/requests/:id/", () => errorResponse(500, "server_error"), { once: true }),
    );
    renderDetails(`/requests/${ALEX_PENDING}`, ALEX.id);
    expect(await screen.findByRole("alert")).toHaveTextContent(d.loadFailure);
    expect(screen.queryByText(d.unavailableTitle)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: d.retry }));
    await loaded("Standing desk for design team");
  });

  it.each([
    ["a nonexistent id", "00000000-0000-4000-8000-0000000fffff", ALEX.id],
    ["a malformed id", "not-a-uuid", ALEX.id],
    ["a colleague's request (employee)", SAM_PENDING, ALEX.id],
  ])("shows one neutral unavailable state for %s", async (_label, id, userId) => {
    renderDetails(`/requests/${id}`, userId);
    expect(await screen.findByRole("heading", { name: d.unavailableTitle })).toBeInTheDocument();
    expect(screen.getByText(d.unavailable)).toBeInTheDocument();
    expect(screen.queryByText("Team offsite catering")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: d.backToRequests })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: d.approve })).not.toBeInTheDocument();
  });

  it("returns to the list state it was opened from", async () => {
    renderDetails(
      { pathname: `/requests/${ALEX_PENDING}`, state: { listSearch: "?status=pending" } },
      ALEX.id,
    );
    await loaded("Standing desk for design team");
    await userEvent.click(screen.getByRole("link", { name: d.backToRequests }));
    await waitFor(() => expect(here()).toBe("/requests?status=pending"));
  });
});

describe("who sees decision controls", () => {
  it("shows Approve and Reject to a manager on someone else's pending request", async () => {
    renderDetails(`/requests/${ALEX_PENDING}`, JORDAN.id);
    await loaded("Standing desk for design team");
    expect(approveButton()).toBeInTheDocument();
    expect(rejectButton()).toBeInTheDocument();
  });

  it("hides them from an employee and does not show the manager notice", async () => {
    renderDetails(`/requests/${ALEX_PENDING}`, ALEX.id);
    await loaded("Standing desk for design team");
    expect(screen.queryByRole("button", { name: d.approve })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: d.reject })).not.toBeInTheDocument();
    expect(screen.queryByText(d.ownRequestNotice)).not.toBeInTheDocument();
    expect(screen.getByText(d.awaitingText)).toBeInTheDocument();
  });

  it("tells a manager that another manager must review their own request", async () => {
    renderDetails(`/requests/${JORDAN_PENDING}`, JORDAN.id);
    await loaded("Conference travel for Q4 summit");
    expect(screen.getByText("Another manager must review your request.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: d.approve })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: d.reject })).not.toBeInTheDocument();
  });

  it("offers no controls on a decided request", async () => {
    renderDetails(`/requests/${ALEX_APPROVED}`, JORDAN.id);
    await loaded("Laptop replacement");
    expect(screen.queryByRole("button", { name: d.approve })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: d.reject })).not.toBeInTheDocument();
    expect(screen.getByText(d.footnoteDecided)).toBeInTheDocument();
  });
});

describe("approving", () => {
  it("asks for confirmation with the title and amount, and changes nothing on Cancel", async () => {
    renderDetails(`/requests/${ALEX_PENDING}`, JORDAN.id);
    await loaded("Standing desk for design team");
    await userEvent.click(approveButton());
    const dialog = await screen.findByRole("dialog", { name: copy.approveDialog.title });
    expect(
      within(dialog).getByText(
        fill(copy.approveDialog.body, { title: "Standing desk for design team", amount: "USD 649.00" }),
      ),
    ).toBeInTheDocument();
    expect(decisionLog).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole("button", { name: copy.approveDialog.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(decisionLog).toHaveLength(0);
    await waitFor(() => expect(approveButton()).toHaveFocus());
  });

  it("closes the dialog and updates status, decision and activity without a reload", async () => {
    renderDetails(`/requests/${ALEX_PENDING}`, JORDAN.id);
    await loaded("Standing desk for design team");
    await userEvent.click(approveButton());
    await userEvent.click(
      await screen.findByRole("button", { name: copy.approveDialog.confirm }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(decisionLog).toEqual([{ id: ALEX_PENDING, decision: "approved" }]);
    expect((await screen.findAllByText(copy.requests.statusApproved)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Jordan Lee approved this request/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: d.approve })).not.toBeInTheDocument();
    const items = within(screen.getByRole("region", { name: d.activityTitle })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent(fill(d.eventApproved, { actor: "Jordan Lee" }));
    expect(screen.getByText(d.approvedToast)).toBeInTheDocument();
    expect(here()).toBe(`/requests/${ALEX_PENDING}`);
  });

  it("disables repeated confirmation and shows progress while saving", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    server.use(
      http.post("/api/requests/:id/approve/", async () => {
        calls += 1;
        await gate;
        return errorResponse(500, "server_error");
      }),
    );
    renderDetails(`/requests/${ALEX_PENDING}`, JORDAN.id);
    await loaded("Standing desk for design team");
    await userEvent.click(approveButton());
    const confirm = await screen.findByRole("button", { name: copy.approveDialog.confirm });
    await userEvent.click(confirm);
    const working = await screen.findByRole("button", { name: copy.approveDialog.working });
    expect(working).toBeDisabled();
    await userEvent.click(working);
    expect(calls).toBe(1);
    release();
    await screen.findByRole("button", { name: copy.approveDialog.confirm });
  });

  it("shows a retryable error on failure and never claims a decision", async () => {
    server.use(
      http.post("/api/requests/:id/approve/", () => errorResponse(500, "server_error"), {
        once: true,
      }),
    );
    renderDetails(`/requests/${ALEX_PENDING}`, JORDAN.id);
    await loaded("Standing desk for design team");
    await userEvent.click(approveButton());
    await userEvent.click(
      await screen.findByRole("button", { name: copy.approveDialog.confirm }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(d.decisionFailure);
    expect(screen.queryByText(d.approvedToast)).not.toBeInTheDocument();
    expect(screen.getAllByText(copy.requests.statusPending).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: copy.approveDialog.confirm }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(decisionLog).toHaveLength(1);
  });
});

describe("rejecting", () => {
  async function openReject() {
    renderDetails(`/requests/${ALEX_PENDING}`, JORDAN.id);
    await loaded("Standing desk for design team");
    await userEvent.click(rejectButton());
    return screen.findByRole("dialog", { name: copy.rejectDialog.title });
  }
  const reasonField = () => screen.getByLabelText(copy.rejectDialog.reasonLabel);

  it("requires a reason, shows the error inline and focuses the field", async () => {
    await openReject();
    expect(reasonField()).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: copy.rejectDialog.confirm }));
    expect(await screen.findByText(copy.validation.reason.required)).toBeInTheDocument();
    expect(reasonField()).toHaveFocus();
    expect(reasonField()).toHaveAccessibleDescription(
      new RegExp(copy.validation.reason.required),
    );
    expect(decisionLog).toHaveLength(0);
  });

  it("rejects a whitespace-only reason and one over 1,000 characters", async () => {
    await openReject();
    await userEvent.click(reasonField());
    await userEvent.paste("   \n  ");
    await userEvent.click(screen.getByRole("button", { name: copy.rejectDialog.confirm }));
    expect(await screen.findByText(copy.validation.reason.required)).toBeInTheDocument();
    await userEvent.clear(reasonField());
    await userEvent.paste("x".repeat(1001));
    await userEvent.click(screen.getByRole("button", { name: copy.rejectDialog.confirm }));
    expect(
      await screen.findByText(fill(copy.validation.reason.tooLong, { max: "1000" })),
    ).toBeInTheDocument();
    expect(decisionLog).toHaveLength(0);
  });

  it("shows the title and amount in the dialog", async () => {
    const dialog = await openReject();
    expect(
      within(dialog).getByText(
        fill(copy.rejectDialog.body, { title: "Standing desk for design team", amount: "USD 649.00" }),
      ),
    ).toBeInTheDocument();
  });

  it("records the reason and shows it in the details and the activity", async () => {
    await openReject();
    await userEvent.click(reasonField());
    await userEvent.paste("Too expensive.\nTry a cheaper model.");
    await userEvent.click(screen.getByRole("button", { name: copy.rejectDialog.confirm }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect((await screen.findAllByText(copy.requests.statusRejected)).length).toBeGreaterThan(0);
    const box = screen.getByRole("heading", { name: d.rejectionReasonLabel }).parentElement!;
    expect(box.querySelector("p")?.textContent).toBe("Too expensive.\nTry a cheaper model.");
    const items = within(screen.getByRole("region", { name: d.activityTitle })).getAllByRole(
      "listitem",
    );
    expect(items[1]).toHaveTextContent(fill(d.eventRejected, { actor: "Jordan Lee" }));
    expect(items[1]).toHaveTextContent("Too expensive.");
    expect(decisionLog).toEqual([{ id: ALEX_PENDING, decision: "rejected" }]);
  });

  it("starts empty every time the dialog opens after Cancel", async () => {
    await openReject();
    await userEvent.click(reasonField());
    await userEvent.paste("Not now");
    await userEvent.click(screen.getByRole("button", { name: copy.rejectDialog.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(decisionLog).toHaveLength(0);
    await waitFor(() => expect(rejectButton()).toHaveFocus());
    await userEvent.click(rejectButton());
    await screen.findByRole("dialog", { name: copy.rejectDialog.title });
    expect(reasonField()).toHaveValue("");
  });

  it("keeps the reason after a network failure and sends it again on retry", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(
        "/api/requests/:id/reject/",
        async ({ request }) => {
          bodies.push(await request.json());
          return errorResponse(500, "server_error");
        },
        { once: true },
      ),
    );
    await openReject();
    await userEvent.click(reasonField());
    await userEvent.paste("Budget frozen");
    await userEvent.click(screen.getByRole("button", { name: copy.rejectDialog.confirm }));
    expect(await screen.findByRole("alert")).toHaveTextContent(d.decisionFailure);
    expect(reasonField()).toHaveValue("Budget frozen");
    expect(screen.getAllByText(copy.requests.statusPending).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: copy.rejectDialog.confirm }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bodies).toEqual([{ reason: "Budget frozen" }]);
    expect(decisionLog).toEqual([{ id: ALEX_PENDING, decision: "rejected" }]);
  });
});

describe("a competing decision", () => {
  it("closes the dialog, explains, and shows the latest state (AC-25)", async () => {
    const latest = makeDetail({
      id: ALEX_PENDING,
      status: "rejected",
      decided_by: { id: JORDAN.id, display_name: "Taylor Chen" },
      decided_at: "2026-10-13T09:00:00Z",
      rejection_reason: "Already rejected elsewhere.",
      events: [
        {
          type: "submitted",
          actor: { id: ALEX.id, display_name: ALEX.display_name },
          created_at: "2026-10-01T09:15:00Z",
          reason: null,
        },
        {
          type: "rejected",
          actor: { id: JORDAN.id, display_name: "Taylor Chen" },
          created_at: "2026-10-13T09:00:00Z",
          reason: "Already rejected elsewhere.",
        },
      ],
    });
    server.use(
      http.post("/api/requests/:id/approve/", () =>
        errorResponse(409, "already_decided", { request: latest }),
      ),
    );
    renderDetails(`/requests/${ALEX_PENDING}`, JORDAN.id);
    await loaded("Standing desk for design team");
    await userEvent.click(approveButton());
    await userEvent.click(
      await screen.findByRole("button", { name: copy.approveDialog.confirm }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("This request has already been decided.")).toBeInTheDocument();
    expect(screen.getAllByText(copy.requests.statusRejected).length).toBeGreaterThan(0);
    expect(screen.getByText(/Taylor Chen rejected this request/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: d.approve })).not.toBeInTheDocument();
    expect(screen.queryByText(d.approvedToast)).not.toBeInTheDocument();
  });

  it("falls back to reloading the request when the 409 carries no state", async () => {
    server.use(
      http.post("/api/requests/:id/approve/", () => errorResponse(409, "already_decided")),
    );
    renderDetails(`/requests/${ALEX_PENDING}`, JORDAN.id);
    await loaded("Standing desk for design team");
    await userEvent.click(approveButton());
    await userEvent.click(
      await screen.findByRole("button", { name: copy.approveDialog.confirm }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("This request has already been decided.")).toBeInTheDocument();
  });
});
