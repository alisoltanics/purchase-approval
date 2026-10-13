import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { requestKeys, useRequestList, useRequestSummary } from "../../api/queries";
import type { RequestListItem, RequestStatus, RequestSummary } from "../../api/types";
import { useCurrentUser } from "../../auth/AuthContext";
import { Avatar } from "../../components/Avatar";
import { BlankState } from "../../components/BlankState";
import { Icon } from "../../components/icons";
import { StatusBadge } from "../../components/StatusBadge";
import { copy, fill } from "../../copy";
import { formatShortDate, formatTimestamp, groupThousands } from "../../format/format";
import formStyles from "../../styles/form.module.css";
import styles from "../../styles/requests.module.css";
import { buildListParams, parseListParams } from "./listParams";

type Tab = { status: RequestStatus | undefined; label: string; count: keyof RequestSummary };

const TABS: readonly Tab[] = [
  { status: undefined, label: copy.requests.statusAll, count: "all" },
  { status: "pending", label: copy.requests.statusPending, count: "pending" },
  { status: "approved", label: copy.requests.statusApproved, count: "approved" },
  { status: "rejected", label: copy.requests.statusRejected, count: "rejected" },
];

function SkeletonRows() {
  return (
    <div role="status" aria-label={copy.requests.loadingLabel} aria-busy="true">
      <span className="sr-only">{copy.requests.loading}</span>
      {Array.from({ length: 5 }, (_, index) => (
        <div className={styles.skeletonRow} aria-hidden="true" key={index}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ))}
    </div>
  );
}

