# Purchase Approval — Product Requirements Document

**Version:** 1.0  
**Date:** October 10, 2026  
**Status:** Proposed product baseline, ready for review and UI/UX design  
**Audience:** Product, design, new full stack developer, team lead, and coding/testing agents  
**Delivery target:** A working staging application within two development days, after the product specification and UI/UX are supplied.

## 1. Product summary

Purchase Approval is a small B2B web application where employees submit proposed purchases and managers approve or reject them. Each company has its own users and requests. A requester can track a decision and see who made it.

The application records an approval decision only. It does not place orders, move money, reserve budgets, or contact vendors.

This product is an onboarding exercise for the team's AI-assisted development process:

1. Product supplies this PRD.
2. Design supplies the UI/UX based on this PRD.
3. The team prepares acceptance and end-to-end test scenarios.
4. The developer defines architecture and an agent execution plan.
5. The developer directs Claude Code to implement and test the application.
6. The developer reviews, finalizes, and deploys it with the team lead.

This document defines product behavior and measurable acceptance criteria. It does not prescribe an implementation architecture or include the finished visual design or executable test suite.

## 2. Goals and success criteria

### Product goals

- An employee can submit a purchase request using one short form.
- A manager can find pending requests and make an informed decision.
- A requester can see the current status and the reason for a rejection.
- Requests and decisions remain available after a page refresh or new login.
- Company boundaries and user permissions apply to every supported access path.

### Training goals

- Translate supplied product and design specifications into an appropriate architecture.
- Break implementation into bounded, verifiable tasks for Claude Code.
- Review generated code and use test evidence to establish correctness.
- Diagnose and resolve failures without weakening the agreed requirements.
- Deliver a staging application and explain its important technical decisions.

### Definition of success

All requirements and acceptance criteria in this document are satisfied; the supplied UI/UX is implemented; the critical user journeys work on staging; and the developer provides a reviewable change set, verification evidence, and setup/deployment instructions.

Speed is measured from the start of development to a verified staging release. Agent count and lines of generated code are not success metrics.

## 3. Scope and fixed exercise assumptions

The following are proposed defaults for this exercise, not assumptions about the company's real business. They provide a complete baseline for design and development.

| Decision | Baseline |
|---|---|
| Working product name | Purchase Approval |
| Interface language | English |
| Currency | USD only; always identify the currency in the interface |
| Companies | Two fictional companies, preconfigured |
| Membership | Each account belongs to exactly one company |
| Roles | Employee or Manager; exactly one role per account |
| Approvals | Any eligible manager in the same company can decide a pending request |
| Manager purchasing | Managers may submit requests, but cannot decide their own |
| Authentication | Preconfigured email/password accounts using the team's established authentication approach |
| Time display | Explicit UTC timestamps, formatted `10 Oct 2026, 14:30 UTC`; no timezone preference setting |
| Primary device | Desktop browser; usable at narrow mobile widths |
| Release destination | Team-provided staging environment using fictional data |

### Included

- Sign-in and sign-out.
- Company-scoped request list with status filtering and pagination.
- Request submission.
- Request details, decision information, and activity history.
- Approval and rejection with enforced permissions.
- Persistent storage, seeded demo data, automated verification, and staging deployment.

### Excluded

- Self-service signup, invitations, password recovery, and user or company administration.
- Company switching, multiple memberships, custom roles, or configurable permissions.
- Drafts, request editing, deletion, cancellation, withdrawal, reopening, or resubmission.
- Attachments, receipts, comments, mentions, and notifications.
- Approval assignment, multi-step approval, amount thresholds, and escalation.
- Budgets, taxes, exchange rates, payments, orders, and vendor integrations.
- Search, export, analytics, dashboard charts, or custom sorting.
- Real-time updates, offline operation, and native mobile apps.

Do not add these features during the two-day exercise. Product changes require an explicit update to the baseline rather than an agent choosing additional scope.

## 4. Users and permissions

**Employee:** Wants to request a purchase and understand its outcome.

**Manager:** Wants to review company purchase requests and record decisions. Also has the ability to submit personal requests.

| Action | Employee | Manager |
|---|---|---|
| Submit a request in own company | Yes | Yes |
| List and open own requests | Yes | Yes |
| List and open other users' requests in own company | No | Yes |
| See activity and rejection reasons on an accessible request | Yes | Yes |
| Approve or reject another user's pending request in own company | No | Yes |
| Approve or reject own request | No | No |
| Read or change another company's requests | No | No |
| Edit or delete a submitted request | No | No |
| Change a completed decision | No | No |

