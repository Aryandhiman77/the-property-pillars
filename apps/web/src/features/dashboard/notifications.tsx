"use client";

import MuiButton from "@mui/material/Button";

import {useCallback, useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {ArrowRight, Bell, Check, CheckCheck} from "lucide-react";
import {apiRequest} from "@/lib/api/client";
import {adminStatusLabel} from "@/features/admin";
import {LoadingRows} from "@/components/ui/loading-skeleton";
import styles from "./dashboard.module.css";

type NotificationEntry = {
  id: string; title: string; action: string; status: string | null; createdAt: string; readAt: string | null;
  collection: string; collectionLabel: string; itemId: string;
};
type NotificationPage = {entries: NotificationEntry[]; nextCursor: string | null};

const date = new Intl.DateTimeFormat("en-IN", {dateStyle: "medium", timeStyle: "short"});

export function useNotifications() {
  const [unread, setUnread] = useState<NotificationEntry[]>([]);
  const [failure, setFailure] = useState(false);
  const [pending, setPending] = useState(true);
  const [readById, setReadById] = useState<Record<string, string>>({});
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setPending(true);
    setFailure(false);
    try {
      const {entries} = await apiRequest<NotificationPage>("/workspace/notifications?unread=1");
      if (request === sequence.current) {setUnread(entries); setFailure(false);}
    } catch {
      if (request === sequence.current) setFailure(true);
    } finally {
      if (request === sequence.current) setPending(false);
    }
  }, []);
  useEffect(() => {
    const activeSequence = sequence;
    void refresh();
    const timer = window.setInterval(() => {if (!document.hidden) void refresh();}, 60_000);
    return () => {window.clearInterval(timer); activeSequence.current++;};
  }, [refresh]);

  async function markRead(id: string) {
    const {readAt} = await apiRequest<{readAt: string}>(`/workspace/notifications/${encodeURIComponent(id)}/read`, {method: "PATCH"});
    sequence.current++;
    setReadById((current) => ({...current, [id]: readAt}));
    setUnread((entries) => entries.filter((entry) => entry.id !== id));
    void refresh();
    return readAt;
  }
  return {unread, failure, pending, refresh, markRead, readById};
}

function NotificationRow({entry, onRead}: {entry: NotificationEntry; onRead: (entry: NotificationEntry) => Promise<void>}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <li className={styles.notificationRow}>
    <span className={styles.notificationSymbol}>{entry.readAt ? <CheckCheck size={17} aria-hidden="true" /> : <Bell size={17} aria-hidden="true" />}</span>
    <div>
      <strong>{entry.title}</strong>
      <small>{entry.collectionLabel} · {entry.status ? adminStatusLabel(entry.status) : adminStatusLabel(entry.action)}</small>
      <time dateTime={entry.createdAt}>{date.format(new Date(entry.createdAt))}</time>
      {error && <small role="alert">Could not mark as read. Try again.</small>}
    </div>
    {!entry.readAt && <MuiButton aria-label={`Mark ${entry.title} as read`} title="Mark as read" className={styles.notificationRead} disabled={busy} type="button"
      onClick={async () => {
        setError(false); setBusy(true);
        try { await onRead(entry); } catch {setError(true);} finally {setBusy(false);}
      }}><Check size={16} aria-hidden="true" /></MuiButton>}
  </li>;
}

export function NotificationDropdown({inbox, onViewAll}: {inbox: ReturnType<typeof useNotifications>; onViewAll: () => void}) {
  const t = useTranslations("Site");
  const [open, setOpen] = useState(false);
  const showLoading = inbox.pending && !inbox.unread.length;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {setOpen(false); trigger.current?.focus();}
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {document.removeEventListener("pointerdown", handleOutside); document.removeEventListener("keydown", handleEscape);};
  }, [open]);
  return <div className={styles.notifications} ref={root}>
    <MuiButton aria-label={t("notifications")} aria-expanded={open} aria-controls="dashboard-unread" className={styles.iconButton} ref={trigger} type="button"
      onClick={() => {if (!open) void inbox.refresh(); setOpen(!open);}}>
      <Bell size={18} aria-hidden="true" />
      {inbox.unread.length > 0 && <i className={styles.notificationDot} aria-hidden="true" />}
    </MuiButton>
    {open && <section aria-label="Unread notifications" className={styles.notificationPopup} id="dashboard-unread" data-motion="popover">
      <header><div><strong>{t("notifications")}</strong><small>Latest unread updates</small></div>{!showLoading && !inbox.failure && <span>{inbox.unread.length} shown</span>}</header>
      {showLoading ? <LoadingRows label="Loading unread notifications" count={2} />
        : inbox.failure ? <p className={styles.notificationEmpty} role="alert">Could not load notifications. <MuiButton type="button" onClick={() => void inbox.refresh()}>Retry</MuiButton></p>
        : inbox.unread.length ? <ul className={styles.notificationList}>{inbox.unread.map((entry) => <NotificationRow entry={entry} key={entry.id} onRead={async () => {await inbox.markRead(entry.id);}} />)}</ul>
          : <p className={styles.notificationEmpty}>You’re caught up.</p>}
      <MuiButton type="button" className={styles.notificationFooter} onClick={() => {setOpen(false); onViewAll();}}>View all notifications <ArrowRight size={16} /></MuiButton>
    </section>}
  </div>;
}

export function NotificationsPage({inbox}: {inbox: ReturnType<typeof useNotifications>}) {
  const t = useTranslations("Site");
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (after?: string) => {
    setPending(true); setFailed(false);
    try {
      const result = await apiRequest<NotificationPage>("/workspace/notifications" + (after ? "?cursor=" + encodeURIComponent(after) : ""));
      setEntries((current) => after ? [...current, ...result.entries] : result.entries);
      setCursor(result.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }, []);
  useEffect(() => {void load();}, [load]);
  return <section>
    <div className={styles.pageHeading}><div><h1>{t("notifications")}</h1><p>All updates from your workspace, including messages you’ve read.</p></div></div>
    <div className={styles.panel}>
      <ul className={styles.notificationList}>{entries.map((entry) => <NotificationRow entry={{...entry, readAt: inbox.readById[entry.id] ?? entry.readAt}} key={entry.id}
        onRead={async () => {await inbox.markRead(entry.id);}} />)}</ul>
      {failed && <p className={styles.notificationEmpty} role="alert">Could not load notifications. <MuiButton onClick={() => void load(cursor ?? undefined)} type="button">Retry</MuiButton></p>}
      {!pending && !failed && !entries.length && <p className={styles.notificationEmpty}>No notifications yet.</p>}
      {pending && <LoadingRows label="Loading notifications" />}
      {cursor && !failed && <MuiButton className={styles.secondaryButton} disabled={pending} onClick={() => void load(cursor)} type="button">Load older notifications</MuiButton>}
    </div>
  </section>;
}
