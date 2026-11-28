"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import {useEffect, useState, type FormEvent, type ReactNode} from "react";
import {propertyAmenities, propertyTypeKey} from "@the-property-pillar/contracts";
import {listingCurrencies} from "@/config/listing-geography";
import {propertyAmenityFields} from "@/config/property-amenities";
import {apiRequest} from "@/lib/api/client";
import {directoryFilterOptions, displayOption} from "@/features/home/search-scopes";
import type {DirectoryKey} from "@/config/marketplace";
import {PropertyFilterPanel, BudgetRange, SearchFacet} from "./property-filter-panel";
import css from "./listing-results.module.css";
import styles from "./directory.module.css";

export type ResultFilters = {kind: DirectoryKey; value: string; facetQuery?:string; onChange: (value: string) => void; locationFilter?: (facets:Record<string,string[]>) => ReactNode; clearAll?:()=>void; defaultCurrency?:string};
type Scope = Parameters<typeof directoryFilterOptions>[0];


export function AdvancedResultFilters(props: ResultFilters) {
  return <ResultFilterForm key={props.kind} {...props} />;
}

function FilterGroup({title, children, initialOpen = false}: {title:string;children:ReactNode;initialOpen?:boolean}) {
  const [opened, setOpened] = useState(initialOpen);
  return <details className={styles.filterGroup} open={initialOpen} onToggle={event => {
    if (event.currentTarget.open) setOpened(true);
  }}><summary>{title}</summary>{opened && <div>{children}</div>}</details>;
}

