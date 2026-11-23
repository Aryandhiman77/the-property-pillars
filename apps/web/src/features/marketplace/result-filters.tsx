"use client";

import {useEffect, useState, type FormEvent} from "react";
import {AREA_UNITS, constructionStatuses, propertyTypeKey, propertyTypesByCategory} from "@the-property-pillar/contracts";
import {listingCurrencies} from "@/config/listing-geography";
import {propertyAmenityFields} from "@/config/property-amenities";
import {apiRequest} from "@/lib/api/client";
import {directoryFilterOptions, displayOption} from "@/features/home/search-scopes";
import type {DirectoryKey} from "@/config/marketplace";
import styles from "./directory.module.css";

export type ResultFilters = {kind: DirectoryKey; value: string; onChange: (value: string) => void};
type Scope = Parameters<typeof directoryFilterOptions>[0];
const basicFields = ["currency", "minPrice", "maxPrice", "minArea", "maxArea", "unit", "types", "bedrooms", "construction", "postedBy", "rera", "featured", "budget", "dealer", ...propertyAmenityFields.map(({key}) => key)];
const knownTypes = Object.values(propertyTypesByCategory).flatMap((items) => items.map(propertyTypeKey)).concat("OTHER");

export function AdvancedResultFilters(props: ResultFilters) {
  return <ResultFilterForm key={props.value + ":" + props.kind} {...props} />;
}

function ResultFilterForm({kind, value, onChange}: ResultFilters) {
  const [fields, setFields] = useState(() => new URLSearchParams(value));
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [allTypes, setAllTypes] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const property = kind === "properties";
  const budget = property || kind === "materials" || kind === "workers";
  const scope = kind === "professionals" && fields.get("scope") === "legal-vastu" ? "legal" : kind as Scope;
  const options = property ? [] : directoryFilterOptions(scope, facets).filter(({key}) => key !== "category");
  useEffect(() => {
    if (!property) return;
    const desktop = matchMedia("(min-width: 901px)");
    const sync = () => setExpanded(desktop.matches);
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, [property]);
  useEffect(() => {
    if (property) return;
    const controller = new AbortController();
    void apiRequest<Record<string, string[]>>("/public/" + kind + "/facets", {signal: controller.signal})
      .then((result) => {if (!controller.signal.aborted) setFacets(result);}, () => {});
    return () => controller.abort();
  }, [kind, property]);
  function set(key: string, value: string) {
    setFields((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      if (key === "currency" && value !== "INR") next.delete("budget");
      return next;
    });
    setError("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(fields);
    for (const kind of ["Price", "Area"]) {
      if (next.has("min" + kind) && next.has("max" + kind) && Number(next.get("min" + kind)) > Number(next.get("max" + kind))) {
        setError("Maximum " + kind.toLowerCase() + " must be at least the minimum."); return;
      }
    }
    if ((next.has("minPrice") || next.has("maxPrice")) && !next.has("currency")) {setError("Choose a currency for the price range."); return;}
    if ((next.has("minArea") || next.has("maxArea")) && !next.has("unit")) {setError("Choose an area unit."); return;}
    onChange(next.toString());
  }
  const select = (key: string, label: string, choices: readonly {value: string; label: string}[]) =>
    <label key={key}>{label}<select value={fields.get(key) ?? ""} onChange={(event) => set(key, event.target.value)}>
      <option value="">Any</option>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
    </select></label>;
  const choices = (items: readonly string[]) => items.map((value) => ({value, label: displayOption(value)}));
  const number = (key: string, label: string, max = 1e15) => <label>{label}<input type="number" min={0} max={max} step="any" value={fields.get(key) ?? ""}
    onChange={(event) => set(key, event.target.value)} /></label>;
  return <details className={styles.advanced} open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>{property ? "Property filters" : "Detailed filters"}</summary>
    <form onSubmit={submit}>
      {budget && <fieldset className={styles.filterSection}><legend>Budget</legend>
        {select("currency", "Currency", listingCurrencies)}
        <div className={styles.rangeFields}>{number("minPrice", "Minimum price")}{number("maxPrice", "Maximum price")}</div>
      </fieldset>}
      {property && <>
        <fieldset className={styles.filterSection}><legend>Property types</legend>{knownTypes.filter((type,index)=>allTypes || index<5 || (fields.get("types") ?? "").split(",").includes(type)).map((type) => <label className={styles.checkFilter} key={type}>
          <input type="checkbox" value={type} checked={(fields.get("types") ?? "").split(",").includes(type)} onChange={(event) => {
            const current = (fields.get("types") ?? "").split(",").filter(Boolean);
            set("types", (event.target.checked ? [...current, type] : current.filter((item) => item !== type)).join(","));
          }} /> {displayOption(type)}
        </label>)}
        <button className={styles.expandTypes} type="button" aria-expanded={allTypes} onClick={()=>setAllTypes(!allTypes)}>{allTypes ? "Show fewer types" : "Show all property types"}</button></fieldset>
        {select("bedrooms", "Bedrooms", choices(["0", "1", "2", "3", "4", "5+"]))}
        {select("construction", "Construction status", choices(constructionStatuses))}
        {propertyAmenityFields.map(({key, label, options}) => select(key, label, options))}
        {select("postedBy", "Listed by", [{value: "OWNER", label: "Property Owner"}, {value: "DEALER", label: "Property Dealer"}, {value: "BUILDER", label: "Builder"}])}
        {select("unit", "Area unit", AREA_UNITS.map((value) => ({value, label: value})))}
        {number("minArea", "Minimum area", 1e9)}{number("maxArea", "Maximum area", 1e9)}
        <label className={styles.checkFilter}><input type="checkbox" checked={fields.get("rera") === "1"} onChange={(event) => set("rera", event.target.checked ? "1" : "")} /> RERA number available</label>
        <label className={styles.checkFilter}><input type="checkbox" checked={fields.get("featured") === "1"} onChange={(event) => set("featured", event.target.checked ? "1" : "")} /> Featured properties only</label>
      </>}

      {options.map(({key, label, options}) => select(key, label, options))}
      {error && <p role="alert">{error}</p>}
      <div><button type="submit">Apply filters</button><button type="button" className={styles.closeAdvanced} onClick={() => setExpanded(false)}>Close filters</button>{value && <button type="button" onClick={() => {
        const next = new URLSearchParams(value);
        for (const key of [...basicFields, ...options.map(({key}) => key)]) next.delete(key);
        onChange(next.toString());
      }}>Clear detailed filters</button>}</div>
    </form>
  </details>;
}
