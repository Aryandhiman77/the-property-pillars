"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import toast from "react-hot-toast";
import { apiRequest, ApiClientError } from "@/lib/api/client";
import {
  ChipListField,
  useChipList,
} from "@/features/dashboard/chip-list-field";
import { fieldAttributes } from "@/lib/form-validation";
import s from "./plan-admin.module.css";
const Editor = dynamic(() => import("./plan-editor"), {
  ssr: false,
  loading: () => <p>Loading editor…</p>,
});
const blank = {
  name: "",
  description: "",
  aboutHtml: "",
  highlights: [] as string[],
  audience: "LISTER",
  purpose: "PROPERTY_POSTS",
  basePaise: 49900,
  taxRateBps: 0,
  serviceCode: "998599",
  entitlementDays: 30,
  postingCredits: 5,
  active: false,
};
type Plan = typeof blank & { id?: string };
const purposes = {
  PROPERTY_POSTS: "Property posting credits",
  PROPERTY_FEATURE: "Featured property",
  PROFILE_FEATURE: "Featured profile",
};
const audiences = {
  LISTER: "Buyers and dealers",
  BUILDER: "Builders",
  PROFESSIONAL: "Professionals",
  WORKER: "Job seekers and skilled workers",
};

function EditPlan({
  plan,
  close,
  saved,
}: {
  plan: Plan;
  close: () => void;
  saved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const [form, set] = useState(plan);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const highlights = useChipList(plan.highlights, {
    item: "highlight",
    limit: 20,
    maxLength: 120,
  });
  function update<K extends keyof Plan>(key: K, value: Plan[K]) {
    set((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (highlights.pendingError) {
      setErrors({ highlights: highlights.pendingError });
      return;
    }
    const id = form.id;
    const fields = Object.fromEntries(
      Object.keys(blank).map((key) => [key, form[key as keyof typeof blank]]),
    );
    setBusy(true);
    setErrors({});
    try {
      await apiRequest("/admin/listing-plans" + (id ? "/" + id : ""), {
        method: id ? "PUT" : "POST",
        body: {
          ...fields,
          highlights: highlights.withPending,
          postingCredits:
            form.purpose === "PROPERTY_POSTS" ? form.postingCredits : 0,
        },
      });
      toast.success("Plan saved");
      saved();
    } catch (error) {
      const fields = error instanceof ApiClientError ? error.fieldErrors : {};
      setErrors(
        Object.keys(fields).length
          ? fields
          : {
              general:
                error instanceof Error ? error.message : "Could not save plan.",
            },
      );
    } finally {
      setBusy(false);
    }
  }
  function error(key: string) {
    return errors[key] && <small role="alert">{errors[key]}</small>;
  }
  return (
    <dialog
      className={s.editorDialog}
      ref={dialog}
      aria-labelledby="listing-plan-editor"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <form className={s.form} onSubmit={submit}>
        <h3 id="listing-plan-editor">
          {plan.id ? "Edit plan" : "Create plan"}
        </h3>
        <label>
          Plan name
          <input
            value={form.name}
            required
            minLength={2}
            maxLength={120}
            onChange={(e) => update("name", e.target.value)}
          />
          {error("name")}
        </label>
        <label>
          Available to
          <select
            value={form.audience}
            onChange={(e) => update("audience", e.target.value)}
          >
            {Object.entries(audiences).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {error("audience")}
        </label>
        <label>
          Plan benefit
          <select
            value={form.purpose}
            onChange={(e) => update("purpose", e.target.value)}
          >
            {Object.entries(purposes).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Validity after payment (days)
          <input
            type="number"
            min="1"
            max="3660"
            required
            value={form.entitlementDays || ""}
            onChange={(e) => update("entitlementDays", Number(e.target.value))}
          />
          {error("entitlementDays")}
        </label>
        {form.purpose === "PROPERTY_POSTS" && (
          <label>
            Property posting credits
            <input
              type="number"
              min="1"
              max="10000"
              required
              value={form.postingCredits || ""}
              onChange={(e) => update("postingCredits", Number(e.target.value))}
            />
            {error("postingCredits")}
          </label>
        )}
        <label>
          Base price (₹)
          <input
            type="number"
            min="1"
            max="10000000"
            step=".01"
            required
            defaultValue={form.basePaise / 100}
            onChange={(e) =>
              update("basePaise", Math.round(Number(e.target.value) * 100))
            }
          />
          {error("basePaise")}
        </label>
        <label>
          Tax rate (%)
          <input
            type="number"
            min="0"
            max="100"
            step=".01"
            required
            defaultValue={form.taxRateBps / 100}
            onChange={(e) =>
              update("taxRateBps", Math.round(Number(e.target.value) * 100))
            }
          />
          {error("taxRateBps")}
        </label>
        <label>
          Service accounting code
          <input
            value={form.serviceCode}
            pattern="[0-9]{4,8}"
            required
            onChange={(e) => update("serviceCode", e.target.value)}
          />
          {error("serviceCode")}
        </label>
        <label className={s.wide}>
          Short description
          <textarea
            value={form.description}
            required
            minLength={10}
            maxLength={500}
            onChange={(e) => update("description", e.target.value)}
          />
          {error("description")}
        </label>
        <ChipListField
          list={highlights}
          label="Key highlights"
          disabled={busy}
          className={s.wide}
          inputProps={fieldAttributes("plan", "highlights", errors.highlights)}
          error={error("highlights")}
          onError={(message) =>
            setErrors((prev) => ({ ...prev, highlights: message || "" }))
          }
        />
        <div className={s.wide}>
          <strong>About plan</strong>
          <Editor
            initial={plan.aboutHtml}
            onChange={(html) => update("aboutHtml", html)}
          />
          {error("aboutHtml")}
        </div>
        <label>
          Availability
          <select
            value={String(form.active)}
            onChange={(e) => update("active", e.target.value === "true")}
          >
            <option value="false">Draft</option>
            <option value="true">Available to purchase</option>
          </select>
        </label>
        {error("general")}
        <div className={s.actions}>
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button disabled={busy}>Save plan</button>
        </div>
      </form>
    </dialog>
  );
}
export function PlanAdmin() {
  const locale = useLocale();
  const [plans, setPlans] = useState<Plan[]>([]),
    [editing, edit] = useState<Plan | null>(null),
    [version, reload] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void apiRequest<Plan[]>("/admin/listing-plans", {
      signal: controller.signal,
    })
      .then(setPlans)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [version]);
  function saved() {
    edit(null);
    reload((v) => v + 1);
  }
  return (
    <section className={s.panel}>
      <header>
        <h2>Listing and profile plans</h2>
        <button onClick={() => edit({ ...blank })}>Create plan</button>
      </header>
      {error && (
        <p role="alert">
          {error} <button onClick={() => reload((v) => v + 1)}>Retry</button>
        </p>
      )}
      {editing ? (
        <EditPlan
          key={editing.id ?? "new"}
          plan={editing}
          close={() => edit(null)}
          saved={saved}
        />
      ) : (
        plans.map((p) => (
          <article key={p.id} className={s.row}>
            <div>
              <strong>{p.name}</strong>
              <p>
                {audiences[p.audience as keyof typeof audiences]} ·{" "}
                {p.entitlementDays} days · {p.active ? "Active" : "Draft"}
                {p.postingCredits ? " · " + p.postingCredits + " credits" : ""}
              </p>
            </div>
            <a href={`/${locale}/plans/${p.id}`}>Preview</a>
            <button onClick={() => edit(p)}>Edit</button>
            <button
              onClick={async () => {
                if (
                  !window.confirm(
                    "Remove " +
                      p.name +
                      " from the catalog? Existing purchases keep their benefits.",
                  )
                )
                  return;
                try {
                  await apiRequest("/admin/listing-plans/" + p.id, {
                    method: "DELETE",
                  });
                  toast.success("Plan removed");
                  saved();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not remove plan.",
                  );
                }
              }}
            >
              Delete
            </button>
          </article>
        ))
      )}
    </section>
  );
}
