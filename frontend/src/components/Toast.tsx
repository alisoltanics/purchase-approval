import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./icons";
import styles from "../styles/toast.module.css";

const VISIBLE_MS = 4500;

export interface ToastContent {
  message: string;
  // A second sentence in the same toast (the design shows it after the message).
  detail?: string;
  tone?: "success" | "error";
}

interface ToastApi {
  show: (content: ToastContent) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// One persistent live region: screen readers announce what appears in it (plan 7.5).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastContent | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((content: ToastContent) => {
    window.clearTimeout(timer.current);
    setToast(content);
    timer.current = window.setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const api = useMemo(() => ({ show }), [show]);
  const failed = toast?.tone === "error";

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toasts} role="status" aria-live="polite" aria-atomic="true">
        {toast ? (
          <div className={`${styles.toast} ${failed ? styles.error : ""}`}>
            <Icon name={failed ? "alert" : "check"} />
            <span>
              <span>{toast.message}</span>
              {toast.detail ? (
                <>
                  {" "}
                  <span>{toast.detail}</span>
                </>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error("ToastProvider is missing");
  return value;
}
