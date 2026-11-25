"use client";

import {MaterialInput, MaterialSelect, MaterialTextarea} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ApiClientError, apiRequest } from "@/lib/api/client";
import { MapPinInput } from "@/features/marketplace/property-map";
import { AddressSearch } from "@/features/profiles/editor";
import type { Option } from "@/features/profiles/controls";
import { LoadingRows } from "@/components/ui/loading-skeleton";
import { useMediaDrafts } from "@/features/dashboard/media-drafts";
import { ProjectFields } from "./project-fields";
import {
  availability,
  baseFields,
  fromRecord,
  sections,
  steps,
  stepSection,
  type Row,
  type Values,
} from "./editor-fields";
import styles from "./projects.module.css";

const base = "/builder-projects";
type Detail = Row & {
  name: string;
  slug: string;
  revision: number;
  moderation: string;
  publication: string;
  step: number;
  completion: { percentage: number; missingSections: string[] };
  builder?: { brandName?: string; profile: { verification: string } };
  history: { id: string; action: string; metadata?: { reason?: string } }[];
};
type Page = { items: Row[]; total: number };
const empty: Page = { items: [], total: 0 };
const rows = (p: Values, k: string) => (p[k] as Row[] | undefined) ?? [];
function label(r: Row) {
  return String(
    r.title ??
      r.name ??
      r.number ??
      (r.master as Option | undefined)?.name ??
      r.caption ??
      r.classification ??
      r.category ??
      "Record",
  );
}
function clean(v: Values) {
  return Object.fromEntries(
    Object.entries(v)
      .filter(([, x]) => x !== "" && x != null)
      .map(([k, x]) => [
        k,
        k === "highlights" && Array.isArray(x)
          ? x
              .map(String)
              .map((s) => s.trim())
              .filter(Boolean)
          : x,
      ]),
  );
}
export function ProjectWorkbench({
  locale,
  admin = false,
  inventory = false,
  initialId,
}: {
  locale: string;
  admin?: boolean;
  inventory?: boolean;
  initialId?: string;
}) {
  const [id, select] = useState(initialId ?? ""),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [list, setList] = useState<Page>(),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [builder, setBuilder] = useState(""),
    [builderQuery, setBuilderQuery] = useState(""),
    [builders, setBuilders] = useState<Option[]>([]),
    [version, reload] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    if (id) return;
    setList(undefined);
    setError("");
    const timer = setTimeout(
      () =>
        apiRequest<Page>(
          base +
            "?" +
            new URLSearchParams({
              page: String(page),
              ...(search ? { search } : {}),
              ...(status ? { moderation: status } : {}),
            }),
          { signal: c.signal },
        )
          .then(setList)
          .catch((e) => {
            if (!c.signal.aborted) setError(e.message);
          }),
      180,
    );
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [page, search, status, id, version]);
  useEffect(() => {
    if (!admin || !creating) return;
    const c = new AbortController();
    apiRequest<{ items: Option[] }>(
      base + "/builders?q=" + encodeURIComponent(builderQuery),
      { signal: c.signal },
    )
      .then((r) => setBuilders(r.items))
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [admin, creating, builderQuery]);
  if (id)
    return (
      <ProjectEditor
        key={id}
        id={id}
        locale={locale}
        admin={admin}
        inventory={inventory}
        exit={() => {
          select("");
          reload((n) => n + 1);
        }}
      />
    );
  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <h2>
          {inventory
            ? "Unit inventory"
            : admin
              ? "Project review and management"
              : "Builder projects"}
        </h2>
        <MuiButton type="button" onClick={() => setCreating((v) => !v)}>
          Create project
        </MuiButton>
      </div>
      {creating && (
        <form
          className={styles.panel}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              const p = await apiRequest<Row>(base, {
                method: "POST",
                body: { name, ...(admin ? { builderUserId: builder } : {}) },
              });
              select(p.id);
              setCreating(false);
              setName("");
              toast.success("Project draft created");
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Could not create the project.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Project name
            <MaterialInput
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={160}
            />
          </label>
          {admin && (
            <>
              <label>
                Find Builder
                <MaterialInput
                  value={builderQuery}
                  onChange={(e) => setBuilderQuery(e.target.value)}
                />
              </label>
              <label>
                Responsible Builder
                <MaterialSelect
                  required
                  value={builder}
                  onChange={(e) => setBuilder(e.target.value)}
                >
                  <option value="">Choose Builder</option>
                  {builders.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </MaterialSelect>
              </label>
            </>
          )}
          <MuiButton variant="contained" type="submit" disabled={busy}>Create draft</MuiButton>
        </form>
      )}
      <div className={styles.filters}>
        <label>
          Search projects
          <MaterialInput
            type="search"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </label>
        <label>
          Moderation status
          <MaterialSelect
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            {[
              "DRAFT",
              "SUBMITTED",
              "UNDER_REVIEW",
              "CHANGES_REQUIRED",
              "APPROVED",
              "REJECTED",
              "SUSPENDED",
              "ARCHIVED",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </MaterialSelect>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {!list && !error ? (
        <LoadingRows label="Loading projects" />
      ) : (
        <div className={styles.grid}>
          {list?.items.map((r) => (
            <article key={r.id} className={styles.tile}>
              <small>
                {String(r.moderation)} · {String(r.publication)}
              </small>
              <h3>{label(r)}</h3>
              <p>
                {String(r.cityName ?? "")} ·{" "}
                {Number((r._count as Values).units)} tracked units
              </p>
              <MuiButton type="button" onClick={() => select(r.id)}>
                {inventory ? "Manage units" : "Open project"}
              </MuiButton>
            </article>
          ))}
        </div>
      )}
      {list?.total === 0 && <p>No projects match these filters.</p>}
      <div className={styles.actions}>
        {page > 1 && (
          <MuiButton type="submit" onClick={() => setPage((n) => n - 1)}>Previous page</MuiButton>
        )}
        {page * 20 < (list?.total ?? 0) && (
          <MuiButton type="submit" onClick={() => setPage((n) => n + 1)}>Next page</MuiButton>
        )}
      </div>
    </section>
  );
}

function ProjectEditor({
  id,
  locale,
  admin,
  inventory,
  exit,
}: {
  id: string;
  locale: string;
  admin: boolean;
  inventory: boolean;
  exit: () => void;
}) {
  const prefix = base + "/" + id,
    assetRoot = "/projects/" + id + "/assets",
    drafts = useMediaDrafts();
  const [p, project] = useState<Detail>(),
    [assets, setAssets] = useState<Values>({}),
    [step, setStep] = useState(1),
    [fields, setFields] = useState<Values>({}),
    [entity, setEntity] = useState<Values>({}),
    [editId, setEditId] = useState(""),
    [showEditor, editing] = useState(false),
    [known, setKnown] = useState<Option[]>([]),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [dirty, setDirty] = useState(false),
    [childDirty, setChildDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [verify, setVerify] = useState(false);
  const [units, setUnits] = useState<Page>(empty),
    [unitPage, setUnitPage] = useState(1),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [bulk, setBulk] = useState(1),
    [first, setFirst] = useState(1),
    [suffix, setSuffix] = useState("");
  const lock = useRef(false);
  const section = stepSection[step] ?? "",
    defs = sections[section] ?? [];
  const fetchProject = useCallback(
    () =>
      Promise.all([apiRequest<Detail>(prefix), apiRequest<Values>(assetRoot)]),
    [prefix, assetRoot],
  );
  function display(row: Detail, files: Values, s: number) {
    project(row);
    setAssets(files);
    setStep(s);
    setFields(fromRecord(baseFields[s] ?? [], row));
    setDirty(false);
    setChildDirty(false);
    setEditId("");
    editing(false);
    setEntity({});
    setErrors({});
  }
  useEffect(() => {
    let live = true;
    fetchProject()
      .then(([row, files]) => {
        if (live) display(row, files, inventory ? 8 : row.step);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [fetchProject, inventory]);
  useEffect(() => {
    if (!dirty && !childDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, childDirty]);
  useEffect(() => {
    if (step !== 8 || !p) return;
    const c = new AbortController();
    const qs = new URLSearchParams({
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      page: String(unitPage),
    });
    const timer = setTimeout(
      () =>
        apiRequest<Page>(prefix + "/units?" + qs, { signal: c.signal })
          .then(setUnits)
          .catch((e) => {
            if (!c.signal.aborted) setError(e.message);
          }),
      160,
    );
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [p, step, prefix, filters, unitPage]);
  function problem(e: unknown) {
    setError(e instanceof Error ? e.message : "The change could not be saved.");
    if (e instanceof ApiClientError) {
      const mapped = Object.fromEntries(
        Object.entries(e.fieldErrors).map(([k, v]) => [
          k.replace(/^fields\./, ""),
          v,
        ]),
      );
      setErrors(mapped);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    }
  }
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setErrors({});
    try {
      await fn();
    } catch (e) {
      problem(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const saved = (s = step) =>
    fetchProject().then(([row, files]) => display(row, files, s));
  function leave() {
    return !(dirty || childDirty) || window.confirm("Discard unsaved changes?");
  }
  function navigate(s: number) {
    if (!p || !leave()) return;
    drafts.reset();
    display(p, assets, s);
    setError("");
  }
  function change(key: string, v: unknown, child: boolean) {
    if (key === "_option") {
      const o = v as Option;
      setKnown((items) => [...items.filter((i) => i.id !== o.id), o]);
      return;
    }
    const changeValues = child ? setEntity : setFields;
    (child ? setChildDirty : setDirty)(true);
    changeValues((prev) => {
      const next = { ...prev, [key]: v };
      const chain = ["countryId", "stateId", "cityId", "localityId"];
      if (chain.includes(key))
        chain.slice(chain.indexOf(key) + 1).forEach((k) => delete next[k]);
      if (key === "categoryId") {
        delete next.typeId;
        delete next.bedrooms;
        delete next.balconies;
      }
      if (key === "phaseId") delete next.towerId;
      return next;
    });
  }
  function open(row?: Row, duplicate = false) {
    if (!leave()) return;
    setEditId(duplicate ? "" : (row?.id ?? ""));
    const v = fromRecord(defs, row);
    if (duplicate) {
      delete v.code;
      delete v.number;
    }
    setEntity(v);
    editing(true);
    setChildDirty(false);
    setBulk(1);
    setErrors({});
    setError("");
  }
  function valuesForBase() {
    const v = clean(fields);
    const prev = fromRecord(baseFields[step] ?? [], p);
    return Object.fromEntries(
      [...new Set([...Object.keys(prev), ...Object.keys(v)])]
        .filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(v[k]))
        .map((k) => [k, v[k] ?? null]),
    );
  }
  async function savePage(next: number) {
    if (!p) return;
    if (showEditor && childDirty)
      throw Error("Save the current record before continuing.");
    await apiRequest(prefix, {
      method: "PATCH",
      body: {
        revision: p.revision,
        fields: { ...valuesForBase(), step: next },
      },
    });
    await saved(next);
    toast.success("Project draft saved");
  }
  async function saveChild() {
    if (!p) return;
    let revision = p.revision;
    if (dirty) {
      const changed = await apiRequest<{ revision: number }>(prefix, {
        method: "PATCH",
        body: { revision, fields: valuesForBase() },
      });
      revision = changed.revision;
      project({ ...p, revision });
      setDirty(false);
    }
    const values = clean(entity);
    if (editId) {
      const previous = fromRecord(
        defs,
        records.find((row) => row.id === editId),
      );
      for (const key of Object.keys(previous)) {
        if (!(key in values)) values[key] = null;
      }
    }
    if (section === "plans" || section === "documents") {
      const form = new FormData();
      form.set("revision", String(revision));
      if (editId) form.set("id", editId);
      for (const k of ["file", "image", "pdf"]) {
        if (values[k] instanceof File) form.set(k, values[k] as File);
        delete values[k];
      }
      form.set("metadata", JSON.stringify(values));
      await apiRequest(assetRoot + "/" + section, {
        method: "POST",
        body: form,
      });
    } else if (section === "units") {
      const list =
        bulk === 1 || editId
          ? [values]
          : Array.from({ length: bulk }, (_, i) => ({
              ...values,
              number: suffix + String(first + i),
              code: suffix + String(first + i),
            }));
      await apiRequest(prefix + "/units", {
        method: "POST",
        body: { revision, id: editId || undefined, units: list },
      });
    } else
      await drafts.save(values, (resolved) =>
        apiRequest(prefix + "/sections/" + section, {
          method: "POST",
          body: { revision, id: editId || undefined, fields: resolved },
        }),
      );
    drafts.reset();
    await saved();
    toast.success("Project record saved");
  }
  async function remove(row: Row) {
    if (!p || !window.confirm("Remove " + label(row) + " from this project?"))
      return;
    const path =
      section === "plans" || section === "documents"
        ? assetRoot
        : prefix + "/sections";
    await apiRequest(
      path + "/" + section + "/" + row.id + "?revision=" + p.revision,
      { method: "DELETE" },
    );
    await saved();
    toast.success("Record removed");
  }
  if (!p)
    return error ? (
      <p role="alert">
        {error} <MuiButton type="submit" onClick={exit}>Back to projects</MuiButton>
      </p>
    ) : (
      <LoadingRows label="Loading project" />
    );
  const records =
    section === "units"
      ? units.items
      : section === "plans" || section === "documents"
        ? rows(assets, section)
        : rows(p, section === "payment-plans" ? "paymentPlans" : section);
  const options = [
    ...known,
    ...["country", "state", "city", "locality", "areaUnit"]
      .map((k) => p[k] as Option)
      .filter(Boolean),
    ...rows(p, "configurations").flatMap((c) =>
      ["category", "type", "areaUnit"]
        .map((k) => c[k] as Option)
        .filter(Boolean),
    ),
  ];
  async function transition(status: string) {
    await apiRequest(prefix + "/review", {
      method: "POST",
      body: {
        revision: p!.revision,
        status,
        reason: reason || undefined,
        ...(admin && verify ? { verifyRegistration: true } : {}),
      },
    });
    setReason("");
    setVerify(false);
    await saved();
    toast.success("Project status updated");
  }
  const actions: Record<string, string[]> = {
    DRAFT: ["PENDING_REVIEW", "ARCHIVED"],
    CHANGES_REQUIRED: ["PENDING_REVIEW", "ARCHIVED"],
    REJECTED: ["PENDING_REVIEW", "ARCHIVED"],
    SUBMITTED: admin
      ? ["UNDER_REVIEW", "CHANGES_REQUESTED", "REJECTED", "APPROVED"]
      : [],
    UNDER_REVIEW: admin
      ? ["CHANGES_REQUESTED", "REJECTED", "APPROVED", "PUBLISHED", "SUSPENDED"]
      : [],
    APPROVED:
      p.publication === "PUBLISHED"
        ? admin
          ? ["SUSPENDED", "ARCHIVED"]
          : ["ARCHIVED"]
        : admin
          ? ["PUBLISHED", "SUSPENDED"]
          : [],
    SUSPENDED: admin ? ["PENDING_REVIEW", "ARCHIVED"] : [],
  };
  const displayStatus: Record<string, string> = {
    UNDER_REVIEW: "Start review",
    PENDING_REVIEW: "Submit for review",
    CHANGES_REQUESTED: "Request changes",
    APPROVED: "Approve",
    PUBLISHED: "Publish",
    SUSPENDED: "Suspend",
    REJECTED: "Reject",
    ARCHIVED: "Archive",
  };
  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <MuiButton
          type="button"
          onClick={() => {
            if (leave()) exit();
          }}
        >
          Back to projects
        </MuiButton>
        {p.publication === "PUBLISHED" && (
          <Link href={"/" + locale + "/projects/" + p.slug}>
            View public project
          </Link>
        )}
      </div>
      <h2>{p.name}</h2>
      <p>
        {p.moderation} · {p.publication} · Builder verification{" "}
        {p.builder?.profile.verification ?? "Unknown"}
      </p>
      <label>
        Project profile completion{" "}
        <progress max="100" value={p.completion.percentage} />{" "}
        {p.completion.percentage}%
      </label>
      <div className={styles.panel}>
        <label>
          Project step
          <MaterialSelect
            aria-label="Project step"
            value={step}
            disabled={busy}
            onChange={(e) => navigate(Number(e.target.value))}
          >
            {steps.map((title, i) => (
              <option value={i + 1} key={title}>
                {i + 1}. {title}
              </option>
            ))}
          </MaterialSelect>
        </label>
        <h2>{steps[step - 1]}</h2>
        {step === 2 && (
          <AddressSearch
            onSelect={(d) => {
              setKnown((o) => [...o, ...d.items]);
              setFields((prev) => ({
                ...prev,
                ...Object.fromEntries(
                  ["countryId", "stateId", "cityId", "localityId"].map((k) => [
                    k,
                    undefined,
                  ]),
                ),
                ...Object.fromEntries(
                  d.items
                    .filter((i) => i.kind)
                    .map((i) => [i.kind!.toLowerCase() + "Id", i.id]),
                ),
                address: d.address,
                latitude: d.latitude,
                longitude: d.longitude,
              }));
              setDirty(true);
            }}
          />
        )}
        {baseFields[step] && (
          <ProjectFields
            fields={baseFields[step].filter(
              (f) => step !== 2 || !["latitude", "longitude"].includes(f.key),
            )}
            values={fields}
            change={(k, v) => change(k, v, false)}
            project={p}
            known={options}
            errors={errors}
            drafts={drafts}
          />
        )}
        {step === 2 && (
          <MapPinInput
            key={[fields.latitude, fields.longitude].join(",")}
            value={
              typeof fields.latitude === "number" &&
              typeof fields.longitude === "number"
                ? { latitude: fields.latitude, longitude: fields.longitude }
                : null
            }
            onChange={(pin) => {
              setFields((v) => ({
                ...v,
                latitude: pin?.latitude,
                longitude: pin?.longitude,
              }));
              setDirty(true);
            }}
          />
        )}
        {section && (
          <>
            <div className={styles.heading}>
              {section === "payment-plans" && <h3>Payment schedules</h3>}
              <MuiButton type="button" disabled={busy} onClick={() => open()}>
                Add{" "}
                {section === "units"
                  ? "unit"
                  : section === "phases"
                    ? "phase"
                    : section === "towers"
                      ? "tower"
                      : section === "configurations"
                        ? "configuration"
                        : "record"}
              </MuiButton>
            </div>
            {section === "units" && (
              <>
                <div className={styles.filters}>
                  {[
                    "search",
                    "phaseId",
                    "towerId",
                    "configurationId",
                    "availability",
                    "floor",
                    "minPrice",
                    "maxPrice",
                    "currency",
                  ].map((k) => {
                    const choices =
                      k === "availability"
                        ? availability.map((v) => ({ id: v, name: v }))
                        : ["phaseId", "towerId", "configurationId"].includes(k)
                          ? rows(
                              p,
                              (
                                {
                                  phaseId: "phases",
                                  towerId: "towers",
                                  configurationId: "configurations",
                                } as Record<string, string>
                              )[k],
                            )
                          : undefined;
                    const update = (v: string) => {
                      setUnitPage(1);
                      setFilters((f) => ({ ...f, [k]: v }));
                    };
                    return (
                      <label key={k}>
                        {(
                          {
                            search: "Unit number or code",
                            phaseId: "Phase filter",
                            towerId: "Tower filter",
                            configurationId: "Configuration filter",
                            minPrice: "Minimum price",
                            maxPrice: "Maximum price",
                          } as Record<string, string>
                        )[k] ?? k}
                        {choices ? (
                          <MaterialSelect
                            value={filters[k] ?? ""}
                            onChange={(e) => update(e.target.value)}
                          >
                            <option value="">All</option>
                            {choices.map((o) => (
                              <option value={o.id} key={o.id}>
                                {String(o.name)}
                              </option>
                            ))}
                          </MaterialSelect>
                        ) : (
                          <MaterialInput
                            value={filters[k] ?? ""}
                            onChange={(e) => update(e.target.value)}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
                {rows(p, "inventory").length > 0 && (
                  <details>
                    <summary>Inventory by tower and configuration</summary>
                    <ul>
                      {rows(p, "inventory").map((r) => (
                        <li
                          key={[
                            r.configurationId,
                            r.towerId,
                            r.availability,
                          ].join("-")}
                        >
                          {[
                            rows(p, "towers").find((v) => v.id === r.towerId)
                              ?.name,
                            rows(p, "configurations").find(
                              (v) => v.id === r.configurationId,
                            )?.name,
                            String(r.availability).replaceAll("_", " "),
                            r._count,
                          ]
                            .filter((x) => x != null)
                            .join(" · ")}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <p>{units.total} matching units</p>
              </>
            )}
            {records.map((row) => (
              <article className={styles.record} key={row.id}>
                <div>
                  <strong>{label(row)}</strong>
                  <small>
                    {[
                      row.availability,
                      row.code,
                      (row.tower as Row | undefined)?.name,
                      (row.configuration as Row | undefined)?.name,
                      row.floor != null && "Floor " + row.floor,
                      row.area != null &&
                        [
                          row.area,
                          (row.areaUnit as Row | undefined)?.code,
                        ].join(" "),
                      row.classification,
                      row.planType,
                      row.date,
                      row.price != null && [row.price, row.currency].join(" "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  {typeof row.image === "string" && (
                    <a href={row.image} target="_blank" rel="noreferrer">
                      Open image{" "}
                    </a>
                  )}
                  {typeof row.pdf === "string" && (
                    <a href={row.pdf}>Download PDF </a>
                  )}
                  {section === "documents" && (
                    <a href={String(row.url)}>Inspect file</a>
                  )}
                </div>
                <div className={styles.actions}>
                  <MuiButton type="submit" onClick={() => open(row)}>Edit</MuiButton>
                  {section === "units" ? (
                    <>
                      <MuiButton type="submit" onClick={() => open(row, true)}>Duplicate</MuiButton>
                      {row.listing ? (
                        <Link
                          href={
                            "/" +
                            locale +
                            ((row.listing as Row).moderationState === "DRAFT"
                              ? "/post-property?draft="
                              : "/dashboard?view=properties&property=") +
                            (row.listing as Row).id
                          }
                        >
                          {(row.listing as Row).moderationState === "DRAFT"
                            ? "Open property draft"
                            : "Manage property listing"}
                        </Link>
                      ) : (
                        row.active !== false &&
                        row.availability === "AVAILABLE" && (
                          <MuiButton type="submit"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await apiRequest(
                                  prefix + "/units/" + row.id + "/listing",
                                  {
                                    method: "POST",
                                    body: { revision: p.revision },
                                  },
                                );
                                await saved();
                                toast.success("Linked property draft created");
                              })
                            }
                          >
                            Create property listing
                          </MuiButton>
                        )
                      )}
                    </>
                  ) : (
                    <MuiButton type="submit"
                      disabled={busy}
                      onClick={() => run(() => remove(row))}
                    >
                      Remove
                    </MuiButton>
                  )}
                </div>
              </article>
            ))}
            {section === "units" && (
              <div className={styles.actions}>
                {unitPage > 1 && (
                  <MuiButton type="submit" onClick={() => setUnitPage((n) => n - 1)}>
                    Previous units
                  </MuiButton>
                )}
                {unitPage * 30 < units.total && (
                  <MuiButton type="submit" onClick={() => setUnitPage((n) => n + 1)}>
                    Next units
                  </MuiButton>
                )}
              </div>
            )}
            {showEditor && (
              <form
                className={styles.tile}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(saveChild);
                }}
              >
                <h3>{editId ? "Edit record" : "New record"}</h3>
                {section === "units" && !editId && (
                  <div className={styles.filters}>
                    <label>
                      Number of units
                      <MaterialInput
                        type="number"
                        min={1}
                        max={100}
                        value={bulk}
                        onChange={(e) =>
                          setBulk(
                            Math.max(1, Math.min(100, Number(e.target.value))),
                          )
                        }
                      />
                    </label>
                    {bulk > 1 && (
                      <>
                        <label>
                          Number prefix
                          <MaterialInput
                            value={suffix}
                            onChange={(e) => setSuffix(e.target.value)}
                          />
                        </label>
                        <label>
                          First number
                          <MaterialInput
                            type="number"
                            min={0}
                            value={first}
                            onChange={(e) => setFirst(Number(e.target.value))}
                          />
                        </label>
                        <p>
                          Preview {suffix + first} –{" "}
                          {suffix + (first + bulk - 1)}
                        </p>
                      </>
                    )}
                  </div>
                )}
                <ProjectFields
                  fields={defs.filter(
                    (f) =>
                      !(
                        section === "units" &&
                        bulk > 1 &&
                        ["code", "number"].includes(f.key)
                      ),
                  )}
                  values={entity}
                  change={(k, v) => change(k, v, true)}
                  errors={errors}
                  project={p}
                  known={options}
                  drafts={drafts}
                />
                <div className={styles.actions}>
                  <MuiButton variant="contained" type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save record"}
                  </MuiButton>
                  <MuiButton
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (leave()) {
                        editing(false);
                        setChildDirty(false);
                        drafts.reset();
                      }
                    }}
                  >
                    Cancel
                  </MuiButton>
                </div>
              </form>
            )}
          </>
        )}
        {step >= 19 && (
          <>
            <h3>Project summary</h3>
            <dl className={styles.facts}>
              {Object.entries({
                Builder: p.builder?.brandName,
                Type: p.projectType,
                City: p.cityName,
                "Construction stage": p.constructionStatus,
                "Starting price": p.startingPrice,
                Phases: rows(p, "phases").length,
                Towers: rows(p, "towers").length,
                Configurations: rows(p, "configurations").length,
                Units: rows(p, "inventory").reduce(
                  (s, r) => s + Number(r._count),
                  0,
                ),
                Plans: rows(assets, "plans").length,
                Documents: rows(assets, "documents").length,
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v ?? "—")}</dd>
                </div>
              ))}
            </dl>
            {p.completion.missingSections.length > 0 && (
              <p>
                Required before submission ·{" "}
                {p.completion.missingSections.join(", ")}
              </p>
            )}
            {step === 20 && (
              <>
                {admin && (
                  <>
                    <label>
                      Review reason
                      <MaterialTextarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    {p.regulatoryApplicable === true && (
                      <label>
                        <MaterialInput
                          type="checkbox"
                          checked={verify}
                          onChange={(e) => setVerify(e.target.checked)}
                        />
                        Registration evidence reviewed
                      </label>
                    )}
                  </>
                )}
                <div className={styles.actions}>
                  {actions[p.moderation]?.map((s) => (
                    <MuiButton type="submit"
                      key={s}
                      disabled={busy}
                      onClick={() => run(() => transition(s))}
                    >
                      {displayStatus[s]}
                    </MuiButton>
                  ))}
                </div>
                <h3>Review history</h3>
                {p.history.map((h) => (
                  <p key={h.id}>
                    {h.action.replaceAll("_", " ")} {h.metadata?.reason}
                  </p>
                ))}
              </>
            )}
          </>
        )}
        {error && (
          <div role="alert">
            {error}
            {Object.keys(errors).length > 0 && (
              <ul>
                {Object.entries(errors).map(([k, v]) => (
                  <li key={k}>
                    {k} · {v}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {drafts.progress && (
          <p role="status">
            {drafts.progress.phase}{" "}
            <progress max={100} value={drafts.progress.percent} />{" "}
            {drafts.progress.percent}%
          </p>
        )}
        <div className={styles.actions}>
          {step > 1 && (
            <MuiButton type="submit" disabled={busy} onClick={() => navigate(step - 1)}>
              Previous
            </MuiButton>
          )}
          <MuiButton type="submit" disabled={busy} onClick={() => run(() => savePage(step))}>
            Save draft
          </MuiButton>
          {step < 20 && (
            <MuiButton type="submit"
              disabled={busy}
              onClick={() => run(() => savePage(step + 1))}
            >
              Save and continue
            </MuiButton>
          )}
        </div>
      </div>
    </section>
  );
}
