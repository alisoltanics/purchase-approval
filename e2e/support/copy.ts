// DUPLICATE of frontend/src/copy.ts (frozen by T01), copied here because the e2e runner only mounts ./e2e
// and these tests must not import frontend code. If copy.ts changes, re-copy this file.
// FROZEN by task T01. Every user-visible string lives here; components import it and
// never hardcode text. Strings marked PRD are quoted verbatim from docs/PRD.md and must not change.
// Strings with {placeholders} are filled by `fill()` so that the whole sentence stays in one place.

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export const copy = {
  product: { name: "Purchase Approval" },

  shell: {
    signOut: "Sign out",
    navRequests: "Requests",
    signedInAs: "Signed in as {name}",
    company: "Company",
    roleEmployee: "Employee",
    roleManager: "Manager",
    skipToContent: "Skip to main content",
  },

  signIn: {
    title: "Sign in",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in…",
    emailRequired: "Enter your email.",
    passwordRequired: "Enter your password.",
    invalidCredentials: "Email or password is incorrect.", // PRD S1
    serviceFailure: "Sign-in is unavailable right now. Try again.",
    retry: "Try again",
  },

  session: {
    expired: "Your session has ended. Sign in to continue.",
    signedOut: "You have been signed out.",
  },

  requests: {
    title: "Requests",
    newRequest: "New request",
    statusFilterLabel: "Status",
    statusAll: "All statuses",
    statusPending: "Pending",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    columnReference: "Reference",
    columnTitle: "Title",
    columnVendor: "Vendor",
    columnAmount: "Amount",
    columnStatus: "Status",
    columnSubmitted: "Submitted",
    columnRequester: "Requester",
    previous: "Previous",
    next: "Next",
    pageIndicator: "Page {page} of {pageCount}",
    loading: "Loading requests…",
    empty: "There are no requests yet.",
    filteredEmpty: "No requests match this filter.",
    clearFilter: "Clear filter",
    loadFailure: "Requests could not be loaded.",
    retry: "Try again",
  },

  newRequest: {
    title: "New request",
    titleLabel: "Title",
    vendorLabel: "Vendor name",
    descriptionLabel: "Description / business justification",
    amountLabel: "Amount",
    currencyLabel: "USD",
    amountHint: "Use a period for decimals, up to two decimal places, for example 25.50.",
    submit: "Submit request",
    submitting: "Submitting…",
    cancel: "Cancel",
    submitted: "Request submitted.", // PRD S3
    submitFailure: "Your request could not be submitted. Your entries are kept. Try again.",
    duplicateKeyConflict:
      "A request was already submitted from this form. Check Requests before submitting again.",
    discardTitle: "Discard this request?",
    discardBody: "You have unsaved changes. If you leave now, they will be lost.",
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
      required: "Enter a title.",
      tooLong: "Use at most {max} characters.",
      invalidCharacters: "Use a single line of text, without line breaks or control characters.",
    },
    vendor: {
      required: "Enter the vendor name.",
      tooLong: "Use at most {max} characters.",
      invalidCharacters: "Use a single line of text, without line breaks or control characters.",
    },
    description: {
      required: "Enter a description or business justification.",
      tooLong: "Use at most {max} characters.",
      invalidCharacters: "Remove control characters from the text.",
    },
    amount: {
      required: "Enter an amount.",
      invalidFormat:
        "Enter a positive number using digits and a period, with no currency symbol or separators, for example 25.50.",
      tooManyDecimals: "Use at most two decimal places.",
      outOfRange: "Enter an amount from 0.01 to 999,999.99.",
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
