"use client";

import {LoadingRows} from "@/components/ui/loading-skeleton";

import {useEffect, useRef, useState} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileClock,
  LoaderCircle,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import {getCollectionDescriptor, prettifyKey} from "@/features/dashboard/collection-config";
import {PropertyAssets} from "../marketplace/property-assets";
import {RecordDetails} from "@/features/dashboard/record-details";
import {FeaturePlacement} from "@/features/dashboard/feature-placement";
import type {WorkspaceCollection, WorkspaceItem} from "@/features/dashboard/types";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {splitFieldErrors} from "@/lib/form-validation";
import {adminStatusLabel} from "./admin-sections";
import styles from "./admin-record-review.module.css";

export type AdminRecordReviewProps = {
  collection: WorkspaceCollection;
  item: WorkspaceItem;
  onClose: () => void;
  onReviewProperty: (propertyId: string) => void;
  onSave: (payload: {status: string; reviewNote?: string}) => Promise<void>;
  onFeature: (id: string, featured: boolean, order?: number) => Promise<{featuredOrder: number | null}>;
};

type HistoryEvent = {
  status: string | null;
  action: string;
  note: string | null;
  actorLabel: string;
  timestamp: string;
};

type HistoryResponse = {
  itemId: string;
  events: HistoryEvent[];
};

const noteRequiredStatuses = new Set(["CHANGES_REQUESTED", "REJECTED", "SUSPENDED"]);

const actionLanguage: Record<string, {label: string; description: string; tone: "positive" | "warning" | "danger" | "neutral"}> = {
  APPROVED: {label: "Approve", description: "Mark this record approved in its workflow.", tone: "positive"},
  PUBLISHED: {label: "Publish", description: "Make this approved record visible in its public experience.", tone: "positive"},
  VERIFIED: {label: "Verify", description: "Confirm the submitted identity or registration evidence.", tone: "positive"},
  AVAILABLE: {label: "Approve & mark available", description: "Approve this worker card and make it available for discovery.", tone: "positive"},
  ACTIVE: {label: "Activate", description: "Allow this record or campaign to operate in its active state.", tone: "positive"},
  RESOLVED: {label: "Resolve", description: "Record that the issue has received a complete resolution.", tone: "positive"},
  CLOSED: {label: "Close", description: "Close this workflow while retaining its full history.", tone: "neutral"},
  ACKNOWLEDGED: {label: "Acknowledge", description: "Confirm receipt and move the issue into accountable handling.", tone: "neutral"},
  IN_PROGRESS: {label: "Mark in progress", description: "Record that this case is being worked on.", tone: "neutral"},
  WAITING_USER: {label: "Wait for user", description: "Pause the case until the member supplies requested information.", tone: "warning"},
  CHANGES_REQUESTED: {label: "Request changes", description: "Return the record with a clear, actionable correction note.", tone: "warning"},
  PAUSED: {label: "Pause", description: "Temporarily stop visibility or delivery without deleting history.", tone: "warning"},
  EXPIRED: {label: "Mark expired", description: "Remove this record from active use because its validity has ended.", tone: "warning"},
  REJECTED: {label: "Reject", description: "Decline this record and explain the policy or evidence issue.", tone: "danger"},
  SUSPENDED: {label: "Suspend", description: "Immediately restrict this record while retaining evidence and history.", tone: "danger"},
  FLAGGED: {label: "Flag", description: "Escalate this record for additional operational review.", tone: "danger"},
  SPAM: {label: "Mark as spam", description: "Exclude this record from genuine operational activity.", tone: "danger"},
};

function actionFor(status: string) {
  return actionLanguage[status] ?? {
    label: `Move to ${prettifyKey(status).toLowerCase()}`,
    description: `Update this record from its current state to ${prettifyKey(status).toLowerCase()}.`,
    tone: "neutral" as const,
  };
}

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", includeTime
    ? {day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"}
    : {day: "2-digit", month: "short", year: "numeric"}).format(date);
}

