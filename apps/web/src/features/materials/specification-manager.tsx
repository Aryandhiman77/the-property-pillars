"use client";

import {MaterialInput, MaterialSelect, MaterialTextarea} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import {useEffect,useState,type FormEvent} from "react";
import {Plus,Pencil} from "lucide-react";
import toast from "react-hot-toast";
import {specificationTypes,type SpecificationDefinition,type SpecificationType} from "@the-property-pillar/contracts";
import {MasterSelect,type Option} from "@/features/profiles/controls";
import {apiRequest,ApiClientError} from "@/lib/api/client";
import styles from "./materials.module.css";

type Editable=Omit<SpecificationDefinition,"id"|"categoryId"> & {id?:string};
const blank:Editable={name:"",fieldType:"TEXT",subcategoryId:null,unit:null,required:false,options:[],sortOrder:0,active:true};
export function SpecificationManager(){
  const [category,setCategory]=useState<Option|null>(null),[sub,setSub]=useState<Option|null>(null);
  const [draft,setDraft]=useState<Editable|null>(null),[options,setOptions]=useState("");
  const [rows,setRows]=useState<SpecificationDefinition[]>([]),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
  const [error,setError]=useState(""),[fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  useEffect(()=>{
    if(!category){setRows([]);return;}
    const c=new AbortController();setLoading(true);setError("");
    apiRequest<SpecificationDefinition[]>("/material-catalog/specifications?"+new URLSearchParams({categoryId:category.id,all:"1",...(sub?{subcategoryId:sub.id}:{})}),{signal:c.signal})
      .then(v=>{if(!c.signal.aborted)setRows(v)}).catch(()=>{if(!c.signal.aborted){setRows([]);setError("Could not load specifications.")}}).finally(()=>{if(!c.signal.aborted)setLoading(false)});
    return ()=>c.abort();
  },[category,sub,refresh]);
  function edit(value:Editable){setDraft({...value});setOptions(value.options.join("\n"));setFieldErrors({});setError("");}
  function set<K extends keyof Editable>(k:K,v:Editable[K]){setDraft(d=>d&&({...d,[k]:v}));setFieldErrors(e=>({...e,[k]:""}));}
  const hint=(k:string)=>fieldErrors[k]?<small role="alert">{fieldErrors[k]}</small>:null;
  async function save(e:FormEvent){e.preventDefault();if(!draft||!category||saving)return;setSaving(true);setError("");setFieldErrors({});
    const {id,...fields}=draft;
    try{await apiRequest("/material-catalog/specifications"+(id?"/"+encodeURIComponent(id):""),{method:id?"PUT":"POST",body:{...fields,categoryId:category.id,options:["DROPDOWN","MULTI_SELECT"].includes(draft.fieldType)?options.split("\n").map(s=>s.trim()).filter(Boolean):[]}});
      setDraft(null);setRefresh(v=>v+1);toast.success("Specification saved");}
    catch(e){if(e instanceof ApiClientError&&Object.keys(e.fieldErrors).length)setFieldErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k,v])=>[k,Array.isArray(v)?v.join(" "):String(v)])));else setError(e instanceof Error?e.message:"Could not save specification.");}
    finally{setSaving(false)}
  }
  return <section className={styles.manager}><header><h1>Product specifications</h1>{category&&!draft&&<MuiButton type="button" onClick={()=>edit({...blank,subcategoryId:sub?.id??null})}><Plus size={16}/> Add specification</MuiButton>}</header>
    <div className={styles.grid}><div><label htmlFor="spec-category">Material category</label><MasterSelect id="spec-category" kind="MATERIAL_CATEGORY" label="Material category" disabled={saving} value={category?.id} selected={category?[category]:[]} onChange={(_,o)=>{setCategory(o??null);setSub(null);setDraft(null)}}/></div>
    <div><label htmlFor="spec-sub">Subcategory</label><MasterSelect id="spec-sub" kind="MATERIAL_SUBCATEGORY" label="Subcategory" disabled={!category||saving} parent={category?.id} value={sub?.id} selected={sub?[sub]:[]} onChange={(_,o)=>{setSub(o??null);setDraft(null)}}/></div></div>
    {error&&<p role="alert">{error} {!draft&&<MuiButton type="submit" onClick={()=>setRefresh(v=>v+1)}>Retry</MuiButton>}</p>}
    {draft&&<form onSubmit={save} className={styles.panel}><h2>{draft.id?"Edit specification":"New specification"}</h2><div className={styles.grid}>
      <div><label htmlFor="spec-name">Field name</label><MaterialInput id="spec-name" required maxLength={120} value={draft.name} onChange={e=>set("name",e.target.value)}/>{hint("name")}</div>
      <div><label htmlFor="spec-type">Field type</label><MaterialSelect id="spec-type" value={draft.fieldType} onChange={e=>set("fieldType",e.target.value as SpecificationType)}>{specificationTypes.map(t=><option key={t} value={t}>{t.replaceAll("_"," ")}</option>)}</MaterialSelect></div>
      <div><label htmlFor="spec-unit">Measurement unit</label><MaterialInput id="spec-unit" required={draft.fieldType==="UNIT_VALUE"} value={draft.unit??""} onChange={e=>set("unit",e.target.value||null)}/>{hint("unit")}</div>
      <div><label htmlFor="spec-order">Display order</label><MaterialInput id="spec-order" type="number" min={0} max={100000} required value={draft.sortOrder} onChange={e=>set("sortOrder",Number(e.target.value))}/></div>
      {["DROPDOWN","MULTI_SELECT"].includes(draft.fieldType)&&<div><label htmlFor="spec-options">Choices (one per line)</label><MaterialTextarea id="spec-options" required value={options} onChange={e=>setOptions(e.target.value)}/>{hint("options")}</div>}
      <div className={styles.choices}><label><MaterialInput type="checkbox" checked={draft.required} onChange={e=>set("required",e.target.checked)}/> Required for publication</label><label><MaterialInput type="checkbox" checked={draft.active} onChange={e=>set("active",e.target.checked)}/> Active</label></div>
    </div><div className={styles.actions}><MuiButton variant="contained" disabled={saving} type="submit">Save specification</MuiButton><MuiButton type="button" disabled={saving} onClick={()=>setDraft(null)}>Cancel</MuiButton></div></form>}
    {loading?<p role="status">Loading specifications…</p>:category&&rows.length?<div className={styles.tableWrap}><Table><TableHead><TableRow>{["Order","Field","Type","Requirement","Status","Action"].map(h=><TableCell component="th" key={h} scope="col">{h}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map(r=><TableRow key={r.id}><TableCell>{r.sortOrder}</TableCell><TableCell component="th" scope="row">{r.name}</TableCell><TableCell>{r.fieldType.replaceAll("_"," ")}</TableCell><TableCell>{r.required?"Required":"Optional"}</TableCell><TableCell>{r.active?"Active":"Inactive"}</TableCell><TableCell><MuiButton type="submit" disabled={saving} aria-label={"Edit "+r.name} onClick={()=>edit(r)}><Pencil size={15}/> Edit</MuiButton></TableCell></TableRow>)}</TableBody></Table></div>:<p>{category?"No specifications in this category.":"Choose a material category to manage its specifications."}</p>}
  </section>;
}
