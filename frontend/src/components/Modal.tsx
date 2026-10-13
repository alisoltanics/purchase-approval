import * as Dialog from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./icons";
import styles from "../styles/modal.module.css";

interface ModalFrameProps {
  open: boolean;
  size?: "regular" | "small";
  children: ReactNode;
  onEscapeKeyDown?: ComponentProps<typeof Dialog.Content>["onEscapeKeyDown"];
  onOpenAutoFocus?: ComponentProps<typeof Dialog.Content>["onOpenAutoFocus"];
}

// Radix gives the focus trap, Escape handling, scroll lock and focus return (plan 7.5). The
// design closes dialogs only through their own buttons, so a click on the backdrop does nothing.
export function ModalFrame({
  open,
  size = "regular",
  children,
  onEscapeKeyDown,
  onOpenAutoFocus,
}: ModalFrameProps) {
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={`${styles.dialog} ${size === "small" ? styles.small : ""}`}
          onEscapeKeyDown={onEscapeKeyDown}
          onOpenAutoFocus={onOpenAutoFocus}
          onInteractOutside={(event) => event.preventDefault()}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ModalHeadProps {
  title: string;
  description?: string;
  closeLabel?: string;
  onClose?: () => void;
}

export function ModalHead({ title, description, closeLabel, onClose }: ModalHeadProps) {
  return (
    <div className={styles.head}>
      <div>
        <Dialog.Title className={styles.title}>{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className={styles.description}>{description}</Dialog.Description>
        ) : (
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
        )}
      </div>
      {onClose && closeLabel ? (
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
          <Icon name="x" />
        </button>
      ) : null}
    </div>
  );
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>;
}
