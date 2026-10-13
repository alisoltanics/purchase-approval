import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useRequestSummary } from "../api/queries";
import { useAuth, useCurrentUser } from "../auth/AuthContext";
import { copy } from "../copy";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Avatar } from "./Avatar";
import { Icon } from "./icons";
import styles from "../styles/shell.module.css";

// Matches the design's mobile breakpoint: the sidebar gives way to a compact header.
const NARROW_QUERY = "(max-width: 760px)";

function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark}>
        <Icon name="check" />
      </span>
      <span className={styles.brandName}>{copy.product.name}</span>
    </div>
  );
}

function currentCrumb(pathname: string): string {
  if (pathname === "/requests/new") return copy.newRequest.title;
  if (pathname.startsWith("/requests/")) return copy.shell.crumbDetails;
  return copy.requests.title;
}

export function Shell() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const narrow = useMediaQuery(NARROW_QUERY);
  const summary = useRequestSummary();
  const role = user.role === "manager" ? copy.shell.roleManager : copy.shell.roleEmployee;

  // The session guard sends the signed-out visitor to sign-in.
  async function handleSignOut() {
    await signOut();
  }

  const signOutButton = (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={copy.shell.signOut}
      title={copy.shell.signOut}
      onClick={() => void handleSignOut()}
    >
      <Icon name="logout" />
    </button>
  );

  return (
    <div className={styles.frame}>
      <a className={styles.skipLink} href="#main-content">
        {copy.shell.skipToContent}
      </a>
      {narrow ? null : (
        <aside className={styles.sidebar}>
          <Brand />
          <div className={styles.workspace}>
            <span className={styles.workspaceMark}>
              <Icon name="building" />
            </span>
            <div>
              <div className={styles.workspaceName}>{user.company.name}</div>
              <div className={styles.workspaceCaption}>{copy.shell.workspaceCaption}</div>
            </div>
          </div>
          <div className={styles.navHeading}>{copy.shell.navHeading}</div>
          <nav aria-label={copy.shell.mainNavigation}>
            <NavLink to="/requests" className={styles.navItem}>
              <Icon name="inbox" />
              {copy.shell.navRequests}
              {summary.data ? (
                <span className={styles.navCount} aria-hidden="true">
                  {summary.data.all}
                </span>
              ) : null}
            </NavLink>
          </nav>
          <div className={styles.spacer} />
          <div className={styles.flowGuide}>
            <div className={styles.flowTitle}>{copy.shell.flowTitle}</div>
            <div className={styles.flowStep}>
              <span className={styles.flowDot}>1</span>
              {copy.shell.flowSubmit}
            </div>
            <div className={styles.flowStep}>
              <span className={styles.flowDot}>2</span>
              {copy.shell.flowReview}
            </div>
            <div className={styles.flowStep}>
              <span className={styles.flowDot}>
                <Icon name="check" />
              </span>
              {copy.shell.flowDecision}
            </div>
          </div>
          <div className={styles.profile}>
            <Avatar id={user.id} name={user.display_name} className={styles.profileAvatar} />
            <div className={styles.profileText}>
              <div className={styles.profileName}>{user.display_name}</div>
              <div className={styles.profileRole}>{role}</div>
            </div>
            {signOutButton}
          </div>
        </aside>
      )}
      <div className={styles.main}>
        <header className={styles.topbar}>
          {narrow ? (
            <div className={styles.mobileBrand}>
              <Brand />
            </div>
          ) : (
            <div className={styles.breadcrumbs}>
              <Icon name="building" />
              <span>{user.company.name}</span>
              <Icon name="chevronRight" className={styles.crumbArrow} />
              <span className={styles.crumbCurrent}>{currentCrumb(pathname)}</span>
            </div>
          )}
          <div className={styles.topbarRight}>
            <span className={styles.topbarNote}>{copy.shell.topbarNote}</span>
            {narrow ? signOutButton : null}
          </div>
        </header>
        {narrow ? (
          <div className={styles.mobileContext}>
            <span>{user.company.name}</span>
            <span>
              <span>{user.display_name}</span> · {role}
            </span>
          </div>
        ) : null}
        <main id="main-content" className={styles.content} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
