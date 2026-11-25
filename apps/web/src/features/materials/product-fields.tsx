"use client";
import {useEffect,useState} from "react";
import type {SpecificationDefinition,SpecificationValue} from "@the-property-pillar/contracts";
import {MasterSelect,type Option} from "@/features/profiles/controls";
import {apiRequest} from "@/lib/api/client";
import styles from "./materials.module.css";

type Selection = {category:Option|null;subcategory:Option|null;unit:Option|null};
type Props = {
  fields:Record<string,string|number|boolean>;
  update:(key:string,value:string)=>void;
  values:Record<string,SpecificationValue>;
  onChange:(values:Record<string,SpecificationValue>)=>void;
  errors:Record<string,string>;
};
export function ProductFields({fields,update,values,onChange,errors}:Props){
  const [items,setItems]=useState<SpecificationDefinition[]>([]);
  const [selected,setSelected]=useState<Selection>({category:null,subcategory:null,unit:null});
  const [loading,setLoading]=useState(false);
  const [failure,setFailure]=useState("");
  const [retry,setRetry]=useState(0);
  const params=new URLSearchParams({category:String(fields.category||""),subcategoryId:String(fields.subcategoryId||""),unit:String(fields.unit||"")}).toString();
  useEffect(()=>{
    const c=new AbortController();
    setLoading(true);setFailure("");
    (async()=>{
      const found=await apiRequest<Selection>("/material-catalog/selection?"+params,{signal:c.signal});
      const query=new URLSearchParams({categoryId:found.category?.id??""});
      if(found.subcategory)query.set("subcategoryId",found.subcategory.id);
      const definitions=found.category?await apiRequest<SpecificationDefinition[]>("/material-catalog/specifications?"+query,{signal:c.signal}):[];
      if(!c.signal.aborted){setSelected(found);setItems(definitions);}
    })().catch(()=>{if(!c.signal.aborted)setFailure("Could not load catalogue choices.")}).finally(()=>{if(!c.signal.aborted)setLoading(false)});
    return ()=>c.abort();
  },[params,retry]);
  function change(id:string,v:SpecificationValue|undefined){const next={...values};if(v===undefined)delete next[id];else next[id]=v;onChange(next);}
  const picker=(key:"category"|"subcategory"|"unit",label:string,kind:"MATERIAL_CATEGORY"|"MATERIAL_SUBCATEGORY"|"MATERIAL_UNIT")=>{
    const field=key==="subcategory"?"subcategoryId":key;
    return <div><label htmlFor={"material-"+field}>{label}</label><MasterSelect id={"material-"+field} kind={kind} label={label} parent={key==="subcategory"?selected.category?.id:undefined}
      disabled={key==="subcategory"&&(!selected.category||loading)} selected={selected[key]?[selected[key]!]:[]} value={selected[key]?.id}
      onChange={(_,o)=>{setSelected(old=>({...old,[key]:o??null,...(key==="category"?{subcategory:null}:{})}));update(field,(key==="subcategory"?o?.id:o?.code)??"");
       if(key==="category"){update("subcategoryId","");setItems([]);onChange({});}
       if(key==="subcategory")onChange(Object.fromEntries(Object.entries(values).filter(([k])=>items.some(d=>d.id===k&&!d.subcategoryId))));
      }}/>{errors[field]&&<small role="alert">{errors[field]}</small>}</div>
  };
  return <fieldset className={styles.panel}><legend>Catalogue & specifications</legend><div className={styles.grid}>
    {picker("category","Material category","MATERIAL_CATEGORY")}{picker("subcategory","Subcategory","MATERIAL_SUBCATEGORY")}{picker("unit","Selling unit","MATERIAL_UNIT")}
    {loading&&<p role="status">Loading specifications…</p>}{failure&&<p role="alert">{failure} <button type="button" onClick={()=>setRetry(r=>r+1)}>Retry</button></p>}
    {!loading&&!failure&&items.map(d=>{
      const value=values[d.id];const key="specifications."+d.id;
      const input={id:key,name:key,"aria-invalid":!!errors[key],"aria-describedby":errors[key]?key+"-error":undefined};
      let control;
      if(d.fieldType==="DROPDOWN"||d.fieldType==="BOOLEAN"){
        const options=d.fieldType==="BOOLEAN"?["Yes","No"]:d.options;
        const displayed=value===undefined?"":typeof value==="boolean"?(value?"Yes":"No"):String(value);
        control=<select {...input} value={displayed} onChange={e=>change(d.id,e.target.value===""?undefined:d.fieldType==="BOOLEAN"?e.target.value==="Yes":e.target.value)}><option value="">Select</option>{options.map(o=><option key={o}>{o}</option>)}</select>;
      }else if(d.fieldType==="MULTI_SELECT"){
        const chosen=Array.isArray(value)?value:[];
        control=<div className={styles.choices} role="group" aria-label={d.name}>{d.options.map(o=><label key={o}><input type="checkbox" checked={chosen.includes(o)} onChange={e=>{const next=e.target.checked?[...chosen,o]:chosen.filter(v=>v!==o);change(d.id,next.length?next:undefined)}}/>{o}</label>)}</div>;
      }else if(d.fieldType==="RANGE"){
        const range=value&&typeof value==="object"&&!Array.isArray(value)?value:undefined;
        control=<div className={styles.range}>{(["min","max"] as const).map(k=><input type="number" step="any" key={k} aria-label={d.name+" "+k} placeholder={k} value={range?.[k]??""} onChange={e=>{if(e.target.value==="")change(d.id,undefined);else {const n=Number(e.target.value);change(d.id,{min:range?.min??n,max:range?.max??n,[k]:n})}}}/>)}</div>;
      }else{
        const numeric=d.fieldType!=="TEXT";
        control=<input {...input} type={numeric?"number":"text"} step={d.fieldType==="NUMBER"?1:"any"} value={typeof value==="number"||typeof value==="string"?value:""} onChange={e=>change(d.id,e.target.value===""?undefined:numeric?Number(e.target.value):e.target.value)}/>;
      }
      return <div key={d.id}><label htmlFor={key}>{d.name}{d.unit?" ("+d.unit+")":""}{d.required?" *":""}</label>{control}{errors[key]&&<small id={key+"-error"} role="alert">{errors[key]}</small>}</div>;
    })}
  </div></fieldset>;
}
