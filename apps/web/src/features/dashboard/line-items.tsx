import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
import {Plus, Trash2} from "lucide-react";
import {materialCategories, materialOptionValue, materialUnits} from "@the-property-pillar/contracts";
import type {ComponentProps, ReactNode} from "react";
import styles from "./dashboard.module.css";

const fields = {
  itemName: "Item name",
  category: "Category",
  specification: "Specification",
  quantity: "Quantity",
  unit: "Unit",
  unitPrice: "Unit price",
  taxRate:"Item tax (%)",discount:"Item discount",preferredBrand:"Preferred brand",notes:"Item notes",
} as const;

type LineField = keyof typeof fields;
type LineItem = Record<LineField, string> & {key: string};

function freshLine(key: string): LineItem {
  return {key,taxRate:"",discount:"",preferredBrand:"",notes:"", itemName: "", category: "", specification: "", quantity: "", unit: "", unitPrice: ""};
}

export function readLines(value: unknown): LineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((value, index) => {
    const row = freshLine(String(index));
    if (!value || typeof value !== "object") return row;
    for (const field of Object.keys(fields) as LineField[]) {
      if (typeof value[field] === "string" || typeof value[field] === "number") row[field] = String(value[field]);
    }
    row.category = materialOptionValue(materialCategories, row.category) ?? row.category;
    row.unit = materialOptionValue(materialUnits, row.unit) ?? row.unit;
    return row;
  });
}

export function LineItems({quote, rows, onChange, fieldError, fieldProps}: {
  quote: boolean;
  rows: LineItem[];
  onChange: (lines: LineItem[]) => void;
  fieldError: (name: string) => ReactNode;
  fieldProps: (name: string) => Pick<ComponentProps<"input">, "name" | "aria-invalid" | "aria-describedby">;
}) {
  const visibleFields = (Object.keys(fields) as LineField[])
    .filter((field) => quote ? !["category","preferredBrand","notes"].includes(field) : !["unitPrice","taxRate","discount"].includes(field));
  return (
    <fieldset aria-describedby={fieldProps("items")["aria-describedby"]} aria-invalid={fieldProps("items")["aria-invalid"]} className={styles.wideField} tabIndex={-1}>
      <legend className="mb-2 text-sm font-semibold">{quote ? "Quoted materials" : "Materials needed"}</legend>
      <p className="mb-3 text-xs text-[var(--dashboard-muted)]">Add at least one material before submitting.</p>
      {rows.map((row, index) => (
        <div key={row.key} className="mb-3 grid gap-3 rounded-xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface-alt)] p-3 sm:grid-cols-2">
          {visibleFields.map((field) => {
            const numeric = ["quantity","unitPrice","taxRate","discount"].includes(field);
            const name = `items.${index}.${field}`;
            const options = field === "category" ? materialCategories : field === "unit" ? materialUnits : undefined;
            const inputProps = {...fieldProps(name), "aria-label": "Item " + (index + 1) + " " + fields[field].toLowerCase(),
              value: row[field], required: !["specification","taxRate","discount","preferredBrand","notes"].includes(field)};
            const update = (value: string) => onChange(rows.map((line) => line.key === row.key ? {...line, [field]: value} : line));
            return <label key={field} className={styles.field}><span>{fields[field]}</span>{options ? (
              <MaterialSelect {...inputProps} onChange={(event) => update(event.target.value)}>
                <option value="">Select {fields[field].toLowerCase()}</option>
                {row[field] && !options.some(({value}) => value === row[field]) && <option value={row[field]} disabled>{row[field]} (previously saved)</option>}
                {options.map(({value, label}) => <option key={value} value={value}>{label}</option>)}
              </MaterialSelect>
            ) : <MaterialInput
              {...inputProps}
              type={numeric ? "number" : "text"}
              min={field === "quantity" ? "0.0001" : numeric ? "0" : undefined}
              step={numeric ? "any" : undefined}
              onChange={(event) => update(event.target.value)}
            />}{fieldError(name)}</label>;
          })}
          <MuiButton className={styles.secondaryButton} type="button" onClick={() => onChange(rows.filter(({key}) => key !== row.key))}><Trash2 size={15} aria-hidden="true" /> Remove item {index + 1}</MuiButton>
        </div>
      ))}
      {fieldError("items")}
      <MuiButton className={styles.secondaryButton} type="button" disabled={rows.length >= 100} onClick={() => onChange([...rows, freshLine(crypto.randomUUID())])}><Plus size={16} aria-hidden="true" /> Add material</MuiButton>
    </fieldset>
  );
}