Permissions must be enforced by the server, including direct requests that bypass the interface. Hiding a button is not authorization.

The signed-in account determines the company, requester, and role. User-provided request fields or identifiers must not override those values.

For a request that does not exist or that the user cannot view, show the same neutral state: **“Request unavailable. It may not exist or you may not have access.”** Do not reveal another company's request details or whether its identifier exists.

## 5. Information and validation

### Request inputs

| Field | Required | Rules |
|---|---|---|
| Title | Yes | Trim leading/trailing whitespace; 1–120 characters after trimming; single line |
| Vendor name | Yes | Trim leading/trailing whitespace; 1–120 characters after trimming; single line; free text, not a vendor directory |
| Description / business justification | Yes | Trim leading/trailing whitespace; 1–2,000 characters after trimming; multiline plain text |
| Amount | Yes | USD 0.01–999,999.99 inclusive; at most two decimal places; no negative amounts, zero, currency symbols, thousands separators, or scientific notation |

The amount input accepts examples such as `25`, `25.5`, and `25.50`. Normalize these for display as `USD 25.00`, `USD 25.50`, and `USD 25.50`. Do not silently round an input such as `25.999`; reject it. Use a period as the decimal separator and explain the expected format next to the field.

Whitespace-only text is invalid. Treat all user-entered text as text, never executable markup. Apply the same validation rules at the server as in the form. Amounts must retain exact cent values through storage and retrieval.

### System-maintained information

Each request contains:

- A stable, unique reference suitable for display and direct linking. Its exact format is an architecture decision.
- Company identity and requester identity.
- All validated input fields and the fixed currency.
- Status: Pending, Approved, or Rejected.
- Submission timestamp.
- Decision maker and decision timestamp, when decided.
- Rejection reason, only when rejected.
- An activity history of submission and decision events.

Request references are identifiers, not access credentials. Knowing a reference never grants access.

### Decision inputs

Approval requires no additional text. Rejection requires a plain-text reason of 1–1,000 characters after trimming. Whitespace-only reasons are invalid. Do not collect an optional approval comment.

## 6. Lifecycle and business rules

| Current state | Action | Who may perform it | Result |
|---|---|---|---|
| No request | Submit valid form | Signed-in Employee or Manager | Create Pending request and submission event |
| Pending | Approve | Manager in the same company who is not the requester | Approved, with decision maker, time, and approval event |
| Pending | Reject with valid reason | Manager in the same company who is not the requester | Rejected, with reason, decision maker, time, and rejection event |
| Approved or Rejected | Any further decision | Nobody | Keep existing decision; communicate that it is already decided |

Additional rules:

- Submission is immediate: there is no draft or separate “send for approval” step.
- All submitted fields are read-only thereafter.
- There are no amount-based eligibility rules.
- One eligible manager's decision is final; multiple managers do not need to agree.
- A manager's own request remains Pending until another manager decides it. If none is available, the product does not bypass this rule.
- Exactly one decision may win if two managers act at the same time. A losing action must not replace the decision or create another decision event.
- Repeating an action on an already-decided request must not add activity or change the recorded decision. Refresh the displayed record and explain that it has already been decided.
- A successful submission or decision includes its associated activity event. Do not report success with a missing event or a partially saved record.

## 7. Screen and interaction requirements

This inventory is the input to the next UI/UX phase. Layout, visual style, spacing, typography, and component selection remain design work.

### S1 — Sign in

**Purpose:** Enter the application using a preconfigured account.

Elements:

- Product name, email field, password field, and Sign in action.
- Loading, validation, and sign-in failure feedback.
- No signup or password recovery link.

Behavior:

- Required-field errors appear at the relevant inputs.
- Invalid credentials produce **“Email or password is incorrect.”** Do not identify which credential failed.
- A service failure produces a retryable error distinct from invalid credentials.
- On successful ordinary sign-in, navigate to the request list.
- An unauthenticated direct link to an application page requires sign-in, then returns to that page if authorized. An inaccessible request displays the neutral unavailable state.
- Do not clear the email on failure. Never display the password in errors or logs.

### Shared signed-in shell

- Display product name, company name, signed-in user's display name and role, and Sign out.
- Provide clear navigation back to Requests.
- Refreshing a page preserves a valid authenticated session.
- Signing out ends that session; protected data must not remain accessible through browser back navigation.
- If a session expires during a read or write, require sign-in and do not report the pending action as successful. An unsaved form may be lost on reauthentication; cross-login draft recovery is out of scope.

### S2 — Requests

**Purpose:** Find relevant requests and understand their status.

Elements:

