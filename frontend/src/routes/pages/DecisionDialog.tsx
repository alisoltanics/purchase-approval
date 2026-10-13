import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { useApi } from "../../api/ApiProvider";
import { firstFieldCode, isApiError } from "../../api/errors";
import { requestKeys } from "../../api/queries";
import type { RequestDetail } from "../../api/types";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "../../components/Modal";
import { TextAreaField } from "../../components/TextField";
import { useToast } from "../../components/Toast";
import { copy, fill } from "../../copy";
import { formatAmount } from "../../format/format";
import { validateRejection } from "../../validation/forms";
import { fieldMessage } from "../../validation/messages";
import formStyles from "../../styles/form.module.css";
import styles from "../../styles/details.module.css";

export type DecisionKind = "approve" | "reject";

interface DecisionDialogProps {
  kind: DecisionKind;
  request: RequestDetail;
  // The control that opened the dialog; focus returns to it on Cancel (PRD §10).
  trigger: HTMLElement | null;
  onClose: () => void;
}

// Mounted only while open, so the rejection reason always starts empty (PRD S4) and is kept only
// across a failed attempt of the same open dialog.
export function DecisionDialog({ kind, request, trigger, onClose }: DecisionDialogProps) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const approving = kind === "approve";
  const text = approving ? copy.approveDialog : copy.rejectDialog;
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  // Set when the dialog closes because the request changed: focus goes to the page, not to the
  // trigger that no longer exists.
  const decided = useRef(false);

  const decide = useMutation({
    mutationFn: () =>
      approving ? api.approveRequest(request.id) : api.rejectRequest(request.id, reason),
  });
  const busy = decide.isPending;

  function refresh(updated: RequestDetail | null) {
    if (updated) queryClient.setQueryData(requestKeys.detail(request.id), updated);
    else void queryClient.invalidateQueries({ queryKey: requestKeys.detail(request.id) });
    void queryClient.invalidateQueries({ queryKey: ["requests", "list"] });
    void queryClient.invalidateQueries({ queryKey: requestKeys.summary });
  }

  // After a failure nothing is known about the outcome: show what the server holds (PRD §9).
  function reload() {
    decided.current = true;
    refresh(null);
    onClose();
  }

  function close() {
    if (!busy) onClose();
  }

  function submit() {
    if (busy) return;
    if (!approving) {
      const result = validateRejection({ reason });
      if (!result.ok) {
        setReasonError(fieldMessage("reason", result.errors.reason ?? "invalid_format"));
        reasonRef.current?.focus();
        return;
      }
    }
    setReasonError(undefined);
    setBanner(null);
    decide.mutate(undefined, {
      onSuccess: (updated) => {
        decided.current = true;
        refresh(updated);
        toast.show({
          message: approving ? copy.details.approvedToast : copy.details.rejectedToast,
          detail: copy.details.decisionToastNote,
        });
        onClose();
      },
      onError: (error) => {
        if (isApiError(error, "already_decided")) {
          decided.current = true;
          refresh(error.request);
          toast.show({ message: copy.details.alreadyDecided, tone: "error" });
          onClose();
          return;
        }
        if (isApiError(error, "validation_error") && firstFieldCode(error, "reason")) {
          setReasonError(fieldMessage("reason", firstFieldCode(error, "reason") ?? "invalid_format"));
          reasonRef.current?.focus();
          return;
        }
        if (isApiError(error, "request_unavailable")) {
          decided.current = true;
          refresh(null);
          onClose();
          return;
        }
        if (isApiError(error, "own_request") || isApiError(error, "not_permitted")) {
          // The screen's idea of who may decide was wrong: show the real state.
          decided.current = true;
          refresh(null);
          toast.show({
            message:
              error.code === "own_request"
                ? copy.details.ownRequestNotice
                : copy.details.notPermitted,
            tone: "error",
          });
          onClose();
          return;
        }
        // Nothing was confirmed: keep the reason and let the manager try again (PRD S4).
        setBanner(copy.details.decisionFailure);
      },
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  return (
    <ModalFrame
      open
      size="small"
      onEscapeKeyDown={(event) => {
        event.preventDefault();
        close();
      }}
      onOpenAutoFocus={
        approving
          ? undefined
          : (event) => {
              event.preventDefault();
              reasonRef.current?.focus();
            }
      }
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        // After a decision the trigger is gone, so the page itself takes focus.
        const target = decided.current ? document.getElementById("main-content") : trigger;
        target?.focus({ preventScroll: true });
      }}
    >
      <form noValidate onSubmit={handleSubmit}>
        <ModalHead title={text.title} closeLabel={text.closeLabel} onClose={close} />
        <ModalBody>
          <div role="alert">
            {banner ? (
              <div className={formStyles.banner}>
                <p>{banner}</p>
                <button type="button" className={styles.reload} onClick={reload}>
                  {copy.details.reloadRequest}
                </button>
              </div>
            ) : null}
          </div>
          <p className={formStyles.dialogCopy}>{text.intro}</p>
          <div className={styles.confirmRequest}>
            <strong>
              {fill(text.body, {
                title: request.title,
                amount: formatAmount(request.amount, request.currency),
              })}
            </strong>
          </div>
          {approving ? null : (
            <div className={styles.reasonField}>
              <TextAreaField
                id="reject-reason"
                label={copy.rejectDialog.reasonLabel}
                name="reason"
                placeholder={copy.rejectDialog.reasonPlaceholder}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                hint={copy.rejectDialog.reasonHint}
                error={reasonError}
                inputRef={reasonRef}
              />
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            className={`${formStyles.button} ${formStyles.secondary}`}
            onClick={close}
            disabled={busy}
          >
            {text.cancel}
          </button>
          <button
            type="submit"
            className={`${formStyles.button} ${approving ? "" : formStyles.danger}`}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <span className={formStyles.spinner} aria-hidden="true" />
                {text.working}
              </>
            ) : (
              text.confirm
            )}
          </button>
        </ModalFooter>
      </form>
    </ModalFrame>
  );
}
