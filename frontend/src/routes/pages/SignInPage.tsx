import { useRef, useState, type FormEvent } from "react";
import { firstFieldCode, isApiError } from "../../api/errors";
import { useAuth } from "../../auth/AuthContext";
import { Icon } from "../../components/icons";
import { TextField } from "../../components/TextField";
import { copy } from "../../copy";
import { validateLogin, type FieldErrors } from "../../validation/forms";
import formStyles from "../../styles/form.module.css";
import styles from "../../styles/signIn.module.css";

type LoginField = "email" | "password";

type SubmitState =
  | { kind: "idle" }
  | { kind: "session-expired" }
  | { kind: "submitting" }
  | { kind: "invalid-credentials" }
  | { kind: "service-failure" };

const REQUIRED_MESSAGE: Record<LoginField, string> = {
  email: copy.signIn.emailRequired,
  password: copy.signIn.passwordRequired,
};

const FORM_MESSAGE: Partial<Record<SubmitState["kind"], string>> = {
  "session-expired": copy.session.expired,
  "invalid-credentials": copy.signIn.invalidCredentials,
  "service-failure": copy.signIn.serviceFailure,
};

export function SignInPage() {
  const { signIn, sessionExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginField>>({});
  const [state, setState] = useState<SubmitState>(
    sessionExpired ? { kind: "session-expired" } : { kind: "idle" },
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (state.kind === "submitting") return;
    const result = validateLogin({ email, password });
    if (!result.ok) {
      setFieldErrors(result.errors);
      (result.errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setFieldErrors({});
    setState({ kind: "submitting" });
    try {
      // On success the session changes and the route redirects; this page unmounts.
      await signIn(result.value.email, result.value.password);
    } catch (error) {
      if (isApiError(error, "invalid_credentials")) {
        setState({ kind: "invalid-credentials" });
      } else if (isApiError(error, "validation_error")) {
        const serverErrors: FieldErrors<LoginField> = {};
        for (const field of ["email", "password"] as const) {
          const code = firstFieldCode(error, field);
          if (code) serverErrors[field] = code;
        }
        const hasFieldError = Object.keys(serverErrors).length > 0;
        setFieldErrors(serverErrors);
        setState(hasFieldError ? { kind: "idle" } : { kind: "service-failure" });
      } else {
        // Network failure, 5xx or a failed CSRF check: nothing was decided, so pressing
        // Sign in again is safe.
        setState({ kind: "service-failure" });
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  const submitting = state.kind === "submitting";
  const formMessage = FORM_MESSAGE[state.kind];

  return (
    <div className={styles.page}>
      <section className={styles.formSide}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Icon name="check" />
          </span>
          <span className={styles.brandName}>{copy.product.name}</span>
        </div>
        <main className={styles.main} id="main-content">
          <div className={styles.eyebrow}>{copy.signIn.eyebrow}</div>
          <h1>{copy.signIn.title}</h1>
          <p className={styles.intro}>{copy.signIn.intro}</p>
          <form noValidate onSubmit={handleSubmit}>
            <div role="alert">
              {formMessage ? <p className={formStyles.banner}>{formMessage}</p> : null}
            </div>
            <TextField
              id="sign-in-email"
              label={copy.signIn.email}
              name="email"
              type="email"
              autoComplete="username"
              placeholder={copy.signIn.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email ? REQUIRED_MESSAGE.email : undefined}
              inputRef={emailRef}
            />
            <TextField
              id="sign-in-password"
              label={copy.signIn.password}
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder={copy.signIn.passwordPlaceholder}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password ? REQUIRED_MESSAGE.password : undefined}
              inputRef={passwordRef}
            />
            <button
              type="submit"
              className={`${formStyles.button} ${styles.submit}`}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <span className={formStyles.spinner} aria-hidden="true" />
                  {copy.signIn.submitting}
                </>
              ) : (
                <>
                  {copy.signIn.submit}
                  <Icon name="arrowRight" />
                </>
              )}
            </button>
          </form>
          <p className={styles.note}>{copy.signIn.accessNote}</p>
        </main>
        <footer className={styles.bottom}>
          <span>{copy.signIn.footer}</span>
        </footer>
      </section>
      <aside className={styles.right}>
        <div className={styles.art} aria-hidden="true">
          <div className={styles.document}>
            <div className={styles.documentTop}>
              <Icon name="file" />
              <span>{copy.signIn.art.reference}</span>
            </div>
            <h3>{copy.signIn.art.title}</h3>
            <p>{copy.signIn.art.text}</p>
            <div className={styles.lines}>
              <div className={styles.line} />
              <div className={styles.lineShort} />
            </div>
            <div className={styles.documentBottom}>
              <span className={styles.avatar}>{copy.signIn.art.initials}</span>
              <strong>
                <span className={styles.currency}>{copy.signIn.art.currency}</span>
                {copy.signIn.art.amount}
              </strong>
            </div>
          </div>
          <div className={styles.approved}>
            <Icon name="check" />
            <div>
              {copy.signIn.art.approved}
              <small>{copy.signIn.art.approvedNote}</small>
            </div>
          </div>
        </div>
        <h2>{copy.signIn.art.headline}</h2>
        <p>{copy.signIn.art.tagline}</p>
        <span className={styles.caption}>{copy.signIn.art.caption}</span>
      </aside>
    </div>
  );
}
