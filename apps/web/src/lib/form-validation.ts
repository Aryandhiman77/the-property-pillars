import type {FormEvent} from "react";

export type FieldErrors = Record<string, string>;

export function isFormControl(value: unknown): value is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return value instanceof HTMLInputElement || value instanceof HTMLSelectElement || value instanceof HTMLTextAreaElement;
}

export function invalidControls(form: HTMLFormElement) {
  return Object.fromEntries(Array.from(form.elements).filter(isFormControl)
    .filter((field) => field.name && field.willValidate && !field.validity.valid)
    .map((field) => [field.name, field.validationMessage]));
}

export function splitFieldErrors(errors: FieldErrors, names: Iterable<string>, aliases: Record<string, string> = {}) {
  const available = new Set(names);
  const fields = new Map<string, Set<string>>();
  const general = new Set<string>();
  for (const [rawPath, message] of Object.entries(errors)) {
    const path = rawPath.replace(/\[(\d+)\]/g, ".$1").replace(/^(?:data|billing)\./, "");
    let key = Object.hasOwn(aliases, path) ? aliases[path] : path;
    while (key.includes(".") && !available.has(key)) key = key.slice(0, key.lastIndexOf("."));
    if (!available.has(key)) {
      general.add(message);
      continue;
    }
    const messages = fields.get(key) ?? new Set<string>();
    messages.add(message);
    fields.set(key, messages);
  }
  return {fields: Object.fromEntries([...fields].map(([key, messages]) => [key, [...messages].join(" ")])), general: [...general].join(" ")};
}

export function focusInvalidControl(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    if (!form?.isConnected) return;
    const field = form.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)');
    field?.focus({preventScroll: true});
    field?.scrollIntoView({block: "nearest"});
  });
}

export function fieldAttributes(id: string, name: string, error?: string, helpId?: string) {
  return {name, "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": [error && `${id}-${name}`, helpId].filter(Boolean).join(" ") || undefined};
}

export function clearChangedField(event: FormEvent<HTMLFormElement>, setErrors: (update: (previous: FieldErrors) => FieldErrors) => void) {
  if (!isFormControl(event.target) || !event.target.name) return;
  const name = event.target.name;
  setErrors((previous) => {
    if (!Object.hasOwn(previous, name)) return previous;
    const next = {...previous};
    delete next[name];
    return next;
  });
}
