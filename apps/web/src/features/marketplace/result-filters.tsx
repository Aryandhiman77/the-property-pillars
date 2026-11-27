"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import {useEffect, useState, type FormEvent, type ReactNode} from "react";
import {propertyAmenities, AREA_UNITS, constructionStatuses, propertyTypeKey, propertyTypesByCategory} from "@the-property-pillar/contracts";
import {listingCurrencies} from "@/config/listing-geography";
import {propertyAmenityFields} from "@/config/property-amenities";
import {apiRequest} from "@/lib/api/client";
import {directoryFilterOptions, displayOption} from "@/features/home/search-scopes";
import type {DirectoryKey} from "@/config/marketplace";
import {PropertyFilterPanel, BudgetRange, SearchFacet} from "./property-filter-panel";
import css from "./listing-results.module.css";
import styles from "./directory.module.css";

export type ResultFilters = {kind: DirectoryKey; value: string; onChange: (value: string) => void; locationFilter?: ReactNode; clearAll?:()=>void; defaultCurrency?:string};
type Scope = Parameters<typeof directoryFilterOptions>[0];
const basicFields = ["amenity","verifiedSeller","possessionBy","floor","currency", "minPrice", "maxPrice", "minArea", "maxArea", "unit", "types", "bedrooms", "construction", "postedBy", "rera", "featured", "budget", "dealer", ...propertyAmenityFields.map(({key}) => key)];
const knownTypes = Object.values(propertyTypesByCategory).flatMap((items) => items.map(propertyTypeKey)).concat("OTHER");

export function AdvancedResultFilters(props: ResultFilters) {
  return <ResultFilterForm key={props.kind} {...props} />;
}

function FilterGroup({title, children, initialOpen = false}: {title:string;children:ReactNode;initialOpen?:boolean}) {
  return <details className={styles.filterGroup} open={initialOpen}><summary>{title}</summary><div>{children}</div></details>;
}

