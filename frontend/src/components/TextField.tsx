import type { InputHTMLAttributes, Ref } from "react";
import styles from "../styles/form.module.css";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  // Already-resolved message from copy.ts; absent when the field is valid.
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
}

// A visible label, and the error linked with aria-describedby and aria-invalid (plan 7.5).
export function TextField({ id, label, error, inputRef, ...inputProps }: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        ref={inputRef}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
