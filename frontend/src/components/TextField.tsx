import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";
import styles from "../styles/form.module.css";

interface ShellProps {
  id: string;
  label: string;
  // Already-resolved message from copy.ts; absent when the field is valid.
  error?: string;
  // Help text linked to the field; announced before the error.
  hint?: string;
  // Shown on the label row but outside the label, so it is not part of the field's name.
  labelAside?: ReactNode;
}

interface FieldShellProps extends ShellProps {
  children: (describedBy: string | undefined) => ReactNode;
}

// A visible label, and the hint and error linked with aria-describedby (plan 7.5).
function FieldShell({ id, label, error, hint, labelAside, children }: FieldShellProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {labelAside}
      </div>
      {children(describedBy || undefined)}
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends ShellProps, Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  inputRef?: Ref<HTMLInputElement>;
  // A fixed label inside the input's left edge, such as the currency.
  prefix?: string;
}

export function TextField({
  id,
  label,
  error,
  hint,
  labelAside,
  inputRef,
  prefix,
  ...inputProps
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} labelAside={labelAside}>
      {(describedBy) => {
        const input = (
          <input
            {...inputProps}
            id={id}
            ref={inputRef}
            className={`${styles.input} ${prefix ? styles.prefixed : ""}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        );
        return prefix ? (
          <div className={styles.currencyInput}>
            <span>{prefix}</span>
            {input}
          </div>
        ) : (
          input
        );
      }}
    </FieldShell>
  );
}

interface TextAreaFieldProps
  extends ShellProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  inputRef?: Ref<HTMLTextAreaElement>;
}

export function TextAreaField({
  id,
  label,
  error,
  hint,
  labelAside,
  inputRef,
  ...inputProps
}: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} labelAside={labelAside}>
      {(describedBy) => (
        <textarea
          {...inputProps}
          id={id}
          ref={inputRef}
          className={`${styles.input} ${styles.textarea}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
    </FieldShell>
  );
}
