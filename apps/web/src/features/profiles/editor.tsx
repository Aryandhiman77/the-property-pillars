"use client";

import {MaterialInput} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
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

function ProgressRail({completion, jump, busy = false}: {completion: Completion; jump: (group: string,label: string) => void; busy?: boolean}) {
  return (
      <aside className={styles.progressRail} aria-label="Profile progress">
        <header><h3>Profile completion</h3><strong>{completion.percentage}%</strong></header>
        <progress max={100} value={completion.percentage} aria-label="Saved profile completion" />
        {completion.incompleteSections.length ? <><h4>Still to complete</h4>
          {completion.incompleteSections.map(group => <div key={group.key}>
            <strong>{group.key}</strong>
            <ul>{group.missing.map(label => <li key={label}><button type="button" disabled={busy} onClick={() => jump(group.key, label)}>{label}<span aria-hidden="true"> ↗</span></button></li>)}</ul>
          </div>)}</> : <p>All required fields are complete.</p>}
      </aside>
  );
}

type ProfileTarget = {group: string; label: string};
export function ProfileOverview({open,children}: {open: (target?: ProfileTarget) => void; children: React.ReactNode}) {
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
    <div className={styles.profileLayout}><div className={styles.profileMain}>{children}</div>
      <div className={styles.overviewRail}>{value ? <ProgressRail completion={value} jump={(group,label) => open({group,label})}/> :
        error ? <p role="alert">{error}</p> : <LoadingRows label="Loading profile completion"/>}
        <MuiButton type="button" onClick={() => open()}>Open profile</MuiButton>
      </div>
    </div>
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
        <MaterialInput
          type="search"
          aria-label="Find an address"
          placeholder="City or address"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <MuiButton type="button" onClick={() => void locate()}>
          Use my location
        </MuiButton>
      </div>
      {items.map((o) => (
        <MuiButton
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
        </MuiButton>
      ))}
      {note && <small>{note}</small>}
    </fieldset>
  );
}
function fieldId(profile: Profile, group: string, label: string) {
  if (group === "Account") {
    const keys: Record<string,string> = {"Full name":"name","Mobile number":"phone",Email:"email"};
    return "account-field-" + keys[label];
  }
  const section = roleSections[profile.role].find(item => item.title === group);
  return "profile-field-" + section?.fields.find(field => field.label === label)?.key;
}

function focusField(id: string) {
  const field = document.getElementById(id);
  if (!field) return false;
  field.scrollIntoView({block: "center"});
  const control = field.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])');
  (control ?? field).focus({preventScroll: true});
  return true;
}

function profileSteps(role: Profile["role"]) {
  const sections = roleSections[role];
  const personal = sections.find(section => ["Personal","Contact person"].includes(section.title));
  return [{title:"Account",section:personal}, ...sections.filter(section => section !== personal).map(section => ({title:section.title,section}))];
}

