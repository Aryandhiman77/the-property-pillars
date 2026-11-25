"use client";
import { useId, useState } from "react";
import { MasterSelect } from "./master-select";
export { MasterSelect } from "./master-select";
import {
  type MasterKind,
  type ProfileField,
  listingCurrencyCodes,
  siteLocales,
} from "@the-property-pillar/contracts";
import { PhoneInput } from "@/components/ui/phone-input";
import styles from "./profiles.module.css";

export type Option = {
  id: string;
  name: string;
  active?: boolean;
  parentId?: string | null;
  parent?: { name: string } | null;
  kind?: MasterKind;
  code?: string;
  sortOrder?: number;
};
export type ProfileAsset = {
  id: string;
  field: string;
  originalName: string;
  category: string;
  visibility: string;
};
export type Values = Record<string, unknown>;
export type Completion = {
  percentage: number;
  completedSections: string[];
  incompleteSections: { key: string; missing: string[] }[];
  nextRecommendedActions: string[];
};
export type Profile = {
  id: string;
  role: import("@the-property-pillar/contracts").ProfileRole;
  revision: number;
  verification: string;
  values: Values;
  completion: Completion;
  selected: Option[];
  files: ProfileAsset[];
  account: { fullName: string; email: string | null; phone: string | null };
  history: {
    id: string;
    toState: string;
    reason: string | null;
    createdAt: string;
  }[];
};
const languageName = new Intl.DisplayNames(["en"], { type: "language" });
type FieldProps = {
  field: ProfileField;
  values: Values;
  profile: Profile;
  name?: string;
  error?: string;
  change: (key: string, v: unknown) => void;
  upload: (path: string, file: File) => Promise<Profile>;
};
export function ProfileInput({
  field: f,
  values,
  profile,
  name = f.key,
  error,
  change,
  upload,
}: FieldProps) {
  const id = useId(),
    v = values[f.key],
    set = (value: unknown) => change(f.key, value);
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  const attr = {
    id,
    "aria-label": f.label,
    "aria-invalid": !!error,
    "aria-describedby": error ? id + "-error" : undefined,
  };
  let input;
  if (f.master)
    input = (
      <MasterSelect
        id={id}
        errorId={error ? id + "-error" : undefined}
        kind={f.master}
        label={f.label}
        parent={f.parent ? String(values[f.parent] ?? "") : undefined}
        disabled={!!f.parent && !String(values[f.parent] ?? "")}
        multiple={f.kind === "masters"}
        value={v}
        selected={profile.selected}
        onChange={set}
      />
    );
  else if (f.kind === "rows") {
    const rows = Array.isArray(v) ? (v as Values[]) : [];
    input = (
      <div>
        {rows.map((row, i) => (
          <fieldset key={i} className={styles.fields}>
            <legend>
              {f.label} {i + 1}
            </legend>
            {f.fields!.map((sub) => (
              <ProfileInput
                key={sub.key}
                field={sub}
                values={row}
                profile={profile}
                name={f.key + "." + sub.key}
                upload={upload}
                change={(k, n) =>
                  set(rows.map((r, j) => (j === i ? { ...r, [k]: n } : r)))
                }
              />
            ))}
            <button
              type="button"
              onClick={() => set(rows.filter((_, j) => j !== i))}
            >
              Remove entry
            </button>
          </fieldset>
        ))}
        <button type="button" onClick={() => set([...rows, {}])}>
          Add entry
        </button>
      </div>
    );
  } else if (f.kind === "file") {
    const files = profile.files.filter((a) => a.field === name);
    input = (
      <div className={styles.upload}>
        {name.includes(".") && (
          <select
            {...attr}
            value={String(v ?? "")}
            onChange={(e) => set(e.target.value || null)}
          >
            <option value="">Choose a saved document</option>
            {files.map((a) => (
              <option value={a.id} key={a.id}>
                {a.originalName}
              </option>
            ))}
          </select>
        )}
        {f.use === "PORTFOLIO" &&
          files.map((a) => (
            <a
              key={a.id}
              href={"/api/v1/profiles/files/" + a.id}
              target="_blank"
              rel="noreferrer"
            >
              {a.originalName}
            </a>
          ))}
        {f.use !== "PORTFOLIO" && files[0] && (
          <a
            href={
              "/api/v1/profiles/files/" +
              (name.includes(".") && v ? v : files[0].id)
            }
            target="_blank"
            rel="noreferrer"
          >
            Open saved file
          </a>
        )}
        <input
          {...attr}
          id={name.includes(".") ? id + "-file" : id}
          type="file"
          accept={
            f.use === "RESUME"
              ? ".pdf,.doc,.docx"
              : f.use === "DOCUMENT"
                ? ".pdf,.jpg,.jpeg,.png,.webp"
                : ".jpg,.jpeg,.png,.webp"
          }
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setFailure("");
          }}
        />
        {file && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const p = await upload(name, file);
                if (name.includes("."))
                  set(p.files.find((a) => a.field === name)?.id);
                setFile(null);
              } catch (e) {
                setFailure(e instanceof Error ? e.message : "Upload failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving file..." : "Save file"}
          </button>
        )}
        {failure && <small role="alert">{failure}</small>}
      </div>
    );
  } else if (
    ["select", "many", "currency", "language", "languages", "boolean"].includes(
      f.kind,
    )
  ) {
    const options =
      f.kind === "currency"
        ? listingCurrencyCodes
        : f.kind.includes("language")
          ? siteLocales
          : f.kind === "boolean"
            ? ["Yes", "No"]
            : f.options!;
    const choiceLabel = (o: string) =>
      f.kind.includes("language") ? (languageName.of(o) ?? o) : o;
    const multi = f.kind === "many" || f.kind === "languages";
    const ids = Array.isArray(v) ? v.map(String) : [];
    input = multi ? (
      <div className={styles.chips}>
        {options.map((o) => (
          <button
            type="button"
            aria-pressed={ids.includes(o)}
            key={o}
            onClick={() =>
              set(ids.includes(o) ? ids.filter((i) => i !== o) : [...ids, o])
            }
          >
            {choiceLabel(o)}
          </button>
        ))}
      </div>
    ) : (
      <select
        {...attr}
        value={
          f.kind === "boolean"
            ? v === true
              ? "Yes"
              : v === false
                ? "No"
                : ""
            : String(v ?? "")
        }
        onChange={(e) =>
          set(
            !e.target.value
              ? null
              : f.kind === "boolean"
                ? e.target.value === "Yes"
                : e.target.value,
          )
        }
      >
        <option value="">Select an option</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {choiceLabel(o)}
          </option>
        ))}
      </select>
    );
  } else if (f.kind === "phone")
    input = (
      <PhoneInput
        {...attr}
        name={name}
        value={String(v ?? "")}
        onChange={set}
      />
    );
  else if (f.kind === "long")
    input = (
      <textarea
        {...attr}
        maxLength={5000}
        value={String(v ?? "")}
        onChange={(e) => set(e.target.value)}
      />
    );
  else {
    const numeric = [
      "integer",
      "number",
      "years",
      "months",
      "year",
      "latitude",
      "longitude",
    ].includes(f.kind);
    input = (
      <input
        {...attr}
        type={
          numeric
            ? "number"
            : ["date", "email", "url"].includes(f.kind)
              ? f.kind
              : "text"
        }
        min={
          numeric
            ? f.kind === "latitude"
              ? -90
              : f.kind === "longitude"
                ? -180
                : f.kind === "year"
                  ? 1800
                  : 0
            : undefined
        }
        max={
          f.kind === "latitude"
            ? 90
            : f.kind === "longitude"
              ? 180
              : f.kind === "months"
                ? 11
                : f.kind === "years"
                  ? 100
                  : f.kind === "year"
                    ? new Date().getFullYear()
                    : undefined
        }
        step={
          numeric
            ? ["integer", "years", "year", "months"].includes(f.kind)
              ? 1
              : "any"
            : undefined
        }
        value={String(v ?? "")}
        onChange={(e) =>
          set(
            e.target.value === ""
              ? null
              : numeric
                ? Number(e.target.value)
                : e.target.value,
          )
        }
      />
    );
  }
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {f.label}
        {f.required ? " *" : ""}
      </label>
      {input}
      {error && (
        <small id={id + "-error"} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