- Page title: Requests.
- Primary action: New request.
- Single-select status filter: All statuses, Pending, Approved, Rejected. Default: All statuses.
- Request list containing reference, title, vendor, amount/currency, status, and submission date. Managers also see requester name.
- Previous/Next pagination with up to 20 requests per page and a current page indicator.

Behavior:

- Employees see only their own requests; managers see all requests in their own company, including their own.
- Sort newest submissions first. Equal timestamps use a stable tie-breaker chosen by engineering; no visible sort controls are needed.
- Apply visibility and status filtering before pagination. Counts or pagination metadata must not expose inaccessible records.
- Changing the filter resets pagination to page one.
- Selecting a request opens its details.
- Returning from details preserves the prior filter and page when that page still exists; otherwise show the last valid page.
- Data refreshes on opening the list, changing its filter/page, or explicitly retrying a failed load. Automatic polling is not required.

States:

- Initial loading: clearly indicate that requests are loading; do not briefly show an empty state.
- No accessible requests: explain that there are no requests yet and offer New request.
- No filter matches: explain that no requests match and offer Clear filter.
- Load failure: show a retry action and do not present the failure as an empty list.

### S3 — New request

**Purpose:** Submit one purchase request.

Elements:

- Title, vendor name, description/business justification, and amount fields.
- USD label and amount-format guidance.
- Submit request and Cancel actions.

Behavior:

- Show input validation errors inline and move focus to the first invalid field after an attempted submission.
- During submission, indicate progress and prevent repeated activation of Submit request.
- On success, open the new request details and show **“Request submitted.”**
- A retry of the same submission after a lost response must not create a duplicate request. The technical approach is an engineering decision.
- If submission fails, preserve entered values and show a retryable error. Do not reset the form or display success before confirmation.
- Cancel returns to the originating list state. If fields contain user changes, ask whether to discard them before leaving through in-app navigation. No server-side draft is created.
- Browser-close recovery and preserving a form across a full reload are out of scope.

### S4 — Request details

**Purpose:** Read a request, review its history, and make an eligible decision.

Display:

- Reference, title, vendor, description, formatted amount, status, requester, and submission timestamp.
- Decision maker and timestamp for a decided request.
- A clearly labeled rejection reason for a rejected request.
- Activity history in chronological order, oldest first, showing event, actor, and timestamp. Preserve submission-before-decision order if timestamps tie.
- Back to Requests.

Decision controls:

- Show Approve and Reject only to an eligible manager on a Pending request.
- On a manager's own Pending request, show **“Another manager must review your request.”**
- Approve opens a confirmation showing the request title and amount, with Confirm approval and Cancel.
- Reject opens a dialog with a required reason, Confirm rejection, and Cancel.
- Canceling either dialog makes no changes. Reopening the rejection dialog starts with an empty reason.
- During a decision, disable repeated confirmation and show progress.
- On success, close the dialog and update status, decision information, and activity without requiring a manual reload.
- If another manager has already decided the request, show **“This request has already been decided.”** and display the latest authorized state.
- On an ordinary service/network failure, show an actionable error. Keep the rejection reason for retry and never imply a confirmed result before one is known.

Other states:

- Loading.
- Retryable service failure.
- Neutral unavailable state for nonexistent or inaccessible requests, with Back to Requests.

## 8. Activity history

Activity is a small, read-only product history, not a general-purpose auditing platform.

| Event | Required display information |
|---|---|
| Submitted | Requester name, submission time |
| Approved | Manager name, decision time |
| Rejected | Manager name, decision time, rejection reason |

Each request has exactly one submission event and at most one decision event. Users cannot edit or remove events. History follows the same visibility rules as the parent request. Failed attempts are not displayed as successful business events.

## 9. Error handling and consistency

- Validation failures explain how to correct the input and do not create or change a record.
- Permission failures do not change the request, decision, or history.
- Server and network failures provide useful feedback without exposing stack traces or secrets.
- Where a lost response leaves an outcome uncertain, retry/reload must reconcile with stored state and must not duplicate the action.
- Lists may become stale while open. The server always checks current permissions and status before accepting a decision.
- All displayed success states reflect persisted data, not a local-only simulated result.

## 10. Accessibility and supported presentation

- All inputs have visible labels; errors are associated with the affected fields.
- All core actions are operable by keyboard with visible focus.
- Dialogs move focus inside when opened, keep keyboard interaction within the dialog, and return focus to the triggering control when closed.
- Status uses text as well as color.
- Loading, success, and error feedback must be perceivable by assistive technology.
- Use sufficient text and control contrast consistent with the team's accessible component library.
- At a 390-pixel-wide viewport, all core journeys remain usable without page-level horizontal scrolling; the design may use cards or a contained scrolling list.
- Verify in the team's current supported desktop browser, with Chrome as the exercise baseline if no team standard exists. A full cross-browser certification exercise is out of scope.

