"use client";

import {Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions} from "@headlessui/react";
import {ChevronDown, X} from "lucide-react";
import {useEffect, useState} from "react";
import type {MasterKind} from "@the-property-pillar/contracts";
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

function Results({kind, parent, query, omit}: {kind: MasterKind; parent?: string; query: string; omit: string[]}) {
  const [result, setResult] = useState<{key: string; items: Option[]; failed?: boolean}>();
  const params = new URLSearchParams({kind, q: query});
  if (parent) params.set(parent.includes(",") ? "parentIds" : "parentId", parent);
  const key = params.toString();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const {items} = await apiRequest<{items: Option[]}>("/profiles/masters?" + key, {signal: controller.signal});
        if (!controller.signal.aborted) setResult({key, items});
      } catch {
        if (!controller.signal.aborted) setResult({key, items: [], failed: true});
      }
    }, 180);
    return () => {clearTimeout(timer); controller.abort();};
  }, [key]);
  const items = result?.key === key ? result.items.filter(o => !omit.includes(o.id)) : [];
  return <ComboboxOptions static className={styles.masterOptions}>
    {items.map(o => <ComboboxOption key={o.id} value={o}>{o.name}{o.parent && <small>{o.parent.name}</small>}</ComboboxOption>)}
    {!items.length && <div role="status">{result?.key !== key ? "Loading choices…" : result.failed ? "Could not load options. Reopen to retry." : "No matching choices."}</div>}
  </ComboboxOptions>;
}

export function MasterSelect({id, errorId, kind, label, parent, disabled, multiple, value, selected = [], onChange}: Props) {
  const [query, setQuery] = useState("");
  const [known, setKnown] = useState<Option[]>([]);
  const ids = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
  const choices = new Map([...known, ...selected].map(o => [o.id, o]));
  const current = !multiple && ids[0] ? choices.get(ids[0]) ?? null : null;
  function choose(option: Option | null) {
    if (!option) return;
    setKnown(old => [...old.filter(o => o.id !== option.id), option]);
    onChange(multiple ? [...new Set([...ids, option.id])] : option.id, option);
    setQuery("");
  }
  return <div className={styles.picker}>
    {multiple && ids.length > 0 && <div className={styles.chips}>
      {ids.map(key => <button key={key} disabled={disabled} type="button" aria-label={"Remove " + (choices.get(key)?.name ?? label)}
        onClick={() => onChange(ids.filter(id => id !== key))}>{choices.get(key)?.name ?? label} ×</button>)}
    </div>}
    <Combobox immediate disabled={disabled} value={current} by="id" onChange={choose} onClose={() => setQuery("")}>
      {({open}) => <div className={styles.masterField}>
        <div className={styles.masterControl}>
          <ComboboxInput id={id} aria-label={label} aria-describedby={errorId} aria-invalid={!!errorId}
            placeholder={disabled ? "Choose the parent first" : "Search " + label.toLowerCase()}
            displayValue={(o: Option | null) => o?.name ?? ""} onChange={e => setQuery(e.target.value)} />
          {current && <button type="button" aria-label={"Clear " + label} disabled={disabled} onClick={() => onChange(null)}><X size={14}/></button>}
          <ComboboxButton aria-label={"Choose " + label}><ChevronDown size={16}/></ComboboxButton>
        </div>
        {open && <Results kind={kind} parent={parent} query={query} omit={multiple ? ids : []} />}
      </div>}
    </Combobox>
  </div>;
}
