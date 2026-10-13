import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { isApiError } from "../../api/errors";
import { useRequestDetail } from "../../api/queries";
import type { RequestDetail, RequestEvent } from "../../api/types";
import { useCurrentUser } from "../../auth/AuthContext";
import { Avatar } from "../../components/Avatar";
import { BlankState } from "../../components/BlankState";
import { Icon, type IconName } from "../../components/icons";
import { StatusBadge } from "../../components/StatusBadge";
import { copy, fill } from "../../copy";
import { formatAmount, formatTimestamp } from "../../format/format";
import formStyles from "../../styles/form.module.css";
import styles from "../../styles/details.module.css";
import { DecisionDialog, type DecisionKind } from "./DecisionDialog";

function Amount({ amount, currency }: { amount: string; currency: string }) {
  return (
    // Built from the API string, ungrouped, as one text node: "USD 649.00" (plan 7.5).
    <div className={styles.largeAmount}>{formatAmount(amount, currency)}</div>
  );
}

function BackLink() {
  const location = useLocation();
  // D-39: the list link carries the list's search string, so Back returns to the same page/filter.
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch ?? "";
  return (
    <Link to={`/requests${listSearch}`} className={styles.backButton}>
      <Icon name="arrowLeft" />
      {copy.details.backToRequests}
    </Link>
  );
}

function Loading() {
  return (
    <section className={styles.card} aria-label={copy.details.loading}>
      <div className={styles.sectionHeader}>
        <h2>{copy.details.cardTitle}</h2>
      </div>
      <div aria-live="polite" aria-busy="true">
        <span className="sr-only">{copy.details.loading}</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div className={styles.skeletonRow} aria-hidden="true" key={index}>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        ))}
      </div>
    </section>
  );
}

const EVENT_TITLE: Record<RequestEvent["type"], string> = {
  submitted: copy.details.eventSubmitted,
  approved: copy.details.eventApproved,
  rejected: copy.details.eventRejected,
};
const EVENT_ICON: Record<RequestEvent["type"], IconName> = {
  submitted: "plus",
  approved: "check",
  rejected: "x",
};

function DecisionCard({
  request,
  mine,
  onDecide,
}: {
  request: RequestDetail;
  mine: boolean;
  onDecide: (kind: DecisionKind) => void;
}) {
  const d = copy.details;
  if (request.can_decide) {
    return (
      <>
        <div className={styles.decisionSymbol}>
          <Icon name="check" />
        </div>
        <h2>{d.readyTitle}</h2>
        <p>{d.readyText}</p>
        <div className={styles.decisionActions}>
          <button
            type="button"
            className={`${formStyles.button} ${formStyles.secondary}`}
            onClick={() => onDecide("reject")}
          >
            {d.reject}
          </button>
          <button type="button" className={formStyles.button} onClick={() => onDecide("approve")}>
            <Icon name="check" />
            {d.approve}
          </button>
        </div>
      </>
    );
  }
  if (request.status === "pending") {
    return (
      <>
        <div className={styles.decisionSymbol}>
          <Icon name="clock" />
        </div>
        <h2>{d.awaitingTitle}</h2>
        {/* PRD S4: shown on a manager's own pending request. */}
        <p>{mine ? d.ownRequestNotice : d.awaitingText}</p>
      </>
    );
  }
  const approved = request.status === "approved";
  return (
    <>
      <div className={styles.decisionSymbol}>
        <Icon name={approved ? "check" : "x"} />
      </div>
      <h2>{approved ? d.approvedTitle : d.rejectedTitle}</h2>
      <p>
        {fill(d.decidedText, {
          actor: request.decided_by?.display_name ?? "",
          verb: approved ? d.verbApproved : d.verbRejected,
          time: request.decided_at ? formatTimestamp(request.decided_at) : "",
        })}
      </p>
    </>
  );
}

