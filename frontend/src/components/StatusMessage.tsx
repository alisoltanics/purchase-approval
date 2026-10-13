import styles from "../styles/status.module.css";

interface StatusMessageProps {
  kind: "loading" | "error";
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Loading uses a polite live region; errors use an alert (plan 7.5).
export function StatusMessage({ kind, text, actionLabel, onAction }: StatusMessageProps) {
  return (
    <div
      className={styles.box}
      role={kind === "error" ? "alert" : "status"}
      aria-busy={kind === "loading"}
    >
      <p>{text}</p>
      {actionLabel && onAction ? (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