function ResultFilterForm({kind, value, facetQuery = "", onChange, locationFilter, clearAll, defaultCurrency = 'INR'}: ResultFilters) {
  const [fields, setFields] = useState(() => new URLSearchParams(value));
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [allTypes, setAllTypes] = useState(false);
  const knownTypes = [...new Set([...(facets.propertyType ?? []).map(propertyTypeKey), ...(fields.get("types") ?? "").split(",").filter(Boolean)])];
  const beds = [...new Set([...(facets.bedrooms ?? []).map(n => Number(n) >= 5 ? "5+" : n), ...fields.getAll("bedrooms")])].sort();
  const property = kind === "properties";
  const budget = property || kind === "materials" || kind === "workers";
  const scope = kind === "professionals" && fields.get("scope") === "legal-vastu" ? "legal" : kind as Scope;
  const options = property ? [] : directoryFilterOptions(scope, facets).filter(({key}) => key !== "category");
  useEffect(() => {setFields(new URLSearchParams(value)); setError("");}, [value]);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Record<string, string[]>>("/public/" + kind + "/facets?" + facetQuery, {signal: controller.signal})
      .then((result) => {if (!controller.signal.aborted) setFacets(result);}, () => {});
    return () => controller.abort();
  }, [kind, facetQuery]);
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
    event.currentTarget.closest('dialog')?.close();
  }
  const select = (key: string, label: string, choices: readonly {value: string; label: string}[]) =>
    <label key={key}>{label}<MaterialSelect value={fields.get(key) ?? ""} onChange={(event) => set(key, event.target.value)}>
      <option value="">Any</option>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
    </MaterialSelect></label>;
  const choices = (items: readonly string[]) => items.map((value) => ({value, label: displayOption(value)}));
  const number = (key: string, label: string, max = 1e15) => <label>{label}<MaterialInput type="number" min={0} max={max} step="any" value={fields.get(key) ?? ""}
    onChange={(event) => set(key, event.target.value)} /></label>;
  const groups = <>
      {!property && locationFilter && <FilterGroup title="Location" initialOpen>{locationFilter?.(facets)}</FilterGroup>}
      {budget && <FilterGroup title="Budget" initialOpen>
        {property ? <label>Currency<MaterialSelect value={fields.get("currency") || defaultCurrency} onChange={e=>set("currency",e.target.value)}>{listingCurrencies.map(option=><option key={option.value}>{option.value}</option>)}</MaterialSelect></label> : select("currency", "Currency", listingCurrencies)}
        {property ? <BudgetRange currency={fields.get("currency") || defaultCurrency} min={fields.get("minPrice") ?? ""} max={fields.get("maxPrice") ?? ""} change={budgetPrice}/> : <div className={styles.rangeFields}>{number("minPrice", "Minimum price")}{number("maxPrice", "Maximum price")}</div>}
      </FilterGroup>}
      {property && <>
        <FilterGroup title="Bedrooms" initialOpen><div className={css.beds}>{beds.map(n=><button key={n} type="button" aria-pressed={fields.getAll("bedrooms").includes(n)} onClick={()=>toggleValue("bedrooms",n)}>{n==="0"?"Studio":n+" BHK"}</button>)}</div></FilterGroup>
        {Object.entries({localityName:"Locality",projectName:"Project name",builderName:"Builder / Developer"}).map(([key,label])=><SearchFacet key={key} label={label} options={facets[key] ?? []} value={fields.getAll(key)} change={v=>toggleValue(key,v)}/>)}
        <FilterGroup title="Property type">{knownTypes.filter((type,index)=>allTypes || index<5 || (fields.get("types") ?? "").split(",").includes(type)).map((type) => <label className={styles.checkFilter} key={type}>
          <MaterialInput type="checkbox" value={type} checked={(fields.get("types") ?? "").split(",").includes(type)} onChange={(event) => {
            const current = (fields.get("types") ?? "").split(",").filter(Boolean);
            set("types", (event.target.checked ? [...current, type] : current.filter((item) => item !== type)).join(","));
          }} /> {displayOption(type)}
        </label>)}
        {knownTypes.length > 5 && <MuiButton className={styles.expandTypes} type="button" aria-expanded={allTypes} onClick={()=>setAllTypes(!allTypes)}>{allTypes ? "Show fewer types" : "Show all property types"}</MuiButton>}</FilterGroup>
        <FilterGroup title="Possession & floor">
        {select("construction", "Construction status", choices(facets.construction ?? []))}
        {number("floor","Floor number",250)}<label>Possession by<MaterialInput type="date" value={fields.get("possessionBy")??""} onChange={e=>set("possessionBy",e.target.value)}/></label></FilterGroup>
        <FilterGroup title="Amenities">{propertyAmenityFields.map(({key, label, options}) => select(key, label, options.filter(o=>facets[key]?.includes(o.value))))}
        <label>Included amenities<MaterialSelect aria-label="Amenities" multiple value={(fields.get("amenity")??"").split(",")} onChange={e=>set("amenity",Array.from(e.target.selectedOptions,o=>o.value).join(","))}>{Object.entries(propertyAmenities).filter(([code])=>facets.amenity?.includes(code)).map(([v,label])=><option key={v} value={v}>{label}</option>)}</MaterialSelect></label></FilterGroup>
        <FilterGroup title="More filters">{locationFilter?.(facets)}<label className={styles.checkFilter}><MaterialInput type="checkbox" checked={fields.get("verifiedSeller")==="1"} onChange={e=>set("verifiedSeller",e.target.checked?"1":"")}/> Verified seller</label>
        {select("postedBy", "Listed by", [{value: "OWNER", label: "Property Owner"}, {value: "DEALER", label: "Property Dealer"}, {value: "BUILDER", label: "Builder"}].filter(o=>facets.postedBy?.includes(o.value)))}
        <label className={styles.checkFilter}><MaterialInput type="checkbox" checked={fields.get("rera") === "1"} onChange={(event) => set("rera", event.target.checked ? "1" : "")} /> RERA number available</label>
        <label className={styles.checkFilter}><MaterialInput type="checkbox" checked={fields.get("featured") === "1"} onChange={(event) => set("featured", event.target.checked ? "1" : "")} /> Featured properties only</label></FilterGroup>
        <FilterGroup title="Area">{select("unit", "Area unit", (facets.unit ?? []).map((value) => ({value, label: value})))}
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
  return <PropertyFilterPanel count={new URLSearchParams(value).size} reset={()=>{setFields(new URLSearchParams());setError("");clearAll?.();}}>
    <form onSubmit={submit}><div className={css.filterScroll}>{groups}</div>
      <div className={styles.filterActions}><MuiButton variant="contained" type="submit">{property ? "Show properties" : "Apply filters"}</MuiButton></div>
    </form>
  </PropertyFilterPanel>;
}
