import { copy } from "../copy";
import type { RequestStatus } from "../api/types";
import styles from "../styles/badge.module.css";

const LABEL: Record<RequestStatus, string> = {
  pending: copy.requests.statusPending,
  approved: copy.requests.statusApproved,
  rejected: copy.requests.statusRejected,
};

const TONE: Record<RequestStatus, string | undefined> = {
  pending: styles.pending,
  approved: styles.approved,
  rejected: styles.rejected,
};

// Text plus a dot: the status never relies on colour alone (plan 7.5).
export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`${styles.status} ${TONE[status] ?? ""}`}>{LABEL[status]}</span>;
}
