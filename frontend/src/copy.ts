// FROZEN by task T01. Every user-visible string lives here; components import it and
// never hardcode text. Strings marked PRD are quoted verbatim from docs/PRD.md and must not change.
// Strings with {placeholders} are filled by `fill()` so that the whole sentence stays in one place.

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export const copy = {
  product: { name: "Purchase Approval" },

  // Shell and list wording follows the supplied design (docs/purchase-approval.html) exactly;
  // changed from the T01 text at the owner's request.
  shell: {
    signOut: "Sign out",
    navRequests: "Requests",
    navHeading: "Workspace",
    mainNavigation: "Main navigation",
    workspaceCaption: "Company workspace",
    flowTitle: "A simpler approval process",
    flowSubmit: "Submit your request",
    flowReview: "Your manager reviews",
    flowDecision: "Get a clear decision",
    topbarNote: "A little clarity. A lot of progress.",
    crumbDetails: "Request details",
    roleEmployee: "Employee",
    roleManager: "Manager",
    skipToContent: "Skip to main content",
  },

  // Sign-in wording follows the supplied design (docs/purchase-approval.html) exactly; changed
  // from the T01 text at the owner's request. Text with \n is rendered with white-space: pre-line.
  signIn: {
    eyebrow: "A little clarity goes a long way",
    title: "Welcome back.",
    intro: "Sign in to request what you need\nand keep good work moving.",
    email: "Work email",
    emailPlaceholder: "you@company.com",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    submit: "Sign in",
    submitting: "Signing in…",
    emailRequired: "Please enter your work email.",
    passwordRequired: "Please enter your password.",
    invalidCredentials: "Email or password is incorrect.", // PRD S1
    serviceFailure: "We couldn’t sign you in right now. Please try again.",
    retry: "Try again",
    accessNote: "Need access? Contact your team administrator.",
    footer: "Purchase Approval · Your company workspace",
    art: {
      reference: "PR-1048",
      title: "Good work starts here.",
      text: "A simple request. Everything in one place.",
      initials: "AM",
      currency: "USD",
      amount: "900.00",
      approved: "Request approved",
      approvedNote: "You’re ready to move forward.",
      headline: "Simple requests.\nClear decisions.",
      tagline: "Give your team an easier way to ask,\nreview, and move forward together.",
      caption: "Less back and forth. More moving forward.",
    },
  },

  session: {
    expired: "Your session has expired. Please sign in again.",
    signedOut: "You have been signed out.",
  },

  requests: {
    title: "Requests",
    subtitleManager: "A clear view of what your team needs.",
    subtitleEmployee: "Everything you need. One simple request.",
    newRequest: "New request",
    attentionOne: "{count} request is awaiting a decision",
    attentionMany: "{count} requests are awaiting a decision",
    attentionNoteManager: "A quick review keeps good work moving.",
    attentionNoteEmployee: "You’ll find the latest status and decisions right here.",
    viewPending: "View pending",
    upToDateTitle: "Everything is up to date",
    upToDateNote: "No pending requests. You’re all caught up.",
    cardLabel: "Purchase requests",
    cardTitleManager: "Company requests",
    cardTitleEmployee: "Your requests",
    scopeEmployee: "Only visible to you and your managers",
    statusFilterLabel: "Filter requests by status",
    statusAll: "All requests",
    statusPending: "Pending",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    sortNote: "Newest first",
    captionManager: "Company purchase requests, newest first",
    captionEmployee: "Your purchase requests, newest first",
    columnRequest: "Request / vendor",
    columnRequester: "Requested by",
    columnAmount: "Amount",
    columnStatus: "Status",
    columnSubmitted: "Submitted (UTC)",
    columnOpen: "Open",
    showing: "Showing {from}–{to} of {total} requests",
    noRequestsCount: "0 requests",
    unavailableCount: "Requests unavailable",
    pageIndicator: "Page {page} of {pageCount}",
    previous: "Previous page",
    next: "Next page",
    loading: "Loading requests…",
    loadingLabel: "Loading requests",
    emptyTitle: "Your first request starts here",
    emptyText: "Need something to do your best work? Send a request to your manager.",
    filteredEmptyTitle: "No matching requests",
    filteredEmptyText: "There are no requests with this status. Try a different filter.",
    clearFilter: "Clear filter",
    loadFailureTitle: "Requests couldn’t be loaded",
    loadFailureText: "Something went wrong while loading your requests. Give it another try.",
    retry: "Retry",
    privateTo: "Private to {company} · {scope}",
    scopeFootManager: "Company requests",
    scopeFootEmployee: "Your requests only",
    footRight: "Amounts in USD · All times UTC",
  },

  // Wording follows the supplied design (docs/purchase-approval.html) exactly.
  newRequest: {
    title: "New purchase request",
    subtitle: "A few details to help your manager make a decision.",
    closeLabel: "Close new request",
    titleLabel: "Request title",
    titlePlaceholder: "e.g. Design software for the product team",
    vendorLabel: "Vendor name",
    vendorPlaceholder: "e.g. Figma",
    descriptionLabel: "Business justification",
    descriptionPlaceholder: "What do you need, and how will it help your work?",
    descriptionCounter: "{count} / 2,000",
    amountLabel: "Amount",
    amountPlaceholder: "0.00",
    currencyLabel: "USD",
    amountHint: "Use a period; up to 2 decimal places.",
    note: "Your request will be sent for review immediately. Submitted requests cannot be edited.",
    submit: "Submit request",
    submitting: "Submitting…",
    cancel: "Cancel",
    submitted: "Request submitted.", // PRD S3
    submittedNote: "Your manager can now review it.",
    submitFailure: "We couldn’t save your changes. Your details are still here. Please try again.",
    duplicateKeyConflict:
      "A request was already submitted from this form. Check Requests before submitting again.",
    discardTitle: "Discard this request?",
    discardBody: "Your details haven’t been submitted. Leaving now will discard your changes.",
    discardConfirm: "Discard changes",
    discardKeepEditing: "Keep editing",
  },

  details: {
    backToRequests: "Back to Requests",
    loading: "Loading request…",
    loadFailure: "This request could not be loaded.",
    retry: "Try again",
    unavailable: "Request unavailable. It may not exist or you may not have access.", // PRD §4
    referenceLabel: "Reference",
    titleLabel: "Title",
    vendorLabel: "Vendor",
    descriptionLabel: "Description",
    amountLabel: "Amount",
    statusLabel: "Status",
    requesterLabel: "Requester",
    submittedLabel: "Submitted",
    decidedByLabel: "Decided by",
    decidedAtLabel: "Decision time",
    rejectionReasonLabel: "Rejection reason",
    activityTitle: "Activity",
    eventSubmitted: "Submitted by {actor}",
    eventApproved: "Approved by {actor}",
    eventRejected: "Rejected by {actor}",
    approve: "Approve",
    reject: "Reject",
    ownRequestNotice: "Another manager must review your request.", // PRD S4
    alreadyDecided: "This request has already been decided.", // PRD S4
    decisionFailure:
      "The decision could not be confirmed. Reload the request to see its current state, then try again.",
    reloadRequest: "Reload request",
  },

  approveDialog: {
    title: "Approve this request?",
    body: "{title} — {amount}",
    confirm: "Confirm approval",
    cancel: "Cancel",
    working: "Approving…",
  },

  rejectDialog: {
    title: "Reject this request",
    body: "{title} — {amount}",
    reasonLabel: "Reason for rejection",
    reasonHint: "Required. Up to 1,000 characters.",
    confirm: "Confirm rejection",
    cancel: "Cancel",
    working: "Rejecting…",
  },

  status: {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  },

  // Message per field error code (docs/api-contract.md section 5). Placeholders: {max}.
  validation: {
    required: "This field is required.",
    tooLong: "Use at most {max} characters.",
    invalidCharacters: "Remove characters that are not allowed.",
    invalidFormat: "Check the format of this value.",
    summary: "Check the highlighted fields.",
    title: {
      required: "Please enter a request title.",
      tooLong: "Use {max} characters or fewer.",
      invalidCharacters: "Please use a single line.",
    },
    vendor: {
      required: "Please enter a vendor name.",
      tooLong: "Use {max} characters or fewer.",
      invalidCharacters: "Please use a single line.",
    },
    description: {
      required: "Please enter a business justification.",
      tooLong: "Use {max} characters or fewer.",
      invalidCharacters: "Remove control characters from the text.",
    },
    amount: {
      required: "Enter an amount such as 25.00.",
      invalidFormat: "Enter an amount such as 25.00.",
      tooManyDecimals: "Enter an amount such as 25.00.",
      outOfRange: "Enter an amount from USD 0.01 to 999,999.99.",
    },
    reason: {
      required: "Enter a reason for the rejection.",
      tooLong: "Use at most {max} characters.",
      invalidCharacters: "Remove control characters from the text.",
    },
  },

  errors: {
    network: "The server could not be reached. Check your connection and try again.",
    server: "Something went wrong. Try again.",
    notFound: "Page not found.",
    csrfFailed: "Your session could not be verified. Reload the page and try again.",
    notPermitted: "You do not have permission to decide requests.",
  },

  a11y: {
    loadingStatus: "Loading",
    submittedStatus: "Request submitted.",
    closeDialog: "Close dialog",
  },
} as const;

export type Copy = typeof copy;