## 11. Seeded demonstration data

Provide these fictional companies and accounts. Passwords and demo access instructions are supplied through the team's agreed staging mechanism, not hard-coded into client code or this PRD.

| Company | Person | Role | Account identifier |
|---|---|---|---|
| Northstar Labs | Alex Morgan | Employee | alex@northstar.example |
| Northstar Labs | Sam Rivera | Employee | sam@northstar.example |
| Northstar Labs | Jordan Lee | Manager | jordan@northstar.example |
| Northstar Labs | Taylor Chen | Manager | taylor@northstar.example |
| Harbor Works | Casey Patel | Employee | casey@harbor.example |
| Harbor Works | Riley Brooks | Manager | riley@harbor.example |

Seed at least eight requests with valid inputs:

- Northstar: two Pending requests from Alex, one Pending request from Sam, one Pending request from Jordan, one Approved request from Alex, and one Rejected request from Sam.
- Harbor: one Pending request from Casey and one Approved request from Casey.
- Each decided request includes a valid decision maker, timestamps, and matching history. Northstar decisions may be made by Jordan; Harbor's by Riley.
- Use different vendors, titles, and amounts. At least one description spans multiple lines.
- Test-only fixtures additionally cover an empty list, no matching results, and more than 20 accessible requests.

The seed/reset process must be repeatable in an authorized development/test environment so each verification run can start from known data. Resetting a shared staging environment should follow the team's usual coordination process.

## 12. Acceptance criteria

These IDs are the stable reference for design annotations, agent tasks, and the later acceptance/E2E test catalog. They define expected outcomes rather than prescribing test tooling. Automated checks may cover more than one criterion, but each criterion needs an identified verification method.

| ID | Scenario | Required outcome |
|---|---|---|
| AC-01 | Valid preconfigured account signs in | Correct company, identity, and role are shown; ordinary sign-in opens Requests |
| AC-02 | Invalid credentials or missing login input | Useful validation or generic credential error; no authenticated access |
| AC-03 | Open a protected direct link while signed out | Sign-in is required; successful sign-in returns to the authorized destination or neutral unavailable state |
| AC-04 | Refresh, sign out, and attempt protected access | Valid session survives refresh; sign-out removes protected access, including back navigation |
| AC-05 | Employee opens Requests | Only that employee's own company requests appear |
| AC-06 | Manager opens Requests | All and only that manager's company requests appear, including their own |
| AC-07 | Filter and paginate requests | Correct status subset; newest-first stable order; at most 20 per page; filter change resets page |
| AC-08 | Navigate list → details → back | Prior filter/page is restored when valid |
| AC-09 | Employee or manager submits valid values | One Pending request is persisted with correct company/requester, exact amount, and one submission event; details open |
| AC-10 | Validate text field lengths and whitespace | Required/maximum rules hold at the boundary; invalid values create no request; outer whitespace is trimmed |
| AC-11 | Validate amount | 0.01 and 999999.99 accepted; zero, negatives, excess precision, unsupported formats, and out-of-range values rejected by UI and server |
| AC-12 | Repeated click or retry after uncertain submission | The same submission produces no duplicate request; failed input remains available for correction/retry |
| AC-13 | Cancel a changed new-request form | Discard confirmation is shown; continuing editing preserves values; confirmed discard creates no request |
| AC-14 | Open an accessible request | All required fields and correctly ordered activity appear; text is safely rendered; USD and UTC are explicit |
| AC-15 | Eligible manager approves | Confirmation precedes action; status becomes Approved; actor, time, and exactly one decision event are saved |
| AC-16 | Eligible manager rejects | Valid reason is required; status becomes Rejected; reason, actor, time, and exactly one decision event are saved |
| AC-17 | Invalid rejection reason | Empty, whitespace-only, or over-1,000-character reason rejected without a decision; boundary-length valid reason accepted |
| AC-18 | Cancel a decision dialog | No request or activity changes; focus returns appropriately; canceled rejection text is discarded |
| AC-19 | Requester reads a decided request | Correct status, actor, time, and rejection reason where applicable are visible after refresh/new login |
| AC-20 | Employee attempts a decision through UI or direct request | No eligible controls; server rejects action; data and history remain unchanged |
| AC-21 | Manager attempts to decide their own request | Informational UI state; direct action rejected; another same-company manager can decide it |
| AC-22 | User attempts access across company boundaries | No list, detail, history, count, or mutation exposure, even with a known identifier |
| AC-23 | Employee attempts to open a colleague's request | Same neutral unavailable state as nonexistent request; no data disclosure |
| AC-24 | Client supplies a forged company, requester, role, or decision actor | Server does not trust those values or grant additional authority |
| AC-25 | Repeat or change a completed decision | Original decision and history remain intact; latest state and already-decided feedback are shown |
| AC-26 | Two managers submit competing decisions | Exactly one final decision and one decision event persist; losing client receives current-state feedback |
| AC-27 | Attempt unsupported edit/delete/reopen | No supported UI or mutation path permits the operation |
| AC-28 | Data load is empty, filtered empty, loading, or failed | Each has its specified distinct state and appropriate action; failure is never presented as no data |
| AC-29 | A write fails or its response is lost | No false success or partial business record; useful feedback; retry/reload reconciles without duplicate effects |
| AC-30 | Session expires during use | Protected action is not accepted without valid authentication; sign-in is required; no false success |
| AC-31 | Complete core journeys by keyboard and at narrow width | Usable labels, focus, dialogs, text statuses, and layout; no page-level horizontal overflow at 390px |
| AC-32 | Run on deployed staging | Employee submission → manager approval and rejection journeys work with persistent data; company isolation also holds |

