import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApi } from "../../api/ApiProvider";
import { firstFieldCode, isApiError } from "../../api/errors";
import { newIdempotencyKey } from "../../api/idempotency";
import { requestKeys } from "../../api/queries";
import type { NewRequestPayload } from "../../api/types";
import { Icon } from "../../components/icons";
import { ModalBody, ModalFooter, ModalFrame, ModalHead } from "../../components/Modal";
import { TextAreaField, TextField } from "../../components/TextField";
import { useToast } from "../../components/Toast";
import { copy, fill } from "../../copy";
import { codePointLength, groupThousands } from "../../format/format";
import {
  NEW_REQUEST_FIELD_ORDER,
  validateNewRequest,
  type FieldErrors,
  type NewRequestField,
} from "../../validation/forms";
import { fieldMessage } from "../../validation/messages";
import formStyles from "../../styles/form.module.css";

type Values = Record<NewRequestField, string>;

const EMPTY: Values = { title: "", vendor: "", amount: "", description: "" };

export function NewRequestDialog() {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<NewRequestField>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  // One key per form instance (D-15): a retry after a lost response cannot create a second request.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const titleRef = useRef<HTMLInputElement>(null);
  const vendorRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fieldRefs = {
    title: titleRef,
    vendor: vendorRef,
    amount: amountRef,
    description: descriptionRef,
  };

  const create = useMutation({
    mutationFn: (payload: NewRequestPayload) => api.createRequest(payload, idempotencyKey),
  });
  const busy = create.isPending;
  const dirty = NEW_REQUEST_FIELD_ORDER.some((field) => values[field].length > 0);
  // Cancel returns to the list the form was opened from (PRD S3).
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch ?? "";

  function leave() {
    navigate(`/requests${listSearch}`, { replace: true });
  }

  function requestClose() {
    if (busy) return;
    if (dirty) setDiscardOpen(true);
    else leave();
  }

  function focusFirstInvalid(found: FieldErrors<NewRequestField>) {
    const first = NEW_REQUEST_FIELD_ORDER.find((field) => found[field]);
    if (first) fieldRefs[first].current?.focus();
  }

  function submit() {
    if (busy) return;
    const result = validateNewRequest(values);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstInvalid(result.errors);
      return;
    }
    setErrors({});
    setBanner(null);
    create.mutate(result.value, {
      onSuccess: (created) => {
        void queryClient.invalidateQueries({ queryKey: requestKeys.all });
        toast.show({
          message: copy.newRequest.submitted,
          detail: copy.newRequest.submittedNote,
        });
        navigate(`/requests/${created.id}`, { replace: true });
      },
      onError: (error) => {
        if (isApiError(error, "validation_error")) {
          const serverErrors: FieldErrors<NewRequestField> = {};
          for (const field of NEW_REQUEST_FIELD_ORDER) {
            const code = firstFieldCode(error, field);
            if (code) serverErrors[field] = code;
          }
          if (Object.keys(serverErrors).length > 0) {
            setErrors(serverErrors);
            focusFirstInvalid(serverErrors);
            return;
          }
        }
        // Nothing was confirmed, so the entries stay and the same key is used again (PRD S3).
        setBanner(
          isApiError(error, "idempotency_conflict")
            ? copy.newRequest.duplicateKeyConflict
            : copy.newRequest.submitFailure,
        );
      },
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function setField(field: NewRequestField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  const message = (field: NewRequestField) => {
    const code = errors[field];
    return code ? fieldMessage(field, code) : undefined;
  };

  return (
    <>
      <ModalFrame
        open
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <form noValidate onSubmit={handleSubmit}>
          <ModalHead
            title={copy.newRequest.title}
            description={copy.newRequest.subtitle}
            closeLabel={copy.newRequest.closeLabel}
            onClose={requestClose}
          />
          <ModalBody>
            <div role="alert">
              {banner ? <p className={formStyles.banner}>{banner}</p> : null}
            </div>
            <TextField
              id="request-title"
              label={copy.newRequest.titleLabel}
              name="title"
              placeholder={copy.newRequest.titlePlaceholder}
              value={values.title}
              onChange={(event) => setField("title", event.target.value)}
              error={message("title")}
              inputRef={titleRef}
            />
            <div className={formStyles.fieldRow}>
              <TextField
                id="request-vendor"
                label={copy.newRequest.vendorLabel}
                name="vendor"
                placeholder={copy.newRequest.vendorPlaceholder}
                value={values.vendor}
                onChange={(event) => setField("vendor", event.target.value)}
                error={message("vendor")}
                inputRef={vendorRef}
              />
              <TextField
                id="request-amount"
                label={copy.newRequest.amountLabel}
                name="amount"
                inputMode="decimal"
                placeholder={copy.newRequest.amountPlaceholder}
                prefix={copy.newRequest.currencyLabel}
                hint={copy.newRequest.amountHint}
                value={values.amount}
                onChange={(event) => setField("amount", event.target.value)}
                error={message("amount")}
                inputRef={amountRef}
              />
            </div>
            <TextAreaField
              id="request-description"
              label={copy.newRequest.descriptionLabel}
              labelAside={
                <span className={formStyles.counter} aria-hidden="true">
                  {fill(copy.newRequest.descriptionCounter, {
                    count: groupThousands(String(codePointLength(values.description))),
                  })}
                </span>
              }
              name="description"
              placeholder={copy.newRequest.descriptionPlaceholder}
              value={values.description}
              onChange={(event) => setField("description", event.target.value)}
              error={message("description")}
              inputRef={descriptionRef}
            />
            <div className={formStyles.note}>
              <Icon name="info" />
              <span>{copy.newRequest.note}</span>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className={`${formStyles.button} ${formStyles.secondary}`}
              onClick={requestClose}
            >
              {copy.newRequest.cancel}
            </button>
            <button
              type="submit"
              className={formStyles.button}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <span className={formStyles.spinner} aria-hidden="true" />
                  {copy.newRequest.submitting}
                </>
              ) : (
                <>
                  <Icon name="arrowUpRight" />
                  {copy.newRequest.submit}
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      </ModalFrame>
      <ModalFrame
        open={discardOpen}
        size="small"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          setDiscardOpen(false);
        }}
      >
        <ModalHead title={copy.newRequest.discardTitle} />
        <ModalBody>
          <p className={formStyles.dialogCopy}>{copy.newRequest.discardBody}</p>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            className={`${formStyles.button} ${formStyles.secondary}`}
            onClick={() => setDiscardOpen(false)}
          >
            {copy.newRequest.discardKeepEditing}
          </button>
          <button
            type="button"
            className={`${formStyles.button} ${formStyles.danger}`}
            onClick={leave}
          >
            {copy.newRequest.discardConfirm}
          </button>
        </ModalFooter>
      </ModalFrame>
    </>
  );
}