function Details({ request }: { request: RequestDetail }) {
  const me = useCurrentUser();
  const [dialog, setDialog] = useState<{ kind: DecisionKind; trigger: HTMLElement | null } | null>(
    null,
  );
  const d = copy.details;
  const mine = me.role === "manager" && request.requester.id === me.id;

  return (
    <>
      <div className={styles.heading}>
        <div className={styles.referenceRow}>
          <span className={styles.reference}>
            <span className={styles.referenceLabel}>{d.referenceLabel}</span>
            <span>{request.id}</span>
          </span>
          <StatusBadge status={request.status} />
        </div>
        <h1>{request.title}</h1>
        <p>
          {fill(d.submittedBy, {
            actor: request.requester.display_name,
            time: formatTimestamp(request.submitted_at),
          })}
        </p>
      </div>
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="details-card-title">
          <div className={styles.sectionHeader}>
            <Icon name="file" />
            <h2 id="details-card-title">{d.cardTitle}</h2>
          </div>
          <div className={styles.body}>
            <dl className={styles.facts}>
              <div>
                <dt className={styles.factLabel}>{d.amountLabel}</dt>
                <dd>
                  <Amount amount={request.amount} currency={request.currency} />
                </dd>
              </div>
              <div>
                <dt className={styles.factLabel}>{d.vendorLabel}</dt>
                <dd className={styles.factValue}>{request.vendor}</dd>
              </div>
            </dl>
            <dl className={styles.facts}>
              <div>
                <dt className={styles.factLabel}>{d.statusLabel}</dt>
                <dd>
                  <StatusBadge status={request.status} />
                </dd>
              </div>
              <div>
                <dt className={styles.factLabel}>{d.submittedLabel}</dt>
                <dd className={styles.factValue}>{formatTimestamp(request.submitted_at)}</dd>
              </div>
            </dl>
            <div className={styles.factLabel}>{d.descriptionLabel}</div>
            <p className={styles.description}>{request.description}</p>
            <hr className={styles.separator} />
            <dl className={`${styles.facts} ${styles.factsLast}`}>
              <div>
                <dt className={styles.factLabel}>{d.requesterLabel}</dt>
                <dd className={styles.person}>
                  <Avatar id={request.requester.id} name={request.requester.display_name} />
                  <span>{request.requester.display_name}</span>
                </dd>
              </div>
              <div>
                <dt className={styles.factLabel}>{d.companyLabel}</dt>
                <dd className={styles.factValue}>{me.company.name}</dd>
              </div>
            </dl>
            {request.decided_by && request.decided_at ? (
              <dl className={`${styles.facts} ${styles.factsLast} ${styles.decisionFacts}`}>
                <div>
                  <dt className={styles.factLabel}>{d.decidedByLabel}</dt>
                  <dd className={styles.person}>
                    <Avatar id={request.decided_by.id} name={request.decided_by.display_name} />
                    <span>{request.decided_by.display_name}</span>
                  </dd>
                </div>
                <div>
                  <dt className={styles.factLabel}>{d.decidedAtLabel}</dt>
                  <dd className={styles.factValue}>{formatTimestamp(request.decided_at)}</dd>
                </div>
              </dl>
            ) : null}
            {request.rejection_reason ? (
              <div className={styles.reasonBox}>
                <h3>{d.rejectionReasonLabel}</h3>
                <p>{request.rejection_reason}</p>
              </div>
            ) : null}
          </div>
        </section>
        <aside className={styles.aside}>
          <div>
            <section
              className={`${styles.card} ${styles.decisionCard} ${styles[request.status]}`}
              aria-live="polite"
            >
              <DecisionCard
                request={request}
                mine={mine}
                onDecide={(kind) => {
                  setDialog({ kind, trigger: document.activeElement as HTMLElement | null });
                }}
              />
            </section>
            <p className={styles.footnote}>
              {request.status === "pending" ? d.footnotePending : d.footnoteDecided}
            </p>
          </div>
          <section className={`${styles.card} ${styles.historyCard}`} aria-labelledby="activity-title">
            <div className={styles.sectionHeader}>
              <Icon name="clock" />
              <h2 id="activity-title">{d.activityTitle}</h2>
            </div>
            <ol className={styles.timeline}>
              {request.events.map((event) => (
                <li className={styles.event} key={event.type}>
                  <span className={styles.eventDot}>
                    <Icon name={EVENT_ICON[event.type]} />
                  </span>
                  <div>
                    <h3>{fill(EVENT_TITLE[event.type], { actor: event.actor.display_name })}</h3>
                    <p>{formatTimestamp(event.created_at)}</p>
                    {event.reason ? <p className={styles.eventReason}>{event.reason}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      {dialog ? (
        <DecisionDialog
          kind={dialog.kind}
          request={request}
          trigger={dialog.trigger}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

export function RequestDetailsPage() {
  const { id = "" } = useParams();
  const query = useRequestDetail(id);

  let body;
  if (query.isPending) {
    body = <Loading />;
  } else if (query.isError) {
    // Every inaccessible id gets the same neutral state (PRD §4, D-10).
    const unavailable = isApiError(query.error, "request_unavailable");
    body = (
      <section className={styles.card}>
        <BlankState
          icon={unavailable ? "lock" : "refresh"}
          tone={unavailable ? "neutral" : "error"}
          title={unavailable ? copy.details.unavailableTitle : copy.details.loadFailureTitle}
          text={unavailable ? copy.details.unavailable : copy.details.loadFailure}
          action={
            unavailable ? (
              <BackLink />
            ) : (
              <button
                type="button"
                className={formStyles.button}
                onClick={() => void query.refetch()}
              >
                <Icon name="refresh" />
                {copy.details.retry}
              </button>
            )
          }
        />
      </section>
    );
  } else {
    body = <Details request={query.data} />;
  }

  return (
    <>
      {query.isError && isApiError(query.error, "request_unavailable") ? null : <BackLink />}
      {body}
    </>
  );
}