function ResultFilterForm({kind, value, onChange, locationFilter, clearAll, defaultCurrency = 'INR'}: ResultFilters) {
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
    const desktop = matchMedia("(min-width: 901px)");
    const sync = () => setExpanded(desktop.matches);
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);
  useEffect(() => {setFields(new URLSearchParams(value)); setError("");}, [value]);
  useEffect(() => {
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
  function toggleValue(key:string,value:string) {
    setFields(current=>{
      const next=new URLSearchParams(current);
      if(next.getAll(key).includes(value)) next.delete(key,value); else next.append(key,value);
      return next;
    });
  }
  function budgetPrice(key:string,value:string) {
    const next=new URLSearchParams(fields);
    if(value) next.set(key,value); else next.delete(key);
    if(!next.has("currency")) next.set("currency",defaultCurrency);
    setFields(next);setError("");
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
    if(property) event.currentTarget.closest('dialog')?.close();
  }
  const select = (key: string, label: string, choices: readonly {value: string; label: string}[]) =>
    <label key={key}>{label}<MaterialSelect value={fields.get(key) ?? ""} onChange={(event) => set(key, event.target.value)}>
      <option value="">Any</option>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
    </MaterialSelect></label>;
  const choices = (items: readonly string[]) => items.map((value) => ({value, label: displayOption(value)}));
  const number = (key: string, label: string, max = 1e15) => <label>{label}<MaterialInput type="number" min={0} max={max} step="any" value={fields.get(key) ?? ""}
    onChange={(event) => set(key, event.target.value)} /></label>;
  const groups = <>
      {!property && locationFilter && <FilterGroup title="Location" initialOpen>{locationFilter}</FilterGroup>}
      {budget && <FilterGroup title="Budget" initialOpen>
        {property ? <label>Currency<MaterialSelect value={fields.get("currency") || defaultCurrency} onChange={e=>set("currency",e.target.value)}>{listingCurrencies.map(option=><option key={option.value}>{option.value}</option>)}</MaterialSelect></label> : select("currency", "Currency", listingCurrencies)}
        {property ? <BudgetRange currency={fields.get("currency") || defaultCurrency} min={fields.get("minPrice") ?? ""} max={fields.get("maxPrice") ?? ""} change={budgetPrice}/> : <div className={styles.rangeFields}>{number("minPrice", "Minimum price")}{number("maxPrice", "Maximum price")}</div>}
      </FilterGroup>}
      {property && <>
        <FilterGroup title="Bedrooms" initialOpen><div className={css.beds}>{["0","1","2","3","4","5+"].map(n=><button key={n} type="button" aria-pressed={fields.getAll("bedrooms").includes(n)} onClick={()=>toggleValue("bedrooms",n)}>{n==="0"?"Studio":n+" BHK"}</button>)}</div></FilterGroup>
        {Object.entries({localityName:"Locality",projectName:"Project name",builderName:"Builder / Developer"}).map(([key,label])=><SearchFacet key={key} label={label} options={facets[key] ?? []} value={fields.getAll(key)} change={v=>toggleValue(key,v)}/>)}
        <FilterGroup title="Property type">{knownTypes.filter((type,index)=>allTypes || index<5 || (fields.get("types") ?? "").split(",").includes(type)).map((type) => <label className={styles.checkFilter} key={type}>
          <MaterialInput type="checkbox" value={type} checked={(fields.get("types") ?? "").split(",").includes(type)} onChange={(event) => {
            const current = (fields.get("types") ?? "").split(",").filter(Boolean);
            set("types", (event.target.checked ? [...current, type] : current.filter((item) => item !== type)).join(","));
          }} /> {displayOption(type)}
        </label>)}
        <MuiButton className={styles.expandTypes} type="button" aria-expanded={allTypes} onClick={()=>setAllTypes(!allTypes)}>{allTypes ? "Show fewer types" : "Show all property types"}</MuiButton></FilterGroup>
        <FilterGroup title="Possession & floor">
        {select("construction", "Construction status", choices(constructionStatuses))}
        {number("floor","Floor number",250)}<label>Possession by<MaterialInput type="date" value={fields.get("possessionBy")??""} onChange={e=>set("possessionBy",e.target.value)}/></label></FilterGroup>
        <FilterGroup title="Amenities">{propertyAmenityFields.map(({key, label, options}) => select(key, label, options))}
        <label>Included amenities<MaterialSelect aria-label="Amenities" multiple value={(fields.get("amenity")??"").split(",")} onChange={e=>set("amenity",Array.from(e.target.selectedOptions,o=>o.value).join(","))}>{Object.entries(propertyAmenities).map(([v,label])=><option key={v} value={v}>{label}</option>)}</MaterialSelect></label></FilterGroup>
        <FilterGroup title="More filters">{locationFilter}<label className={styles.checkFilter}><MaterialInput type="checkbox" checked={fields.get("verifiedSeller")==="1"} onChange={e=>set("verifiedSeller",e.target.checked?"1":"")}/> Verified seller</label>
        {select("postedBy", "Listed by", [{value: "OWNER", label: "Property Owner"}, {value: "DEALER", label: "Property Dealer"}, {value: "BUILDER", label: "Builder"}])}
        <label className={styles.checkFilter}><MaterialInput type="checkbox" checked={fields.get("rera") === "1"} onChange={(event) => set("rera", event.target.checked ? "1" : "")} /> RERA number available</label>
        <label className={styles.checkFilter}><MaterialInput type="checkbox" checked={fields.get("featured") === "1"} onChange={(event) => set("featured", event.target.checked ? "1" : "")} /> Featured properties only</label></FilterGroup>
        <FilterGroup title="Area">{select("unit", "Area unit", AREA_UNITS.map((value) => ({value, label: value})))}
        {number("minArea", "Minimum area", 1e9)}{number("maxArea", "Maximum area", 1e9)}</FilterGroup>
      </>}

      {options.map(({key,label,options},i) => <FilterGroup key={key} title={label} initialOpen={i === 0}>
        <div className={styles.facetOptions}>
          {[{value:"",label:"Any"}, ...options].map(option => <label key={option.value}>
            <input type="radio" name={key} checked={(fields.get(key) ?? "") === option.value} onChange={() => set(key,option.value)}/>{option.label}
          </label>)}
        </div>
      </FilterGroup>)}
      {error && <p role="alert">{error}</p>}
    </>;
  const form = <form onSubmit={submit}>{property ? <div className={css.filterScroll}>{groups}</div> : groups}
      <div className={styles.filterActions}><MuiButton variant="contained" type="submit">{property ? "Show properties" : "Apply filters"}</MuiButton>{!property && <MuiButton type="button" className={styles.closeAdvanced} onClick={() => setExpanded(false)}>Close filters</MuiButton>}{!property && value && <MuiButton type="button" onClick={() => {
        const next = new URLSearchParams(value);
        for (const key of [...basicFields, ...options.map(({key}) => key)]) next.delete(key);
        onChange(next.toString());
      }}>Clear detailed filters</MuiButton>}</div>
    </form>;
  if(property) return <PropertyFilterPanel count={new URLSearchParams(value).size} reset={()=>{setFields(new URLSearchParams());setError("");clearAll?.();}}>{form}</PropertyFilterPanel>;
  return <details className={styles.advanced} open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Filters</summary>{form}</details>;
}