export function AdminRecordReview({collection, item, onClose, onSave, onFeature, onReviewProperty}: AdminRecordReviewProps) {
  const propertyId = collection.key === "propertyInquiries" && typeof item.data.propertyId === "string" ? item.data.propertyId : null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const decisionRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const historyRef = useRef<HTMLElement>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{status?: string; reviewNote?: string}>({});
  const [recordErrors, setRecordErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [position, setPosition] = useState(item.featuredOrder?.toString() ?? "");
  const [featureError, setFeatureError] = useState("");

  const descriptor = getCollectionDescriptor(collection.key, collection.label);
  const allowedStatuses = item.allowedNextStatuses ?? [];
  const requiresNote = noteRequiredStatuses.has(selectedStatus);

  async function changeFeatured() {
    const order = position ? Number(position) : undefined;
    if (order !== undefined && (!Number.isSafeInteger(order) || order < 1)) {
      setFeatureError("Enter a whole number of 1 or higher.");
      return;
    }
    setSaving(true);
    setFeatureError("");
    try {
      const result = await onFeature(item.id, true, order);
      setPosition(result.featuredOrder?.toString() ?? "");
      setHistoryAttempt((value) => value + 1);
    } catch (error) {
      setFeatureError(error instanceof ApiClientError && error.fieldErrors.order ? error.fieldErrors.order
        : error instanceof Error ? error.message : "Could not update featured placement.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    queueMicrotask(() => closeButtonRef.current?.focus());
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setHistoryState("loading");
    void apiRequest<HistoryResponse>(`/workspace/${encodeURIComponent(collection.key)}/${encodeURIComponent(item.id)}/history`, {signal: controller.signal})
      .then((response) => {
        setHistory(response.events);
        setHistoryState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHistoryState("error");
      });
    return () => controller.abort();
  }, [collection.key, item.id, historyAttempt]);

  function requestClose() {
    if (saving) return;
    dialogRef.current?.close();
    onClose();
  }

  function handleBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) requestClose();
  }

  async function submitDecision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    setSaveError(null);
    setRecordErrors({});
    const note = reviewNote.trim();
    function showFieldErrors(fields: {status?: string; reviewNote?: string}) {
      setFieldErrors(fields);
      const selector = fields.status ? 'input[name="review-status"]' : fields.reviewNote ? 'textarea[name="reviewNote"]' : null;
      if (selector) requestAnimationFrame(() => form.querySelector<HTMLElement>(selector)?.focus());
    }

    const fields = {
      status: selectedStatus ? undefined : "Choose the next status before saving this decision.",
      reviewNote: requiresNote && note.length < 10 ? "Add a clear review note of at least 10 characters." : undefined,
    };
    showFieldErrors(fields);
    if (fields.status || fields.reviewNote) {
      return;
    }
    setSaving(true);
    try {
      await onSave({status: selectedStatus, ...(note ? {reviewNote: note} : {})});
      dialogRef.current?.close();
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError) {
        const names = ["status", "reviewNote", "description", "items", ...descriptor.fields.map(({key}) => key), ...Object.keys(item.data)];
        const {fields, general} = splitFieldErrors(error.fieldErrors, names, collection.key === "materialRfqs" ? {city: "cityId"} : {});
        const {status, reviewNote, ...details} = fields;
        showFieldErrors({status, reviewNote});
        setRecordErrors(details);
        if (!status && !reviewNote && Object.keys(details).length) requestAnimationFrame(() => detailsRef.current?.focus());
        if (Object.keys(fields).length || general) {
          setSaveError(general || null);
          return;
        }
      }
      setSaveError(error instanceof Error ? error.message : "The review decision could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog aria-labelledby="admin-review-title" className={styles.dialog} data-motion="dialog" onCancel={(event) => {event.preventDefault(); requestClose();}} onClick={handleBackdrop} ref={dialogRef}>
      <div className={styles.modalPanel}>
        <header className={styles.header}>
          <div>
            <p><ShieldCheck size={14} /> Administrative review</p>
            <h2 id="admin-review-title">{item.title}</h2>
            <span>{collection.label} · Reference {item.id.slice(0, 12)}</span>
          </div>
          <button aria-label="Close review" disabled={saving} onClick={requestClose} ref={closeButtonRef} type="button"><X size={19} /></button>
        </header>

        <div className={styles.body}>
          <section className={styles.summary}>
            <div className={styles.summaryStatus}>
              <span>Current status</span>
              <strong>{adminStatusLabel(item.status)}</strong>
            </div>
            <div><CalendarDays size={14} /><span>Created</span><strong>{formatDate(item.createdAt)}</strong></div>
            <div><Clock3 size={14} /><span>Last updated</span><strong>{formatDate(item.updatedAt, true)}</strong></div>
          </section>
          {propertyId && <section className={styles.featureControl}>
            <div><strong>Property enquiry</strong><small>Open the linked listing to review its changes.</small></div>
            <button type="button" disabled={saving} onClick={() => onReviewProperty(propertyId)}>Review property listing <ArrowRight size={15} /></button>
          </section>}
          <FeaturePlacement collection={collection.key} item={item} admin onNavigate={onClose}>
          {collection.key === "properties" && item.status === "PUBLISHED" && <section className={styles.featureControl} aria-label="Homepage placement">
            <div><strong>Homepage placement</strong><small>The homepage shows positions 1 to 20. Other listings shift automatically when you move a property.</small></div>
            <form onSubmit={(event) => {event.preventDefault(); void changeFeatured();}} noValidate>
              <label>Sort order<input type="number" min={1} step={1} value={position} placeholder="Next position" disabled={saving}
                onChange={(event) => {setPosition(event.target.value); setFeatureError("");}}
                aria-invalid={Boolean(featureError)} aria-describedby={featureError ? "featured-order-error" : undefined} /></label>
              <div className={styles.featureActions}>
                <button type="submit" disabled={saving}><Sparkles size={16} aria-hidden="true" />Save sort order</button>
              </div>
              {featureError && <small id="featured-order-error" className={styles.fieldError} role="alert">{featureError}</small>}
            </form>
          </section>}
          </FeaturePlacement>
          <nav aria-label="Record sections" className={styles.recordNav}>
            {allowedStatuses.length ? <button onClick={() => decisionRef.current?.focus()} type="button">Review actions <ArrowRight size={14} /></button> : null}
            <button onClick={() => historyRef.current?.focus()} type="button">Status history <ArrowRight size={14} /></button>
          </nav>

          {item.description || recordErrors.description ? <section className={styles.description}><span>Submitted context</span>
            {item.description && <p>{item.description}</p>}
            {recordErrors.description && <small className={styles.fieldError} role="alert">{recordErrors.description}</small>}
          </section> : null}

          <section aria-label="Submitted details" className={styles.section} ref={detailsRef} tabIndex={-1}>
            <div className={styles.sectionHeading}><h3>Submitted details</h3></div>
            {descriptor.key==="properties"&&item.data.sellerSource!=null&&<section><h3>Listing source</h3><p>{[item.data.listingContact,item.data.sellerSource,item.data.profileVerification].filter(Boolean).map(v=>String(v).replaceAll("_"," ")).join(" · ")}</p>{item.data.legacyMapping!=null&&<details><summary>Historical mapping</summary><p>{((item.data.legacyMapping as {issues:string[]}).issues??[]).join(", ")}</p><p>Retained fields: {((item.data.legacyMapping as {retainedKeys:string[]}).retainedKeys??[]).join(", ")}</p></details>}</section>}
            <RecordDetails data={item.data} descriptor={descriptor} errors={recordErrors} />
            {descriptor.key === "properties" && <><PropertyAssets id={item.id} kind="plans"/><PropertyAssets id={item.id} kind="documents"/></>}
          </section>

          <section aria-labelledby="review-actions-heading" className={styles.section} ref={decisionRef} tabIndex={-1}>
            <div className={styles.sectionHeading}><h3 id="review-actions-heading">Choose the next action</h3></div>
            {allowedStatuses.length ? (
              <form className={styles.decisionForm} noValidate onSubmit={submitDecision}>
                <fieldset aria-labelledby="review-actions-heading" aria-describedby={fieldErrors.status ? "review-status-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.status) || undefined} className={styles.actionGrid} data-invalid={Boolean(fieldErrors.status)} role="radiogroup">
                  {allowedStatuses.map((status) => {
                    const action = actionFor(status);
                    return (
                      <label className={`${styles.actionCard} ${styles[`tone_${action.tone}`]} ${selectedStatus === status ? styles.actionSelected : ""}`} key={status}>
                        <input
                          aria-describedby={fieldErrors.status ? "review-status-error" : undefined}
                          checked={selectedStatus === status}
                          disabled={saving}
                          name="review-status"
                          onChange={() => {
                            setSelectedStatus(status);
                            setFieldErrors({});
                            setRecordErrors({});
                            setSaveError(null);
                          }}
                          required
                          type="radio"
                          value={status}
                        />
                        <span><strong>{action.label}</strong><small>{action.description}</small></span>
                        <i>{selectedStatus === status ? <Check size={14} /> : <ArrowRight size={14} />}</i>
                      </label>
                    );
                  })}
                </fieldset>
                {fieldErrors.status ? <p className={styles.fieldError} id="review-status-error" role="alert">{fieldErrors.status}</p> : null}

                <label className={styles.noteField}>
                  <span>Review note {requiresNote ? <b>Required · minimum 10 characters</b> : <small>Optional for this action</small>}</span>
                  <textarea
                    aria-describedby={fieldErrors.reviewNote ? "review-note-error review-note-help" : "review-note-help"}
                    aria-invalid={Boolean(fieldErrors.reviewNote) || undefined}
                    disabled={saving}
                    maxLength={1000}
                    name="reviewNote"
                    onChange={(event) => {
                      setReviewNote(event.target.value);
                      setFieldErrors((current) => ({...current, reviewNote: undefined}));
                      setSaveError(null);
                    }}
                    placeholder={requiresNote ? "Explain what must change or why this record cannot proceed…" : "Add context for the record owner…"}
                    required={requiresNote}
                    rows={4}
                    value={reviewNote}
                  />
                  {fieldErrors.reviewNote ? <small className={styles.fieldError} id="review-note-error" role="alert">{fieldErrors.reviewNote}</small> : null}
                  <em id="review-note-help">Visible to the record owner. {reviewNote.trim().length}/1000 characters.</em>
                </label>

                {saveError ? <div className={styles.formError} role="alert"><AlertTriangle size={15} /> {saveError}</div> : null}

                <div className={styles.actions}>
                  <button disabled={saving} onClick={requestClose} type="button">Cancel</button>
                  <button className={styles.saveButton} disabled={saving} type="submit">
                    {saving ? <LoaderCircle className={styles.spin} size={16} /> : <ShieldCheck size={16} />}
                    {saving ? "Saving decision…" : selectedStatus ? actionFor(selectedStatus).label : "Save decision"}
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.noActions}><CheckCircle2 size={20} /><div><strong>No administrative status action available</strong><p>This record has no permitted next status in the current workflow.</p></div></div>
            )}
          </section>

          <section aria-labelledby="review-history-heading" className={styles.section} ref={historyRef} tabIndex={-1}>
            <div className={styles.sectionHeading}><h3 id="review-history-heading">Status history</h3><FileClock size={17} /></div>
            {historyState === "loading" ? <LoadingRows label="Loading activity history" /> : null}
            {historyState === "error" ? <div className={styles.historyError}><AlertTriangle size={16} /> History could not be loaded. <button onClick={() => setHistoryAttempt((attempt) => attempt + 1)} type="button">Retry</button></div> : null}
            {historyState === "ready" && !history.length ? <div className={styles.historyEmpty}>No status events have been recorded for this item yet.</div> : null}
            {historyState === "ready" && history.length ? (
              <ol className={styles.timeline}>
                {history.map((event, index) => (
                  <li key={`${event.timestamp}-${event.action}-${index}`}>
                    <span className={styles.timelineDot}>{event.note ? <MessageSquareText size={12} /> : <CheckCircle2 size={12} />}</span>
                    <div><strong>{adminStatusLabel(event.action)}</strong><p>{event.status ? `${adminStatusLabel(event.status)} · ` : ""}{event.actorLabel}</p>{event.note ? <blockquote>{event.note}</blockquote> : null}</div>
                    <time dateTime={event.timestamp}>{formatDate(event.timestamp, true)}</time>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        </div>
      </div>
    </dialog>
  );
}

