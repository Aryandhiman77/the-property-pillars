"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { roleSections } from "@the-property-pillar/contracts";
import { ApiClientError, apiRequest } from "@/lib/api/client";
import { LoadingRows } from "@/components/ui/loading-skeleton";
import {
  ProfileInput,
  type Completion,
  type Profile,
  type Values,
  type Option,
} from "./controls";
import styles from "./profiles.module.css";

export function CompletionCard({ open }: { open: () => void }) {
  const [value, set] = useState<Completion>(),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    apiRequest<Completion>("/profiles/completion", { signal: c.signal })
      .then(set)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  return (
    <section className={styles.panel} aria-label="Profile completion">
      <h2>
        Profile completion {value && <strong>{value.percentage}%</strong>}
      </h2>
      {value ? (
        <>
          <progress
            max="100"
            value={value.percentage}
            aria-label="Profile completion"
          />
          <p>
            {value.nextRecommendedActions[0] ??
              "All required sections are complete."}
          </p>
        </>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <LoadingRows label="Loading profile completion" />
      )}
      <button type="button" onClick={open}>
        Complete Profile
      </button>
    </section>
  );
}
export function AddressSearch({
  onSelect,
}: {
  onSelect: (data: {
    items: Option[];
    address: string;
    latitude?: number;
    longitude?: number;
  }) => void;
}) {
  const [q, setQ] = useState(""),
    [items, setItems] = useState<{ label: string; selection: string }[]>([]),
    [note, setNote] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setItems([]);
    setNote("");
    const timer = setTimeout(() => {
      if (q.trim().length < 2) return;
      apiRequest<{ items: typeof items }>(
        "/profiles/places?q=" + encodeURIComponent(q),
        { signal: c.signal },
      )
        .then((r) => {
          setItems(r.items);
          if (!r.items.length)
            setNote("Choose a location from the dropdowns below.");
        })
        .catch(() => {
          if (!c.signal.aborted)
            setNote("Choose a location from the dropdowns below.");
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [q]);
  async function locate() {
    if (!navigator.geolocation) {
      setNote("Use the city search or dropdowns below.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await apiRequest<{ items: typeof items }>(
            "/profiles/places?latitude=" +
              pos.coords.latitude +
              "&longitude=" +
              pos.coords.longitude,
          );
          setItems(r.items);
          setNote(
            r.items.length ? "Select your address." : "Choose a city below.",
          );
        } catch {
          setNote("Choose a city below.");
        }
      },
      () => setNote("Enter your city below."),
      { timeout: 8000 },
    );
  }
  return (
    <fieldset>
      <legend>Find an address</legend>
      <div className={styles.actions}>
        <input
          type="search"
          aria-label="Find an address"
          placeholder="City or address"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" onClick={() => void locate()}>
          Use my location
        </button>
      </div>
      {items.map((o) => (
        <button
          type="button"
          key={o.selection}
          onClick={async () => {
            try {
              const result = await apiRequest<Parameters<typeof onSelect>[0]>(
                "/profiles/places/select",
                { method: "POST", body: { selection: o.selection } },
              );
              onSelect(result);
              setQ("");
              setItems([]);
            } catch (e) {
              setNote(
                e instanceof Error ? e.message : "Choose another address.",
              );
            }
          }}
        >
          {o.label}
        </button>
      ))}
      {note && <small>{note}</small>}
    </fieldset>
  );
}
export function RoleEditor({ initialSection }: { initialSection?: string }) {
  const [p, setP] = useState<Profile>(),
    [index, setIndex] = useState(0),
    [changes, setChanges] = useState<Values>({}),
    [opts, setOpts] = useState<Option[]>([]);
  const [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    apiRequest<Profile>("/profiles/me", { signal: c.signal })
      .then((value) => {
        setP(value);
        setChanges({});
        setError("");
        setErrors({});
        setIndex(
          Math.max(
            0,
            roleSections[value.role].findIndex(
              (s) => s.title === initialSection,
            ),
          ),
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [reload, initialSection]);
  if (!p)
    return (
      <section className={styles.panel}>
        {error ? (
          <button onClick={() => setReload((r) => r + 1)}>
            {error} - Retry
          </button>
        ) : (
          <LoadingRows label="Loading your profile" />
        )}
      </section>
    );
  const profile = p,
    sections = roleSections[p.role],
    section = sections[index]!,
    values = { ...p.values, ...changes };
  function move(i: number) {
    if (
      Object.keys(changes).length &&
      !window.confirm("Discard unsaved changes in this section?")
    )
      return;
    setChanges({});
    setErrors({});
    setError("");
    setIndex(i);
  }
  function change(key: string, value: unknown) {
    setChanges((old) => {
      const result = { ...old, [key]: value };
      const clear = (parent: string) =>
        section.fields
          .filter((f) => f.parent === parent)
          .forEach((f) => {
            result[f.key] = f.kind === "masters" ? [] : null;
            clear(f.key);
          });
      const previous = old[key] ?? profile.values[key];
      if (
        !Array.isArray(previous) ||
        !Array.isArray(value) ||
        previous.some((id) => !value.includes(id))
      )
        clear(key);
      return result;
    });
    setErrors((e) => ({ ...e, [key]: "" }));
  }
  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : "Could not save.");
    setErrors(e instanceof ApiClientError ? e.fieldErrors : {});
  }
  async function save(advance: boolean) {
    setBusy(true);
    try {
      if (Object.keys(changes).length)
        setP(
          await apiRequest<Profile>("/profiles/me/" + profile.role, {
            method: "PATCH",
            body: {
              revision: profile.revision,
              section: section.title,
              values: changes,
            },
          }),
        );
      setChanges({});
      setError("");
      setErrors({});
      toast.success("Profile section saved.");
      if (advance) setIndex((i) => Math.min(i + 1, sections.length - 1));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(path: string, file: File) {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        name: file.name,
        field: path,
        revision: String(profile.revision),
      });
      await apiRequest("/profiles/files?" + params, {
        method: "POST",
        body: new Blob([file], { type: "application/octet-stream" }),
      });
      const fresh = await apiRequest<Profile>("/profiles/me");
      setP(fresh);
      toast.success("File saved.");
      return fresh;
    } finally {
      setBusy(false);
    }
  }
  const ready =
    p.completion.percentage === 100 &&
    ["NOT_SUBMITTED", "REJECTED", "CHANGES_REQUIRED"].includes(p.verification);
  return (
    <section className={styles.panel} aria-label="Role profile">
      <h2>
        {p.role === "BLUE_COLLAR_WORKER"
          ? "Skilled worker"
          : p.role === "WHITE_COLLAR_SEEKER"
            ? "Job seeker"
            : p.role[0] + p.role.slice(1).toLowerCase()}{" "}
        profile
      </h2>
      <p>
        {p.account.fullName} &middot; {p.completion.percentage}% complete
        &middot; {p.verification.replaceAll("_", " ").toLowerCase()}
      </p>
      {p.history[0]?.reason && (
        <small>Latest update &middot; {p.history[0].reason}</small>
      )}
      <nav className={styles.tabs} aria-label="Profile sections">
        {sections.map((s, i) => (
          <button
            type="button"
            disabled={busy}
            aria-current={i === index ? "step" : undefined}
            key={s.title}
            onClick={() => move(i)}
          >
            {s.title}
          </button>
        ))}
      </nav>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
              "continue",
          );
        }}
      >
        <fieldset disabled={busy}>
          <legend>{section.title}</legend>
          {section.fields.some((f) => f.key === "country") && (
            <AddressSearch
              onSelect={(r) => {
                setOpts(r.items);
                const patch: Values = {};
                for (const f of section.fields) {
                  if (
                    ["country", "state", "city", "locality"].includes(f.key) &&
                    f.kind === "master"
                  )
                    patch[f.key] =
                      r.items.find((o) => o.kind === f.master)?.id ?? null;
                  else if (["address", "latitude", "longitude"].includes(f.key))
                    patch[f.key] =
                      r[f.key as "address" | "latitude" | "longitude"] ?? null;
                  else if (f.key === "citiesServed" && f.parent === "state")
                    patch[f.key] = r.items
                      .filter((o) => o.kind === "CITY")
                      .map((o) => o.id);
                  else if (f.parent) patch[f.key] = [];
                }
                setChanges((old) => ({ ...old, ...patch }));
              }}
            />
          )}
          <div className={styles.fields}>
            {section.fields.map((f) => (
              <ProfileInput
                key={f.key}
                field={f}
                values={values}
                profile={{ ...p, selected: [...p.selected, ...opts] }}
                error={errors[f.key]}
                change={change}
                upload={upload}
              />
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert">
            {error}{" "}
            <button
              type="button"
              onClick={() => {
                if (
                  !Object.keys(changes).length ||
                  window.confirm("Reload and discard unsaved changes?")
                )
                  setReload((n) => n + 1);
              }}
            >
              Reload saved profile
            </button>
          </p>
        )}
        <div className={styles.actions}>
          <button className={styles.primary} disabled={busy} type="submit">
            Save
          </button>
          {index < sections.length - 1 && (
            <button type="submit" value="continue" disabled={busy}>
              Save &amp; Continue
            </button>
          )}
        </div>
      </form>
      {ready && (
        <button
          disabled={busy || !!Object.keys(changes).length}
          onClick={async () => {
            setBusy(true);
            try {
              setP(
                await apiRequest<Profile>("/profiles/me/submit", {
                  method: "POST",
                  body: { revision: p.revision },
                }),
              );
              toast.success("Profile submitted for verification.");
            } catch (e) {
              fail(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          Submit for verification
        </button>
      )}
      {p.completion.incompleteSections.length > 0 && (
        <details>
          <summary>Remaining profile requirements</summary>
          <ul>
            {p.completion.incompleteSections.map((s) => (
              <li key={s.key}>
                {s.key} &middot; {s.missing.join(", ")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