export function RoleEditor({ initialSection, target, accountVersion, account }: { initialSection?: string; target?: ProfileTarget; accountVersion?: number; account: React.ReactNode }) {
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
            profileSteps(value.role).findIndex(
              (s) => s.title === initialSection || s.section?.title === initialSection,
            ),
          ),
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [reload, initialSection]);
  const initialFieldId = p && target ? fieldId(p,target.group,target.label) : undefined;
  useEffect(() => {
    if (!accountVersion) return;
    const controller = new AbortController();
    apiRequest<Profile>("/profiles/me", {signal:controller.signal})
      .then(({account,completion}) => setP(old => old ? {...old,account,completion} : old))
      .catch(e => {if (!controller.signal.aborted) setError(e.message);});
    return () => controller.abort();
  }, [accountVersion]);
  useEffect(() => {
    if (!initialFieldId || focusField(initialFieldId)) return;
    const container = document.getElementById("profile-account");
    if (!container || !initialFieldId.startsWith("account-field-")) return;
    const observer = new MutationObserver(() => {if (focusField(initialFieldId)) observer.disconnect();});
    observer.observe(container,{childList:true,subtree:true});
    return () => observer.disconnect();
  }, [initialFieldId]);
  if (!p)
    return (
      <section className={styles.panel}>
        {error ? (
          <MuiButton type="submit" onClick={() => setReload((r) => r + 1)}>
            {error} - Retry
          </MuiButton>
        ) : (
          <LoadingRows label="Loading your profile" />
        )}
      </section>
    );
  const profile = p,
    sections = profileSteps(p.role),
    section = sections[index]?.section,
    values = { ...p.values, ...changes };
  const contactValues: Record<string, string | null> = {
    representative: p.account.fullName, contactName: p.account.fullName,
    contactEmail: p.account.email, contactPhone: p.account.phone, whatsapp: p.account.phone,
  };
  const missingContact = (section?.fields ?? []).filter(field => !values[field.key] && contactValues[field.key]);
  const completeSteps = new Set(sections.filter(step =>
    p.completion.completedSections.includes(step.title) &&
    !p.completion.incompleteSections.some(group => group.key === step.section?.title)
  ).map(step => step.title));
  function move(i: number) {
    if (i === index) return true;
    if (
      Object.keys(changes).length &&
      !window.confirm("Discard unsaved changes in this section?")
    )
      return;
    setChanges({});
    setErrors({});
    setError("");
    setIndex(i);
    return true;
  }
  function jump(group: string, label: string) {
    const step = sections.findIndex((item) => item.title === group || item.section?.title === group);
    if (step >= 0 && !move(step)) return;
    requestAnimationFrame(() => focusField(fieldId(profile,group,label)));
  }
  function change(key: string, value: unknown) {
    setChanges((old) => {
      const result = { ...old, [key]: value };
      const clear = (parent: string) =>
        (section?.fields ?? [])
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
    if (!section) return;
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
      <div className={styles.profileLayout}><div className={styles.profileMain}>
      <h2>
        {p.role === "BLUE_COLLAR_WORKER"
          ? "Skilled worker"
          : p.role === "WHITE_COLLAR_SEEKER"
            ? "Job seeker"
            : p.role[0] + p.role.slice(1).toLowerCase()}{" "}
        profile
      </h2>
      <p>
        {p.account.fullName}
        &middot; {p.verification.replaceAll("_", " ").toLowerCase()}
      </p>
      {p.history[0]?.reason && (
        <small>Latest update &middot; {p.history[0].reason}</small>
      )}
      <nav className={styles.steps} aria-label="Profile steps">
        {sections.map((s, i) => (
          <MuiButton
            type="button"
            disabled={busy}
            aria-current={i === index ? "step" : undefined}
            key={s.title}
            aria-label={`Step ${i + 1}: ${s.title}${completeSteps.has(s.title) ? ", complete" : ""}`}
            onClick={() => move(i)}
          >
            <span aria-hidden="true">{i === index || !completeSteps.has(s.title) ? i + 1 : "✓"}</span>
            {s.title}
          </MuiButton>
        ))}
      </nav>
      <div id="profile-account" hidden={index !== 0}>{account}</div>
      {section && <form
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
          {missingContact.length > 0 && <MuiButton type="button" onClick={() => {
            const contact = Object.fromEntries(missingContact.map(({key}) => [key, contactValues[key]]));
            setChanges(old => ({...old, ...contact}));
          }}>{missingContact.length === 1 && missingContact[0].key === "whatsapp"
            ? "Use my mobile number for WhatsApp" : "Use my account contact details"}</MuiButton>}
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
            <MuiButton
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
            </MuiButton>
          </p>
        )}
        <div className={styles.actions}>
          <MuiButton variant="contained" className={styles.primary} disabled={busy} type="submit">
            Save
          </MuiButton>
          {index < sections.length - 1 && (
            <MuiButton variant="contained" type="submit" value="continue" disabled={busy}>
              Save &amp; Continue
            </MuiButton>
          )}
        </div>
      </form>}
      {ready && (
        <MuiButton type="submit"
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
        </MuiButton>
      )}
      </div>
      <ProgressRail completion={p.completion} jump={jump} busy={busy}/></div>
    </section>
  );
}