### Verification expectations

- Business-rule tests cover field boundaries, amount handling, eligibility, and terminal states.
- Server/API integration tests verify authorization, company isolation, untrusted client fields, repeat actions, and competing decisions against persistent state.
- Browser E2E tests cover sign-in, submission, approval, rejection, filters, and user-visible permission states.
- Visual and keyboard checks compare the implementation to the supplied UI/UX and accessibility requirements.
- A staging smoke test exercises the deployed critical journey, not only a local build.
- Test expected behavior against this PRD. Changing an assertion to accommodate an implementation bug does not satisfy a criterion.

The detailed acceptance and E2E scenario documents are a later deliverable after UI/UX. The table above is their product source of truth.

## 13. Engineering ownership and delivery constraints

The developer owns the architecture, implementation plan, and agent coordination. They must document:

- Application structure, data model, and persistence choices.
- Authentication, company isolation, and permission enforcement.
- How repeat submissions and competing decisions preserve consistency.
- Test approach, deployment approach, and relevant tradeoffs.
- Agent task boundaries, dependencies, shared interfaces, and verification evidence.

Use the team's normal stack and established components where available. Product does not require microservices, a queue, a workflow engine, or a specific agent count. Keep the solution proportionate to the two-day scope.

Before the development clock starts, the team lead supplies repository access, stack conventions, Claude Code access, an authentication path, hosting access, and the completed design/test package. Access and infrastructure issues should not become unplanned learning objectives.

If delivery is at risk, raise the concrete blocker with the team lead. Do not silently remove permissions, verification, or required product behavior to claim completion.

## 14. Release definition of done

- All AC IDs have passing verification evidence or an explicitly documented product-approved change to the baseline.
- UI/UX matches the supplied design, including non-happy-path states.
- Required build, lint/type checks where applicable, and automated tests pass.
- No known defect remains that breaks a specified workflow, changes amounts/decisions incorrectly, or exposes another user's unauthorized data.
- Staging URL and the agreed demo access instructions are available to the team lead.
- Data persists across refreshes and application restarts/redeploys that retain the database.
- Setup, environment-variable names, migration/seed steps, testing, deployment, and rollback procedures are documented. Secret values are not committed.
- The reviewable change set includes architecture and agent execution notes, a summary of verification, and any limitations.
- The developer demonstrates both approval and rejection and explains the permission boundary and conflict handling.

## 15. UI/UX handoff for the next phase

Design the following from this baseline:

1. Sign-in screen and its validation/loading/failure states.
2. Shared signed-in shell with company, user, role, navigation, and sign-out.
3. Employee and manager request-list variants, status filter, pagination, loading, both empty states, and error state.
4. New-request form, field guidance, validation, submission progress/failure, and discard confirmation.
5. Request details in Pending, Approved, and Rejected states, including activity history.
6. Eligible-manager action controls and manager-own-request informational state.
7. Approval confirmation and rejection dialogs, including validation and retry states.
8. Unavailable-request, expired-session, and already-decided feedback.
9. Desktop layouts and narrow-width adaptations, with focus and keyboard interaction annotations.

UI/UX should preserve the field rules, role visibility, state transitions, and acceptance IDs in this document. Any proposed behavioral change should be recorded as a PRD revision before implementation.

**Next milestone:** Create and review the UI/UX for this defined scope.
