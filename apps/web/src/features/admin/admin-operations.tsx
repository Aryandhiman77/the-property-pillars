"use client";

import {useMemo, useState} from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Filter,
  Layers3,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import type {WorkspaceCollection, WorkspaceItem} from "@/features/dashboard/types";
import {adminSections, adminStatusLabel, getAdminSection} from "./admin-sections";
import styles from "./admin-operations.module.css";

export type AdminOperationsProps = {
  collections: WorkspaceCollection[];
  initialModule?: string;
  view: string;
  onNavigate: (view: string) => void;
  onInspect: (collection: WorkspaceCollection, item: WorkspaceItem) => void;
};

type QueueRecord = {
  collection: WorkspaceCollection;
  item: WorkspaceItem;
  priority: ReturnType<typeof getPriority>;
};

const criticalStatuses = new Set(["FLAGGED", "SUSPENDED", "SPAM"]);
const reviewStatuses = new Set(["PENDING_REVIEW", "PENDING_VERIFICATION", "UNDER_REVIEW", "OPEN", "NEW"]);
const waitingStatuses = new Set(["CHANGES_REQUESTED", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_USER", "QUOTES_RECEIVED", "ROUTED", "CONTACTED", "SUBMITTED"]);
const pendingModerationStatuses = new Set(["PENDING_REVIEW", "PENDING_VERIFICATION"]);

function getPriority(statusValue: string) {
  const status = statusValue.toUpperCase();
  if (criticalStatuses.has(status)) return {rank: 0, key: "critical", label: "High priority"};
  if (reviewStatuses.has(status)) return {rank: 1, key: "review", label: "Needs review"};
  if (waitingStatuses.has(status)) return {rank: 2, key: "waiting", label: "In progress"};
  return {rank: 3, key: "routine", label: "Routine"};
}

function isActionable(status: string) {
  return getPriority(status).rank < 3;
}

function statusTone(statusValue: string) {
  const status = statusValue.toUpperCase();
  if (["VERIFIED", "PUBLISHED", "APPROVED", "ACTIVE", "AVAILABLE", "ACCEPTED", "RESOLVED", "HIRED", "WON"].includes(status)) return styles.statusPositive;
  if (criticalStatuses.has(status) || ["REJECTED", "LOST", "CANCELLED"].includes(status)) return styles.statusCritical;
  if (reviewStatuses.has(status) || waitingStatuses.has(status)) return styles.statusPending;
  return styles.statusNeutral;
}

function ageInDays(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function ageLabel(value: string) {
  const days = ageInDays(value);
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated 1 day ago";
  return `Updated ${days} days ago`;
}

function searchableText(record: QueueRecord) {
  const primitiveData = Object.values(record.item.data ?? {}).filter((value) => ["string", "number", "boolean"].includes(typeof value)).join(" ");
  return `${record.item.id} ${record.item.title} ${record.item.description ?? ""} ${adminStatusLabel(record.item.status)} ${record.collection.label} ${primitiveData}`.toLowerCase();
}

function sortPendingFirst(left: QueueRecord, right: QueueRecord) {
  if (left.priority.rank !== right.priority.rank) return left.priority.rank - right.priority.rank;
  const leftAge = ageInDays(left.item.updatedAt);
  const rightAge = ageInDays(right.item.updatedAt);
  if (leftAge !== rightAge) return rightAge - leftAge;
  return new Date(right.item.updatedAt).getTime() - new Date(left.item.updatedAt).getTime();
}

export function AdminOperations({collections, initialModule, view, onNavigate, onInspect}: AdminOperationsProps) {
  const section = getAdminSection(view);
  const isOverview = section.id === "admin-overview";
  const isReviewQueue = section.id === "admin-review";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(isReviewQueue ? "PENDING_MODERATION" : "ALL");
  const [moduleFilter, setModuleFilter] = useState(initialModule ?? "ALL");

  const scopedCollections = useMemo(() => {
    if (isOverview) return collections;
    const keys = new Set<string>(section.collectionKeys);
    return collections.filter((collection) => keys.has(collection.key));
  }, [collections, isOverview, section.collectionKeys]);

  const allRecords = useMemo<QueueRecord[]>(() => scopedCollections
    .flatMap((collection) => collection.items.map((item) => ({collection, item, priority: getPriority(item.status)})))
    .sort(sortPendingFirst), [scopedCollections]);

  const statuses = useMemo(() => Array.from(new Set(allRecords.map(({item}) => item.status))).sort(), [allRecords]);
  const scopedStatus = statuses.includes(statusFilter) || statusFilter === "PENDING_MODERATION" ? statusFilter : "ALL";
  const filteredRecords = useMemo(() => allRecords.filter((record) => {
    if (scopedStatus === "PENDING_MODERATION" && !pendingModerationStatuses.has(record.item.status)) return false;
    if (scopedStatus !== "ALL" && scopedStatus !== "PENDING_MODERATION" && record.item.status !== scopedStatus) return false;
    if (moduleFilter !== "ALL" && record.collection.key !== moduleFilter) return false;
    if (query.trim() && !searchableText(record).includes(query.trim().toLowerCase())) return false;
    return isOverview ? isActionable(record.item.status) : true;
  }), [allRecords, isOverview, moduleFilter, query, scopedStatus]);

  const actionableCount = allRecords.filter(({item}) => isActionable(item.status)).length;
  const highPriorityCount = allRecords.filter(({priority}) => priority.key === "critical").length;
  const staleActionCount = allRecords.filter(({item}) => isActionable(item.status) && ageInDays(item.updatedAt) >= 7).length;
  const hasFilters = Boolean(query.trim()) || scopedStatus !== "ALL" || moduleFilter !== "ALL";

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setModuleFilter("ALL");
  }

  return (
    <section className={styles.operations}>
      <header className={`${styles.heading} ${isOverview ? styles.overviewHeading : ""}`}>
        <div>
          {isOverview ? <p className={styles.kicker}>Admin workspace</p> : null}
          <h1>{section.label}</h1>
          <p>{section.description}</p>
        </div>
        {isOverview ? <button className={styles.reviewButton} onClick={() => onNavigate("admin-review")} type="button"><ClipboardCheck size={17} /> Open review queue <ChevronRight size={16} /></button> : null}
      </header>

      <div aria-label="Operational metrics" className={styles.metrics}>
        <article><span><Layers3 size={17} /></span><div><strong>{allRecords.length}</strong><small>Loaded records</small></div></article>
        <article><span><Clock3 size={17} /></span><div><strong>{actionableCount}</strong><small>Open work</small></div></article>
        <article className={highPriorityCount ? styles.metricAlert : ""}><span><AlertTriangle size={17} /></span><div><strong>{highPriorityCount}</strong><small>High priority</small></div></article>
        <article className={staleActionCount ? styles.metricWarm : ""}><span><CircleAlert size={17} /></span><div><strong>{staleActionCount}</strong><small>Idle for 7+ days</small></div></article>
      </div>

      {!isOverview ? (
        <div className={styles.moduleStrip} aria-label="Modules in this group">
          {scopedCollections.map((collection) => {
            const actionable = collection.items.filter(({status}) => isActionable(status)).length;
            return (
              <button aria-pressed={moduleFilter === collection.key} className={moduleFilter === collection.key ? styles.moduleActive : ""} key={collection.key} onClick={() => setModuleFilter((current) => current === collection.key ? "ALL" : collection.key)} type="button">
                <span>{collection.label}</span><strong>{collection.items.length}</strong>{actionable ? <em>{actionable} open</em> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={styles.workbench}>
        <div className={styles.workbenchHeader}>
          <h2>{isOverview ? "Needs attention" : "Records"}</h2>
          <span aria-live="polite">{filteredRecords.length} of {allRecords.length} loaded records</span>
        </div>

        <div className={styles.filters}>
          <div className={styles.searchField}>
            <Search aria-hidden="true" size={16} />
            <input aria-label="Search loaded admin records" onChange={(event) => setQuery(event.target.value)} placeholder="Search title, reference, city or status…" value={query} />
            {query ? <button aria-label="Clear search" onClick={() => setQuery("")} type="button"><X size={14} /></button> : null}
          </div>
          <label><Filter size={14} /><span className="sr-only">Filter by status</span><select onChange={(event) => setStatusFilter(event.target.value)} value={scopedStatus}><option value="ALL">All statuses</option>{isReviewQueue ? <option value="PENDING_MODERATION">Awaiting decision</option> : null}{statuses.map((status) => <option key={status} value={status}>{adminStatusLabel(status)}</option>)}</select></label>
          <label><Layers3 size={14} /><span className="sr-only">Filter by module</span><select onChange={(event) => setModuleFilter(event.target.value)} value={moduleFilter}><option value="ALL">All modules</option>{scopedCollections.map((collection) => <option key={collection.key} value={collection.key}>{collection.label}</option>)}</select></label>
          {hasFilters ? <button className={styles.clearButton} onClick={clearFilters} type="button"><SlidersHorizontal size={14} /> Clear</button> : null}
        </div>

        {filteredRecords.length ? (
          <div className={styles.queueWrap}>
            <table aria-label={isOverview ? "Records that need attention" : "Admin records"} className={styles.queue} role="table">
              <thead role="rowgroup"><tr role="row"><th scope="col">Record</th><th scope="col">Priority</th><th scope="col">Module</th><th scope="col">Status</th><th scope="col">Last activity</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody role="rowgroup">
                {filteredRecords.map((record) => (
                  <tr className={styles.queueRow} key={`${record.collection.key}-${record.item.id}`} role="row">
                    <td className={styles.recordTitle} data-label="Record" role="cell"><strong>{record.item.title}</strong>
                      <small>{record.item.description || `ID ${record.item.id.slice(0, 10)}`}</small></td>
                    <td data-label="Priority" role="cell"><span className={`${styles.priority} ${styles[`priority_${record.priority.key}`]}`}>{record.priority.key === "critical" ? <AlertTriangle size={12} /> : record.priority.key === "review" ? <Clock3 size={12} /> : <CheckCircle2 size={12} />}{record.priority.label}</span></td>
                    <td data-label="Module" role="cell">{record.collection.label}</td>
                    <td data-label="Status" role="cell"><span className={`${styles.status} ${statusTone(record.item.status)}`}>{adminStatusLabel(record.item.status)}</span></td>
                    <td data-label="Last activity" role="cell"><time className={ageInDays(record.item.updatedAt) >= 7 && isActionable(record.item.status) ? styles.ageStale : undefined} dateTime={record.item.updatedAt}>{ageLabel(record.item.updatedAt)}</time></td>
                    <td role="cell"><button aria-label={`Inspect ${record.item.title}`} className={styles.inspectButton} onClick={() => onInspect(record.collection, record.item)} type="button">Inspect <ChevronRight size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            <span>{hasFilters ? <Search size={20} /> : <CheckCircle2 size={20} />}</span>
            <h3>{scopedStatus === "PENDING_MODERATION" && !query && moduleFilter === "ALL" ? "No submissions awaiting a decision" : hasFilters ? "No matching records" : isOverview ? "No open work" : "No records in this group"}</h3>
            {hasFilters ? <button onClick={clearFilters} type="button">Show all records</button> : null}
          </div>
        )}
      </div>

      {isOverview ? (
        <section className={styles.modules}>
          <h2>Operations modules</h2>
          <div className={styles.sectionCards}>
            {adminSections.slice(1).map((item) => {
              const Icon = item.icon;
              const keys = new Set<string>(item.collectionKeys);
              const groupCollections = collections.filter((collection) => keys.has(collection.key));
              const loaded = groupCollections.reduce((total, collection) => total + collection.items.length, 0);
              const actionable = groupCollections.reduce((total, collection) => total + collection.items.filter(({status}) => isActionable(status)).length, 0);
              return (
                <button key={item.id} onClick={() => onNavigate(item.id)} type="button">
                  <span className={styles.cardIcon}><Icon size={18} /></span>
                  <span><strong>{item.shortLabel}</strong><small>{loaded} records · {actionable} open</small></span>
                  <ArrowUpRight size={16} />
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}

