"use client";

import {MaterialSelect} from "@/components/ui/material-fields";

import {useState} from "react";
import {adminStatusLabel} from "@/features/admin";
import type {WorkspaceCollection} from "./types";
import styles from "./dashboard.module.css";

export function WorkspaceCharts({collections, primary}: {collections: WorkspaceCollection[]; primary?: string}) {
  const [selected, setSelected] = useState("");
  const collection = collections.find(({key}) => key === selected)
    ?? collections.find(({key, items}) => key === primary && items.length)
    ?? collections.find(({items}) => items.length)
    ?? collections[0];
  if (!collection) return null;
  const statusCounts = new Map<string, number>();
  const dates = new Map<string, number>();
  const now = new Date();
  const formatDay = new Intl.DateTimeFormat("en-IN", {day: "numeric", month: "short"});
  const dateKey = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
  for (let days = 6; days >= 0; days--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    dates.set(dateKey(day), 0);
  }
  for (const record of collection.items) {
    statusCounts.set(record.status, (statusCounts.get(record.status) ?? 0) + 1);
    const key = dateKey(new Date(record.createdAt));
    if (dates.has(key)) dates.set(key, dates.get(key)! + 1);
  }
  const maxDaily = Math.max(1, ...dates.values());
  const total = collection.items.length;
  return <section className={styles.charts} aria-label="Workspace charts">
    <header><h2>Workspace analytics</h2><label>Collection
      <MaterialSelect value={collection.key} onChange={(event) => setSelected(event.target.value)}>
        {collections.map(({key, label}) => <option key={key} value={key}>{label}</option>)}
      </MaterialSelect></label></header>
    <div className={styles.chartGrid}>
      <article className={styles.panel}><h3>Current status breakdown</h3>
        <p>{total} loaded {total === 1 ? "record" : "records"}</p>
        {total ? <ul className={styles.statusBars}>{[...statusCounts].sort(([, a], [, b]) => b - a).map(([status, count]) => (
          <li key={status}><span>{adminStatusLabel(status)}</span><strong>{count}</strong>
            <div aria-hidden="true"><span style={{width: `${count / total * 100}%`}} /></div></li>
        ))}</ul> : <p>No records to chart.</p>}
      </article>
      <article className={styles.panel}><h3>Records created in the last 7 days</h3>
        <p>{[...dates.values()].reduce((total, count) => total + count, 0)} new records from this collection</p>
        <ul className={styles.dayBars}>{[...dates].map(([day, count]) => <li key={day}>
          <strong>{count}</strong><div aria-hidden="true"><span style={{height: `${count / maxDaily * 100}%`}} /></div>
          <span>{formatDay.format(new Date(day))}</span>
        </li>)}</ul>
      </article>
    </div>
  </section>;
}
