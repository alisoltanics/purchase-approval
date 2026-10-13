import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useCurrentUser } from "../auth/AuthContext";
import { copy, fill } from "../copy";
import { Icon } from "./icons";
import styles from "../styles/shell.module.css";

function initials(name: string): string {
  return Array.from(name.split(/\s+/).filter(Boolean), (word) => Array.from(word)[0] ?? "")
    .join("")
    .slice(0, 2);
}

export function Shell() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const role = user.role === "manager" ? copy.shell.roleManager : copy.shell.roleEmployee;

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className={styles.frame}>
      <a className={styles.skipLink} href="#main-content">
        {copy.shell.skipToContent}
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Icon name="check" />
          </span>
          <span className={styles.brandName}>{copy.product.name}</span>
        </div>
        <div className={styles.workspace}>
          <span className={styles.workspaceMark}>
            <Icon name="building" />
          </span>
          <div>
            <div className={styles.workspaceName}>{user.company.name}</div>
            <div className={styles.workspaceCaption}>{copy.shell.company}</div>
          </div>
        </div>
        <nav aria-label={copy.shell.navRequests}>
          <NavLink to="/requests" className={styles.navItem}>
            <Icon name="inbox" />
            {copy.shell.navRequests}
          </NavLink>
        </nav>
        <div className={styles.spacer} />
        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(user.display_name)}
          </span>
          <div className={styles.profileText}>
            <div className={styles.profileName}>{user.display_name}</div>
            <div className={styles.profileRole}>{role}</div>
          </div>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <p className={styles.signedIn}>{fill(copy.shell.signedInAs, { name: user.display_name })}</p>
          <button type="button" className={styles.signOut} onClick={() => void handleSignOut()}>
            <Icon name="logout" />
            {copy.shell.signOut}
          </button>
        </header>
        <main id="main-content" className={styles.content} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
