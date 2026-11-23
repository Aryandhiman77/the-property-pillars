"use client";

import {useEffect, useId, useRef, useState, type FormEvent} from "react";
import {normalizeContactPhone} from "@the-property-pillar/contracts";
import toast from "react-hot-toast";
import {PhoneInput, formPhone} from "@/components/ui/phone-input";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {clearChangedField, fieldAttributes, focusInvalidControl, invalidControls, splitFieldErrors, type FieldErrors} from "@/lib/form-validation";
import {usePropertyContactProfile} from "./property-contact-profile";
import styles from "./directory.module.css";

type Comment = {id: string; fullName: string; body: string; createdAt: string};
type CommentPage = {items: Comment[]; hasMore: boolean};
const fields = ["fullName", "phone", "body"] as const;

export function PropertyComments({id, locale}: {id: string; locale: string}) {
  const formId = useId();
  const {fullName, phone} = usePropertyContactProfile(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const sendingRef = useRef(false);
  const requestId = useRef("");
  const path = "/public/properties/" + encodeURIComponent(id) + "/comments";

  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<CommentPage>(path, {signal: abort.signal}).then((result) => {
      if (abort.signal.aborted) return;
      setComments((current) => [...new Map([...current, ...result.items].map((item) => [item.id, item])).values()]);
      setMore(result.hasMore);
      setLoading(false);
    }, () => {if (!abort.signal.aborted) {setLoadError(true); setLoading(false);}});
    return () => abort.abort();
  }, [path]);

  async function load(next: number) {
    setLoading(true);
    setLoadError(false);
    try {
      const {items, hasMore} = await apiRequest<CommentPage>(path + "?page=" + next);
      setComments((current) => [...new Map([...current, ...items].map((item) => [item.id, item])).values()]);
      setPage(next);
      setMore(hasMore);
    } catch {setLoadError(true);}
    finally {setLoading(false);}
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current) return;
    const form = event.currentTarget;
    const input = new FormData(form);
    const name = String(input.get("fullName") ?? "").trim();
    const number = normalizeContactPhone(formPhone(input));
    const invalid = invalidControls(form);
    if (name.length < 2) invalid.fullName = "Enter your full name.";
    if (!number) invalid.phone = "Enter a valid mobile number.";
    if (body.trim().length < 3) invalid.body = "Enter a comment.";
    setErrors(invalid);
    setError("");
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() => focusInvalidControl(form));
      return;
    }
    sendingRef.current = true;
    setSending(true);
    requestId.current ||= window.crypto.randomUUID();
    try {
      const comment = await apiRequest<Comment>(path, {method: "POST", body: {fullName: name, phone: number, body: body.trim(), requestId: requestId.current}});
      setComments((current) => [comment, ...current.filter(({id}) => id !== comment.id)]);
      setBody("");
      requestId.current = "";
      toast.success("Comment published.");
    } catch (cause) {
      if (cause instanceof ApiClientError && Object.keys(cause.fieldErrors).length) {
        const {fields: byField, general} = splitFieldErrors(cause.fieldErrors, fields);
        setErrors(byField);
        setError(general);
        requestAnimationFrame(() => focusInvalidControl(form));
      } else setError(cause instanceof Error ? cause.message : "Could not publish your comment.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const fieldError = (field: (typeof fields)[number]) => errors[field] && <small className={styles.enquiryFieldError} id={formId + "-" + field} role="alert">{errors[field]}</small>;

  return <section className={styles.surface} aria-labelledby="property-comments">
    <h2 id="property-comments">Comments</h2>
    <form className={styles.commentForm} noValidate aria-busy={sending} onSubmit={submit} onChange={(event) => clearChangedField(event, setErrors)}>
      <label><span>Full name</span>
        <input {...fieldAttributes(formId, "fullName", errors.fullName)} required maxLength={120} autoComplete="name" defaultValue={fullName} />
        {fieldError("fullName")}
      </label>
      <div><label htmlFor={formId + "-mobile"}>Mobile number</label>
        <PhoneInput {...fieldAttributes(formId, "phone", errors.phone)} name="phone" id={formId + "-mobile"} defaultValue={phone} required />
        {fieldError("phone")}
      </div>
      <label className={styles.commentBody}><span>Comment</span>
        <textarea {...fieldAttributes(formId, "body", errors.body)} value={body} onChange={(event) => setBody(event.target.value)} required maxLength={1200} rows={3} />
        {fieldError("body")}
      </label>
      <small>Your name and comment will appear publicly. Your mobile number stays private.</small>
      <button type="submit" className={styles.primaryButton} disabled={sending}>{sending ? "Posting…" : "Post comment"}</button>
      {error && <p className={styles.enquiryError} role="alert">{error}</p>}
    </form>
    {comments.length > 0 && <ul className={styles.commentsList}>{comments.map((comment) => <li key={comment.id}>
      <div><strong>{comment.fullName}</strong><time dateTime={comment.createdAt}>{new Intl.DateTimeFormat(locale, {dateStyle: "medium"}).format(new Date(comment.createdAt))}</time></div>
      <p>{comment.body}</p>
    </li>)}</ul>}
    {loading && <p role="status">Loading comments…</p>}
    {loadError && <p role="alert">Could not load comments. <button type="button" onClick={() => void load(!comments.length ? 1 : page + 1)}>Try again</button></p>}
    {!loading && !loadError && !comments.length && <p className={styles.commentEmpty}>No comments yet.</p>}
    {more && !loadError && <button className={styles.secondaryButton} type="button" disabled={loading} onClick={() => void load(page + 1)}>More comments</button>}
  </section>;
}
