import {X} from "lucide-react";
import {useId, useMemo, useRef, useState, type ReactNode} from "react";
import type {fieldAttributes} from "@/lib/form-validation";
import styles from "./dashboard.module.css";

type ChipListOptions = {item: "highlight" | "amenity"; limit: number; maxLength: number};

export function useChipList(initial: unknown, {item, limit, maxLength}: ChipListOptions) {
  const [items, setItems] = useState<string[]>(() => {
    const entries = Array.isArray(initial) ? initial : typeof initial === "string" ? initial.split("\n") : [];
    return entries.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
  });
  const [entry, setEntry] = useState("");
  const pending = entry.trim();
  const plural = item === "amenity" ? "amenities" : "highlights";
  let pendingError: string | undefined;
  if (pending) {
    if (pending.length < 2) pendingError = `Enter ${item === "amenity" ? "an amenity" : "a highlight"} with at least 2 characters.`;
    else if (pending.length > maxLength) pendingError = `Keep each ${item} to ${maxLength} characters.`;
    else if (items.some((value) => value.toLowerCase() === pending.toLowerCase())) pendingError = `This ${item} is already added.`;
    else if (items.length >= limit) pendingError = `Add up to ${limit} ${plural}.`;
  }
  const withPending = useMemo(() => pending && !pendingError ? [...items, pending] : items, [items, pending, pendingError]);
  return {item, maxLength, items, setItems, entry, setEntry, pending, pendingError, withPending};
}

export function ChipListField({list, label, required, placeholder, disabled, inputProps, error, onError, className}: {
  list: ReturnType<typeof useChipList>;
  label: string;
  required?: boolean;
  placeholder?: string;
  disabled: boolean;
  inputProps: ReturnType<typeof fieldAttributes>;
  error: ReactNode;
  onError: (message?: string) => void;
  className: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  function add() {
    if (!list.pending) return;
    if (list.pendingError) onError(list.pendingError);
    else {
      list.setItems((current) => [...current, list.pending]);
      list.setEntry("");
      onError();
    }
    input.current?.focus();
  }

  return <div className={className}>
    <span><label htmlFor={id}>{label}{required && <b> *</b>}</label></span>
    <div className={styles.chipEntry}>
      <input {...inputProps} id={id} ref={input} value={list.entry} disabled={disabled}
        maxLength={list.maxLength} placeholder={placeholder} aria-required={required && !list.items.length || undefined}
        onChange={(event) => list.setEntry(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          add();
        }} />
      <button className={styles.secondaryButton} type="button" disabled={!list.pending || disabled} onClick={add}>
        {list.item === "amenity" ? "Add amenity" : "Save highlight"}
      </button>
    </div>
    {error}
    {list.items.length > 0 && <ul className={styles.entryChips} aria-label={list.item === "amenity" ? "Other amenities" : "Saved highlights"}>
      {list.items.map((value, index) => <li key={index}>
        <span>{value}</span>
        <button type="button" aria-label={`Remove ${list.item}: ${value}`} disabled={disabled} onClick={() => {
          list.setItems((current) => current.filter((_, position) => position !== index));
          onError();
          input.current?.focus();
        }}><X size={14} aria-hidden="true" /></button>
      </li>)}
    </ul>}
  </div>;
}
