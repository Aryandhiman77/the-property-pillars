"use client";

import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import {useEffect, useState} from "react";
import type {MasterKind} from "@the-property-pillar/contracts";
import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import {apiRequest} from "@/lib/api/client";
import type {Option} from "./controls";
import styles from "./profiles.module.css";

type Props = {
  id?: string;
  errorId?: string;
  kind: MasterKind;
  label: string;
  parent?: string;
  disabled?: boolean;
  multiple?: boolean;
  value: unknown;
  selected?: Option[];
  onChange: (value: unknown, option?: Option) => void;
};

type Page = {items: Option[]; next: string | null};

export function MasterSelect({id, errorId, kind, label, parent, disabled, multiple, value, selected = [], onChange}: Props) {
  const [known, setKnown] = useState<Option[]>([]);
  const [filter, setFilter] = useState<{scope: string; text: string}>();
  const [page, setPage] = useState<{key: string; cursor: string}>();
  const [result, setResult] = useState<Page & {key: string; cursor: string; failed: boolean}>();
  const [attempt, setAttempt] = useState(0);

  const params = new URLSearchParams({kind});
  if (parent) params.set(parent.includes(",") ? "parentIds" : "parentId", parent);
  const scope = params.toString();
  const query = filter?.scope === scope ? filter.text : "";
  if (query) params.set("q", query);
  const key = params.toString();
  const cursor = page?.key === key ? page.cursor : "";

  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams(key);
      if (cursor) params.set("cursor", cursor);
      try {
        const data = await apiRequest<Page>("/profiles/masters?" + params, {signal: controller.signal});
        if (!controller.signal.aborted) setResult(previous => ({
          key, cursor, failed: false, next: data.next,
          items: cursor && previous?.key === key
            ? Array.from(new Map([...previous.items, ...data.items].map(item => [item.id, item])).values())
            : data.items,
        }));
      } catch {
        if (!controller.signal.aborted) setResult(previous => ({
          key, cursor, failed: true, next: null, items: cursor && previous?.key === key ? previous.items : [],
        }));
      }
    }, query ? 180 : 0);
    return () => {clearTimeout(timer); controller.abort();};
  }, [key, cursor, disabled, attempt, query]);

  const current = result?.key === key ? result : undefined;
  const ids = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
  const items = current?.items ?? [];
  const choices = new Map([...known, ...selected, ...items].map(option => [option.id, option]));
  const options = items.filter(option => !ids.includes(option.id));
  const canSearchPlaces = kind === "CITY" || kind === "STATE";
  const loading = !disabled && current?.cursor !== cursor;

  function search(text: string) {
    setPage(undefined);
    setFilter({scope, text});
  }

  return <div className={styles.picker}>
    <MaterialSelect id={id} aria-label={label} aria-invalid={Boolean(errorId)} aria-describedby={errorId}
      disabled={disabled} value={multiple ? "" : ids[0] ?? ""} onChange={event => {
        const option = choices.get(event.target.value);
        if (option) {
          setKnown(old => [...old.filter(item => item.id !== option.id), option]);
          onChange(multiple ? [...ids, option.id] : option.id, option);
        } else if (!multiple) onChange(null);
      }}>
      <option value="">{loading && !items.length ? "Loading options…" : "Select an option"}</option>
      {!multiple && ids.length > 0 && <option value={ids[0]}>{choices.get(ids[0])?.name ?? "Current selection"}</option>}
      {options.map(option => <option key={option.id} value={option.id}>{option.name}{option.parent && " · " + option.parent.name}</option>)}
      {!disabled && current && !current.failed && !loading && !options.length && !current.next &&
        <option disabled>{multiple && ids.length ? "No more options" : "No options available"}</option>}
    </MaterialSelect>
    {multiple && ids.length > 0 && <div className={styles.chips}>
      {ids.map(key => <Chip key={key} size="small" disabled={disabled} label={choices.get(key)?.name ?? label}
        aria-label={"Remove " + (choices.get(key)?.name ?? label)} onDelete={() => onChange(ids.filter(id => id !== key))} />)}
    </div>}
    {!disabled && current?.next && <Button type="button" size="small" disabled={loading}
      onClick={() => setPage({key, cursor: current.next!})}>Load more options</Button>}
    {!disabled && current?.failed && <div role="status">Could not load options. <Button type="button" size="small" onClick={() => setAttempt(n => n + 1)}>Retry</Button></div>}
    {canSearchPlaces && !disabled && <details key={scope} onToggle={event => {if (!event.currentTarget.open && query) search("");}}>
      <summary>Find by name</summary>
      <MaterialInput type="search" aria-label={"Filter " + label} value={query} onChange={event => search(event.target.value)} />
    </details>}
  </div>;
}
