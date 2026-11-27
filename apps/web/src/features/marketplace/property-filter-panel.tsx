"use client";

import {useEffect, useId, useRef, useState, type ReactNode} from "react";
import {Search, SlidersHorizontal, X} from "lucide-react";
import css from "./listing-results.module.css";

export function SearchFacet({label, options, value, change}: {label:string; options:string[]; value:string[]; change:(value:string)=>void}) {
  const [search,setSearch] = useState("");
  const filtered = [...new Set([...value, ...options])].filter(option => option.toLowerCase().includes(search.trim().toLowerCase()));
  return <details open className={css.group}><summary>{label}</summary><div>
    <label className={css.search}><Search size={15}/><input type="search" aria-label={"Search " + label} placeholder={"Search " + label.toLowerCase()} value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className={css.options}>{filtered.map(option => <label key={option}><input type="checkbox" checked={value.includes(option)} onChange={()=>change(option)}/>{option}</label>)}
    {!filtered.length && <small>{search ? "No matching options" : "No options available"}</small>}</div>
  </div></details>;
}

export function BudgetRange({currency,min,max,change}: {currency:string;min:string;max:string;change:(key:string,value:string)=>void}) {
  const scale = currency==="INR" ? 100000 : 1;
  const end = Math.max(currency==="INR"?250:1000000,Number(min)/scale,Number(max)/scale);
  const low=Number(min)/scale, high=max?Number(max)/scale:end;
  const suffix=currency==="INR"?"₹ lakh":currency;
  return <div className={css.budget}>
    <div className={css.amounts}>{(["minPrice","maxPrice"] as const).map((key,i)=><label key={key}>{i?"Max":"Min"} price ({suffix})
      <input type="number" min="0" step="any" inputMode="decimal" placeholder={i?"Any":"0"} value={(i?max:min)===""?"":Number(i?max:min)/scale}
        onChange={e=>change(key,e.target.value===""?"":String(Math.round(Number(e.target.value)*scale*100)/100))}/></label>)}</div>
    <div className={css.sliders} style={{backgroundImage:`linear-gradient(to right,#dae5e5 ${low/end*100}%,#18475a ${low/end*100}%,#18475a ${high/end*100}%,#dae5e5 ${high/end*100}%)`}}>
      <input type="range" aria-label={"Minimum price in "+suffix} min={0} max={end} step="any" value={low} onChange={e=>change("minPrice",String(Math.round(Math.min(+e.target.value,high)*scale)))}/>
      <input type="range" aria-label={"Maximum price in "+suffix} min={0} max={end} step="any" value={high} onChange={e=>change("maxPrice",String(Math.round(Math.max(+e.target.value,low)*scale)))}/>
    </div><div className={css.ends}><span>{currency==="INR"?"₹0":"0"}</span><span>{currency==="INR"?`₹${+(end/100).toFixed(2)} Cr`:end.toLocaleString("en")}</span></div>
  </div>;
}

export function PropertyFilterPanel({count,reset,children}:{count:number;reset:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const id=useId();
  const [mobile,setMobile]=useState(false);
  useEffect(()=>{
    const mq=matchMedia("(max-width:900px)");
    const sync=()=>{if(!mq.matches)dialog.current?.close();setMobile(mq.matches);};
    sync();mq.addEventListener("change",sync);return ()=>mq.removeEventListener("change",sync);
  },[]);
  const panel=<div className={css.panel}><div className={css.panelHead}><strong><SlidersHorizontal size={17}/>Filters {count>0 && <small>({count})</small>}</strong>
    <button type="button" onClick={reset}>Clear all</button>{mobile&&<button type="button" aria-label="Close filters" onClick={()=>dialog.current?.close()}><X size={18}/></button>}</div>{children}</div>;
  return mobile ? <><button type="button" className={css.mobileFilters} aria-controls={id} onClick={()=>dialog.current?.showModal()}><SlidersHorizontal size={16}/> Filters{count>0?` (${count})`:""}</button>
    <dialog ref={dialog} id={id} className={css.drawer} aria-label="Property filters" onClick={e=>{if(e.target===dialog.current)dialog.current.close();}}>{panel}</dialog></> : panel;
}
