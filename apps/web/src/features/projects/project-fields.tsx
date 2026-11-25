"use client";
import { useId } from "react";
import { MasterSelect, type Option } from "@/features/profiles/controls";
import { PropertyEditor } from "@/features/dashboard/property-editor";
import { ImageUpload } from "@/features/dashboard/image-upload";
import type { MediaDrafts } from "@/features/dashboard/media-drafts";
import type { Field, Row, Values } from "./editor-fields";
import styles from "./projects.module.css";

export function ProjectFields({
  fields,
  values,
  change,
  errors,
  project,
  known,
  drafts,
}: {
  fields: Field[];
  values: Values;
  change: (k: string, v: unknown) => void;
  errors: Record<string, string>;
  project: Values;
  known: Option[];
  drafts: MediaDrafts;
}) {
  const prefix = useId();
  return (
    <div className={styles.formgrid}>
      {fields.map((f) => {
        const val = values[f.key],
          str = val == null ? "" : String(val),
          id = prefix + f.key;
        const err = errors[f.key],
          attr = {
            id,
            name: f.key,
            "aria-invalid": !!err,
            "aria-describedby": err ? id + "-error" : undefined,
            required: f.required,
          };
        const set = (v: unknown) => change(f.key, v);
        if (f.key === "bedrooms" || f.key === "balconies") {
          const cat = known.find((o) => o.id === values.categoryId);
          if (cat && cat.code !== "RESIDENTIAL") return null;
        }
        let input;
        if (f.master) {
          const parent = String(
            (f.parent && values[f.parent]) ||
              (f.key === "cityId" ? values.countryId : "") ||
              "",
          );
          input = (
            <MasterSelect
              kind={f.master}
              label={f.label}
              parent={parent || undefined}
              disabled={!!f.parent && !parent}
              value={val}
              selected={known}
              onChange={(v, o) => {
                set(v);
                if (o) change("_option", o);
              }}
            />
          );
        } else if (f.relation || f.options) {
          const opts =
            f.options?.map((v) => ({ id: v, name: v.replaceAll("_", " ") })) ??
            ((project[f.relation!] as Row[] | undefined) ?? [])
              .filter(
                (r) =>
                  r.active !== false &&
                  (!(f.key === "towerId" && values.phaseId) ||
                    r.phaseId === values.phaseId),
              )
              .map((v) => ({ id: v.id, name: String(v.name) }));
          input = (
            <select {...attr} value={str} onChange={(e) => set(e.target.value)}>
              <option value="">Choose an option</option>
              {opts.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          );
        } else if (f.kind === "boolean")
          input = (
            <select
              {...attr}
              value={val == null ? "" : String(val)}
              onChange={(e) =>
                set(
                  e.target.value === "" ? undefined : e.target.value === "true",
                )
              }
            >
              <option value="">Choose an option</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          );
        else if (f.kind === "rich")
          input = <PropertyEditor id={id} value={str} onChange={set} />;
        else if (f.kind === "textarea" || f.kind === "lines")
          input = (
            <textarea
              {...attr}
              rows={3}
              value={Array.isArray(val) ? val.join("\n") : str}
              onChange={(e) =>
                set(
                  f.kind === "lines"
                    ? e.target.value.split("\n")
                    : e.target.value,
                )
              }
            />
          );
        else if (f.kind?.startsWith("file-"))
          input = (
            <input
              {...attr}
              type="file"
              accept={
                f.kind === "file-image"
                  ? "image/jpeg,image/png,image/webp"
                  : "application/pdf"
              }
              onChange={(e) => set(e.target.files?.[0])}
            />
          );
        else if (["image", "images", "video"].includes(f.kind ?? "")) {
          const multi = f.kind === "images",
            video = f.kind === "video",
            external = video && /^https?:/.test(str);
          input = (
            <>
              {video && (
                <input
                  {...attr}
                  type="url"
                  placeholder="YouTube or Vimeo link"
                  value={external ? str : ""}
                  onChange={(e) => set(e.target.value)}
                />
              )}
              <ImageUpload
                label={f.label}
                value={
                  external ? "" : Array.isArray(val) ? val.join(", ") : str
                }
                drafts={drafts}
                purpose={
                  "builderProjects:" + (video ? "videoUrl" : "mediaUrls")
                }
                kind={video ? "video" : "image"}
                maxFiles={multi ? 20 : 1}
                onChange={(v) => set(multi ? (v ? v.split(", ") : []) : v)}
              />
            </>
          );
        } else if (f.kind === "milestones") {
          const rows = (val ?? []) as Values[];
          input = (
            <div>
              {rows.map((r, i) => (
                <fieldset key={i}>
                  <legend>Milestone {i + 1}</legend>
                  {["name", "amount", "trigger", "timing"].map((k) => (
                    <label key={k}>
                      {k}
                      <input
                        type={k === "amount" ? "number" : "text"}
                        step={k === "amount" ? "any" : undefined}
                        value={String(r[k] ?? "")}
                        onChange={(e) =>
                          set(
                            rows.map((v, j) =>
                              i === j
                                ? {
                                    ...v,
                                    [k]:
                                      k === "amount"
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => set(rows.filter((_, j) => i !== j))}
                  >
                    Remove milestone
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                onClick={() => set([...rows, { name: "", amount: 0 }])}
              >
                Add milestone
              </button>
            </div>
          );
        } else
          input = (
            <input
              {...attr}
              type={f.kind ?? "text"}
              value={str}
              step={f.kind === "number" ? "any" : undefined}
              onChange={(e) =>
                set(
                  f.kind === "number" && e.target.value !== ""
                    ? Number(e.target.value)
                    : e.target.value,
                )
              }
            />
          );
        return (
          <div key={f.key} className={styles.field}>
            <label htmlFor={id}>
              {f.label}
              {f.required ? " *" : ""}
            </label>
            {input}
            {err && (
              <small role="alert" id={id + "-error"}>
                {err}
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}