function RequestRows({
  items,
  manager,
  listSearch,
}: {
  items: readonly RequestListItem[];
  manager: boolean;
  listSearch: string;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">
          {manager ? copy.requests.captionManager : copy.requests.captionEmployee}
        </caption>
        <colgroup>
          <col className={styles.requestCol} style={{ width: manager ? "33%" : "46%" }} />
          {manager ? <col className={styles.personCol} style={{ width: "18%" }} /> : null}
          <col className={styles.amountCol} style={{ width: "16%" }} />
          <col className={styles.statusCol} style={{ width: "14%" }} />
          <col className={styles.dateCol} style={{ width: manager ? "15%" : "20%" }} />
          <col className={styles.arrowCol} style={{ width: "4%" }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{copy.requests.columnRequest}</th>
            {manager ? (
              <th scope="col" className={styles.personCol}>
                {copy.requests.columnRequester}
              </th>
            ) : null}
            <th scope="col" className={styles.amountCol}>
              {copy.requests.columnAmount}
            </th>
            <th scope="col" className={styles.statusCol}>
              {copy.requests.columnStatus}
            </th>
            <th scope="col" className={styles.dateCol}>
              {copy.requests.columnSubmitted}
            </th>
            <th scope="col" className={styles.arrowCol}>
              <span className="sr-only">{copy.requests.columnOpen}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={manager ? undefined : styles.employeeRow}>
              <td>
                <span className={styles.requestTitle}>
                  <Link to={`/requests/${item.id}`} state={{ listSearch }}>
                    {item.title}
                  </Link>
                </span>
                <span className={styles.requestSub}>
                  <span className="mono">{item.id}</span>
                  <span aria-hidden="true">·</span>
                  <span className={styles.vendorName}>{item.vendor}</span>
                </span>
              </td>
              {manager ? (
                <td className={styles.personCol}>
                  <span className={styles.person}>
                    <Avatar
                      id={item.requester.id}
                      name={item.requester.display_name}
                      className={styles.personAvatar}
                    />
                    <span>{item.requester.display_name}</span>
                  </span>
                </td>
              ) : null}
              <td className={styles.amountCol}>
                <span className={styles.amount}>
                  <span className={styles.currency}>{item.currency}</span>
                  <span className="sr-only"> </span>
                  {groupThousands(item.amount)}
                </span>
              </td>
              <td className={styles.statusCol}>
                <StatusBadge status={item.status} />
              </td>
              <td className={styles.dateCol}>
                <time
                  className={styles.date}
                  dateTime={item.submitted_at}
                  title={formatTimestamp(item.submitted_at)}
                >
                  {formatShortDate(item.submitted_at)}
                </time>
              </td>
              <td className={styles.arrowCol}>
                <Icon name="chevronRight" className={styles.rowArrow} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RequestsListPage() {
  const user = useCurrentUser();
  const manager = user.role === "manager";
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { status, page } = parseListParams(searchParams);
  const list = useRequestList(status, page);
  const summary = useRequestSummary();

  // A page past the end is clamped by the server; the URL follows (D-12).
  const queryClient = useQueryClient();
  const served = list.data;
  useEffect(() => {
    if (served && served.page !== page) {
      // The answer is already the clamped page; seed it so the new URL does not load again.
      queryClient.setQueryData(requestKeys.list(status, served.page), served);
      setSearchParams(buildListParams({ status, page: served.page }), { replace: true });
    }
  }, [served, page, status, setSearchParams, queryClient]);

  function show(next: { status: RequestStatus | undefined; page: number }) {
    setSearchParams(buildListParams(next));
  }

  const pending = summary.data?.pending;
  const data = list.data;
  const pageCount = data?.page_count ?? 1;
  const currentPage = data?.page ?? page;
  const total = data?.count ?? 0;

  let body;
  if (list.isPending) {
    body = <SkeletonRows />;
  } else if (list.isError) {
    body = (
      <BlankState
        icon="refresh"
        tone="error"
        title={copy.requests.loadFailureTitle}
        text={copy.requests.loadFailureText}
        action={
          <button
            type="button"
            className={`${formStyles.button} ${formStyles.secondary} ${styles.blankButton}`}
            onClick={() => void list.refetch()}
          >
            <Icon name="refresh" />
            {copy.requests.retry}
          </button>
        }
      />
    );
  } else if (list.data.results.length === 0 && status) {
    body = (
      <BlankState
        icon="inbox"
        title={copy.requests.filteredEmptyTitle}
        text={copy.requests.filteredEmptyText}
        action={
          <button
            type="button"
            className={`${formStyles.button} ${styles.blankButton}`}
            onClick={() => show({ status: undefined, page: 1 })}
          >
            {copy.requests.clearFilter}
          </button>
        }
      />
    );
  } else if (list.data.results.length === 0) {
    body = (
      <BlankState
        icon="inbox"
        title={copy.requests.emptyTitle}
        text={copy.requests.emptyText}
        action={
          <Link to="/requests/new" className={`${formStyles.button} ${styles.blankButton}`}>
            {copy.requests.newRequest}
          </Link>
        }
      />
    );
  } else {
    body = (
      <RequestRows items={list.data.results} manager={manager} listSearch={location.search} />
    );
  }

  let footerText: string = copy.requests.noRequestsCount;
  if (list.isPending) footerText = copy.requests.loading;
  else if (list.isError) footerText = copy.requests.unavailableCount;
  else if (total > 0 && data) {
    footerText = fill(copy.requests.showing, {
      from: String((currentPage - 1) * data.page_size + 1),
      to: String(Math.min(currentPage * data.page_size, total)),
      total: String(total),
    });
  }

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>{copy.requests.title}</h1>
          <p>{manager ? copy.requests.subtitleManager : copy.requests.subtitleEmployee}</p>
        </div>
        <Link to="/requests/new" className={`${formStyles.button} ${styles.newButton}`}>
          <Icon name="plus" />
          {copy.requests.newRequest}
        </Link>
      </div>

      {pending === undefined ? null : pending > 0 ? (
        <div className={styles.attention}>
          <span className={styles.attentionIcon}>
            <Icon name="clock" />
          </span>
          <div>
            <div className={styles.attentionTitle}>
              {fill(pending === 1 ? copy.requests.attentionOne : copy.requests.attentionMany, {
                count: String(pending),
              })}
            </div>
            <p>
              {manager ? copy.requests.attentionNoteManager : copy.requests.attentionNoteEmployee}
            </p>
          </div>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => show({ status: "pending", page: 1 })}
          >
            <span>{copy.requests.viewPending}</span>
            <Icon name="arrowRight" />
          </button>
        </div>
      ) : (
        <div className={styles.attention}>
          <span className={styles.attentionIcon}>
            <Icon name="check" />
          </span>
          <div>
            <div className={styles.attentionTitle}>{copy.requests.upToDateTitle}</div>
            <p>{copy.requests.upToDateNote}</p>
          </div>
        </div>
      )}

      <section className={styles.card} aria-label={copy.requests.cardLabel}>
        <div className={styles.cardHeading}>
          <h2>{manager ? copy.requests.cardTitleManager : copy.requests.cardTitleEmployee}</h2>
          <span className={styles.scopeLabel}>
            <Icon name={manager ? "users" : "lock"} />
            {manager ? user.company.name : copy.requests.scopeEmployee}
          </span>
        </div>
        <div className={styles.filterBar}>
          <div className={styles.tabs} role="group" aria-label={copy.requests.statusFilterLabel}>
            {TABS.map((tab) => {
              const count = summary.data?.[tab.count];
              return (
                <button
                  type="button"
                  className={styles.tab}
                  aria-pressed={status === tab.status}
                  onClick={() => show({ status: tab.status, page: 1 })}
                  key={tab.count}
                >
                  {tab.label}
                  {count === undefined ? null : <span className={styles.count}>{count}</span>}
                </button>
              );
            })}
          </div>
          <span className={styles.sortNote}>
            <Icon name="arrowDown" />
            {copy.requests.sortNote}
          </span>
        </div>
        {body}
        <div className={styles.tableFooter}>
          <span>{footerText}</span>
          <div className={styles.pagination}>
            {list.data ? (
              <span className={styles.pageCount}>
                {fill(copy.requests.pageIndicator, {
                  page: String(currentPage),
                  pageCount: String(pageCount),
                })}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={copy.requests.previous}
              disabled={!list.data || currentPage <= 1}
              onClick={() => show({ status, page: currentPage - 1 })}
            >
              <Icon name="chevronLeft" />
            </button>
            <button
              type="button"
              aria-label={copy.requests.next}
              disabled={!list.data || currentPage >= pageCount}
              onClick={() => show({ status, page: currentPage + 1 })}
            >
              <Icon name="chevronRight" />
            </button>
          </div>
        </div>
      </section>

      <div className={styles.pageFoot}>
        <span>
          <Icon name="lock" />
          {fill(copy.requests.privateTo, {
            company: user.company.name,
            scope: manager ? copy.requests.scopeFootManager : copy.requests.scopeFootEmployee,
          })}
        </span>
        <span className={styles.footRight}>{copy.requests.footRight}</span>
      </div>
    </>
  );
}
