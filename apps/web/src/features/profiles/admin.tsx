"use client";

import {MaterialInput, MaterialSelect, MaterialTextarea} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
import { useState, useEffect } from "react";
import {
  masterKinds,
  parentKind,
  roleSections,
  type MasterKind,
} from "@the-property-pillar/contracts";
import { apiRequest, ApiClientError } from "@/lib/api/client";
import { MasterSelect, type Option, type Profile } from "./controls";
import styles from "./profiles.module.css";

function label(s: string) {
  return s.toLowerCase().replaceAll("_", " ");
}
function usePage<T>(url: string, version: number) {
  const [items, setItems] = useState<T[]>([]),
    [after, setAfter] = useState<string | null>(null),
    [cursor, setCursor] = useState(""),
    [problem, setProblem] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setCursor("");
    setItems([]);
    setAfter(null);
  }, [url, version]);
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    setProblem("");
    apiRequest<{ items: T[]; next: string | null }>(
      url + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
      { signal: c.signal },
    )
      .then((r) => {
        if (!c.signal.aborted) {
          setItems((old) =>
            cursor
              ? [
                  ...new Map(
                    [...old, ...r.items].map((i) => [
                      (i as { id: string }).id,
                      i,
                    ]),
                  ).values(),
                ]
              : r.items,
          );
          setAfter(r.next);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setProblem(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [url, version, cursor]);
  return { items, problem, busy, more: after ? () => setCursor(after) : null };
}
export function MasterAdmin() {
  const [kind, setKind] = useState<MasterKind>("PROPERTY_CATEGORY"),
    [query, setQuery] = useState(""),
    [parent, setParent] = useState(""),
    [v, refresh] = useState(0);
  const [editing, edit] = useState<Option | null>(null),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [order, setOrder] = useState(0),
    [active, setActive] = useState(true);
  const [problem, fail] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [saving, setSaving] = useState(false);
  const list = usePage<Option>(
    "/profiles/masters?" +
      new URLSearchParams({
        kind,
        all: "1",
        q: query,
        ...(parent ? { parentId: parent } : {}),
      }),
    v,
  );
  function start(o: Option | null) {
    edit(o);
    setName(o?.name ?? "");
    setCode(o?.code ?? "");
    setOrder(o?.sortOrder ?? 0);
    setActive(o?.active ?? true);
    setErrors({});
    fail("");
  }
  return (
    <section className={styles.panel}>
      <h1>Master data</h1>
      <div className={styles.fields}>
        <label>
          Catalog
          <MaterialSelect
            aria-label="Catalog"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as MasterKind);
              setParent("");
              setQuery("");
              start(null);
            }}
          >
            {masterKinds.map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </MaterialSelect>
        </label>
        {parentKind[kind] && (
          <MasterSelect
            label="Parent"
            kind={parentKind[kind]!}
            value={parent}
            onChange={(id) => {
              setParent(String(id ?? ""));
              start(null);
            }}
          />
        )}
        <label>
          Search entries
          <MaterialInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving) return;
          setSaving(true);
          try {
            await apiRequest(
              "/profiles/masters" + (editing ? "/" + editing.id : ""),
              {
                method: editing ? "PATCH" : "POST",
                body: editing
                  ? { name, sortOrder: order, active }
                  : {
                      name,
                      code,
                      sortOrder: order,
                      kind,
                      ...(parent ? { parentId: parent } : {}),
                    },
              },
            );
            start(null);
            refresh((i) => i + 1);
          } catch (e) {
            fail(e instanceof Error ? e.message : "Save failed");
            setErrors(e instanceof ApiClientError ? e.fieldErrors : {});
          } finally {
            setSaving(false);
          }
        }}
      >
        <fieldset>
          <legend>{editing ? "Edit entry" : "Add entry"}</legend>
          <div className={styles.fields}>
            <label>
              Name
              <MaterialInput
                aria-label="Name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <small role="alert">{errors.name}</small>
            </label>
            <label>
              Code
              <MaterialInput
                aria-label="Code"
                disabled={!!editing}
                required
                pattern="[a-zA-Z0-9_\-]+"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <small role="alert">{errors.code}</small>
            </label>
            <label>
              Sort order
              <MaterialInput
                aria-label="Sort order"
                required
                type="number"
                min="0"
                max="100000"
                value={order}
                onChange={(e) => setOrder(e.target.valueAsNumber)}
              />
            </label>
            {editing && (
              <label>
                <MaterialInput
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />{" "}
                Active
              </label>
            )}
          </div>
          <p role="alert">{problem}</p>
          <MuiButton variant="contained" type="submit"
            disabled={saving || (!editing && !!parentKind[kind] && !parent)}
          >
            Save entry
          </MuiButton>{" "}
          {editing && (
            <MuiButton type="button" onClick={() => start(null)}>
              Cancel edit
            </MuiButton>
          )}
        </fieldset>
      </form>
      <div className={styles.list}>
        {list.items.map((o) => (
          <article key={o.id}>
            <strong>{o.name}</strong> {o.parent?.name} &middot;{" "}
            {o.active ? "Active" : "Inactive"} &middot; {o.sortOrder}{" "}
            <MuiButton type="submit" onClick={() => start(o)} aria-label={"Edit " + o.name}>
              Edit
            </MuiButton>
          </article>
        ))}
      </div>
      <small aria-live="polite">
        {list.problem ||
          (list.busy
            ? "Loading entries..."
            : !list.items.length
              ? "No entries found."
              : "")}
      </small>
      {list.more && <MuiButton type="submit" onClick={list.more}>Load more</MuiButton>}
    </section>
  );
}
export function ProfileReviews() {
  const [status, setStatus] = useState("PENDING"),
    [v, refresh] = useState(0),
    [p, setP] = useState<Profile | null>(null),
    [reason, setReason] = useState(""),
    [error, fail] = useState(""),
    [busy, setBusy] = useState(false);
  const list = usePage<{
    id: string;
    role: string;
    user: { fullName: string };
  }>("/profiles/reviews?status=" + status, v);
  function display(value: unknown): string {
    if (Array.isArray(value)) return value.map(display).join(", ");
    if (value && typeof value === "object")
      return Object.entries(value)
        .map(([k, v]) => k + " (" + display(v) + ")")
        .join(", ");
    return (
      p?.selected.find((o) => o.id === value)?.name ??
      p?.files.find((o) => o.id === value)?.originalName ??
      String(value ?? "")
    );
  }
  async function decide(decision: string) {
    if (!p || busy) return;
    setBusy(true);
    try {
      setP(
        await apiRequest<Profile>("/profiles/reviews/" + p.id, {
          method: "POST",
          body: { revision: p.revision, decision, reason },
        }),
      );
      setReason("");
      fail("");
      refresh((n) => n + 1);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.panel}>
      <h1>Profile verification</h1>
      <label>
        Review status{" "}
        <MaterialSelect
          aria-label="Review status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setP(null);
            fail("");
          }}
        >
          {[
            "PENDING",
            "CHANGES_REQUIRED",
            "VERIFIED",
            "REJECTED",
            "SUSPENDED",
          ].map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </MaterialSelect>
      </label>
      <div className={styles.list}>
        {list.items.map((i) => (
          <MuiButton type="submit"
            key={i.id}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setP(await apiRequest<Profile>("/profiles/reviews/" + i.id));
                fail("");
                setReason("");
              } catch (e) {
                fail(e instanceof Error ? e.message : "Could not load profile");
              } finally {
                setBusy(false);
              }
            }}
          >
            {i.user.fullName} &middot; {label(i.role)}
          </MuiButton>
        ))}
      </div>
      {list.more && <MuiButton type="submit" onClick={list.more}>Load more</MuiButton>}
      <small>
        {list.problem ||
          (list.busy
            ? "Loading profiles..."
            : !list.items.length
              ? "No profiles in this status."
              : "")}
      </small>
      {p && (
        <article>
          <h2>{p.account.fullName}</h2>
          <p>
            {label(p.role)} &middot; {p.completion.percentage}% complete
            &middot; {label(p.verification)}
          </p>
          <p>
            {p.account.email} {p.account.phone}
          </p>
          {roleSections[p.role].map((s) => (
            <details key={s.title}>
              <summary>{s.title}</summary>
              <dl>
                {s.fields
                  .filter((f) => p.values[f.key] != null)
                  .map((f) => (
                    <div key={f.key}>
                      <dt>{f.label}</dt>
                      <dd>{display(p.values[f.key])}</dd>
                    </div>
                  ))}
              </dl>
            </details>
          ))}
          <h3>Documents and media</h3>
          {p.files.map((f) => (
            <p key={f.id}>
              <a
                href={"/api/v1/profiles/files/" + f.id}
                target="_blank"
                rel="noreferrer"
              >
                {f.originalName}
              </a>{" "}
              &middot; {label(f.field)}
            </p>
          ))}
          <h3>Review history</h3>
          {p.history.map((h) => (
            <p key={h.id}>
              {new Date(h.createdAt).toLocaleString()} &middot;{" "}
              {label(h.toState)} &middot; {h.reason}
            </p>
          ))}
          <label>
            Decision reason
            <MaterialTextarea
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className={styles.actions}>
            {(p.verification === "PENDING"
              ? [
                  ["VERIFIED", "Approve"],
                  ["CHANGES_REQUIRED", "Request changes"],
                  ["REJECTED", "Reject"],
                ]
              : p.verification === "VERIFIED"
                ? [["SUSPENDED", "Suspend"]]
                : p.verification === "SUSPENDED"
                  ? [["CHANGES_REQUIRED", "Request changes"]]
                  : []
            ).map(([key, text]) => (
              <MuiButton type="submit"
                key={key}
                disabled={
                  busy || (key !== "VERIFIED" && reason.trim().length < 5)
                }
                onClick={() => void decide(key!)}
              >
                {text}
              </MuiButton>
            ))}
          </div>
        </article>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
