import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import styles from "../styles/blank.module.css";

interface BlankStateProps {
  icon: IconName;
  title: string;
  text: string;
  // The one action offered (a button or a link); styled by the caller.
  action: ReactNode;
  tone?: "neutral" | "error";
}

// Empty, filtered-empty and failure states share one layout (design "blank state").
export function BlankState({ icon, title, text, action, tone = "neutral" }: BlankStateProps) {
  return (
    <div
      className={`${styles.blank} ${tone === "error" ? styles.error : ""}`}
      role={tone === "error" ? "alert" : undefined}
    >
      <span className={styles.icon}>
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
