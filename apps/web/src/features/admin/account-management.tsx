"use client";
import {useEffect,useState,type FormEvent} from "react";
import {Inbox,Users,House,Star,BadgeCheck} from "lucide-react";
import {apiRequest} from "@/lib/api/client";
import styles from "./account-management.module.css";

type Member={id:string;fullName:string;role:string;status:string;featuredAt:string|null;verified:boolean;_count:{ownedItems:number}};
type Message={id:string;name:string;email:string;phone:string|null;whatsapp:string;message:string;createdAt:string};
type Listing={id:string;title:string;description?:string|null;status:string;updatedAt:string;data:{city?:string;locality?:string;price?:number;listingContact?:string}};
type Result={items:(Member|Message|Listing)[];total:number};
const roles=["DEALER","BUILDER","PROFESSIONAL","WHITE_COLLAR_SEEKER","BLUE_COLLAR_WORKER"];
const labels:Record<string,string>={WHITE_COLLAR_SEEKER:"Job seeker",BLUE_COLLAR_WORKER:"Skilled worker"};
const label=(role:string)=>labels[role]??role.charAt(0)+role.slice(1).toLowerCase();
export function AccountManagement({support=false}:{support?:boolean}){
  const [view,setView]=useState<"users"|"listings"|"messages">(support?"messages":"users");
  const [owner,setOwner]=useState<Member>(),[edit,setEdit]=useState<Listing>();
  const [q,setQ]=useState(""),[role,setRole]=useState(""),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [data,setData]=useState<{key:string;result?:Result;failure?:string}>();
  const params=new URLSearchParams({page:String(page)});
  if(q && view!=="messages")params.set("q",q);
  if(view==="users" && role)params.set("role",role);
  if(view==="listings" && owner)params.set("ownerId",owner.id);
  const path=({users:"/admin/accounts",listings:"/workspace/property-review",messages:"/admin/contact-messages"})[view]+"?"+params;
  const key=path+":"+revision;
  useEffect(()=>{const abort=new AbortController();apiRequest<Result>(path,{signal:abort.signal}).then(result=>{if(!abort.signal.aborted)setData({key,result})},
    e=>{if(!abort.signal.aborted)setData({key,failure:e.message})});return ()=>abort.abort()},[key,path]);
  function open(next:typeof view,member?:Member){setView(next);setOwner(member);setEdit(undefined);setQ("");setRole("");setPage(1);setError("");setNotice("");}
  async function write(path:string,body:unknown,text:string){
    if(busy)return;setBusy(true);setError("");setNotice("");
    try{await apiRequest(path,{method:"PATCH",body});setRevision(r=>r+1);setNotice(text);setEdit(undefined);}
    catch(e){setError(e instanceof Error?e.message:"The change could not be saved.");}finally{setBusy(false);}
  }
  function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!edit)return;
    const form=new FormData(event.currentTarget),value=(k:string)=>String(form.get(k)??"").trim();
    void write("/admin/properties/"+encodeURIComponent(edit.id),{updatedAt:edit.updatedAt,title:value("title"),description:value("description"),city:value("city"),locality:value("locality"),price:value("price")?Number(value("price")):null},"Listing updated.");
  }
  const result=data?.key===key?data.result:undefined;
  return <section className={styles.panel}>
    <h2>{support?"Contact Us inbox":"Accounts and property listings"}</h2>
    {!support&&<nav aria-label="Manage accounts and listings"><button aria-pressed={view==="users"} onClick={()=>open("users")}><Users size={16}/>Users</button>
      <button aria-pressed={view==="listings"} onClick={()=>open("listings")}><House size={16}/>All listings</button><button aria-pressed={view==="messages"} onClick={()=>open("messages")}><Inbox size={16}/>Contact Us</button></nav>}
    {owner&&<p>Property listings by <strong>{owner.fullName}</strong> <button onClick={()=>open("listings")}>Clear owner</button></p>}
    {view!=="messages"&&<div className={styles.filters}><label>Search {view}<input type="search" value={q} maxLength={160} onChange={e=>{setQ(e.target.value);setPage(1)}}/></label>
      {view==="users"&&<label>Role<select value={role} onChange={e=>{setRole(e.target.value);setPage(1)}}><option value="">All roles</option>{["BUYER","OWNER","VENDOR",...roles,"ADMIN"].map(r=><option key={r} value={r}>{label(r)}</option>)}</select></label>}</div>}
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {edit&&<form key={edit.id} className={styles.editor} onSubmit={save}><h3>Edit property</h3>
      <label>Title<input required minLength={3} maxLength={180} name="title" defaultValue={edit.title}/></label>
      <label>Description<textarea name="description" maxLength={12000} rows={4} defaultValue={edit.description??""}/></label>
      <label>Price<input name="price" type="number" min="0" step="any" defaultValue={edit.data.price??""}/></label>
      <label>City<input name="city" maxLength={140} defaultValue={edit.data.city}/></label>
      <label>Locality<input name="locality" maxLength={160} defaultValue={edit.data.locality}/></label>
      <nav><button disabled={busy}>{busy?"Saving…":"Save listing"}</button><button type="button" disabled={busy} onClick={()=>setEdit(undefined)}>Cancel</button></nav></form>}
    {!result?<p role="status">{(data?.key===key&&data.failure)||"Loading…"}</p>:<><small>{result.total} {view}</small>
      {result.items.map(row=><article key={row.id} className={styles.row}>{"fullName" in row?<><div><strong>{row.fullName}</strong><small>{label(row.role)} · {row.status.toLowerCase()}</small></div>
        <button onClick={()=>open("listings",row)}>{row._count.ownedItems} listings</button>
        {row.status==="ACTIVE" && ["BUILDER","DEALER","PROFESSIONAL"].includes(row.role) && <button disabled={busy} aria-pressed={row.verified}
          onClick={()=>void write("/admin/accounts/"+encodeURIComponent(row.id)+"/verification",{verified:!row.verified},row.verified?"Verification removed.":"Profile verified.")}><BadgeCheck size={15}/>{row.verified?"Remove verification":"Verify profile"}</button>}
        {(!!row.featuredAt || roles.includes(row.role)&&row.status==="ACTIVE")&&<button aria-pressed={!!row.featuredAt} disabled={busy}
          onClick={()=>void write("/admin/accounts/"+encodeURIComponent(row.id)+"/featured",{featured:!row.featuredAt},row.featuredAt?"Featured status removed.":"Account featured.")}><Star size={15}/>{row.featuredAt?"Unfeature":"Feature"}</button>}</>
        :"message" in row?<div><strong>{row.name}</strong><small>{new Date(row.createdAt).toLocaleString()}</small><p>{row.message}</p>
          <a href={"mailto:"+row.email}>{row.email}</a> · WhatsApp {row.whatsapp}{row.phone&&" · Phone "+row.phone}</div>:
        <><div><strong>{row.title}</strong><small>{[row.status,row.data.listingContact,row.data.city].filter(Boolean).join(" · ")}</small></div>
        <button onClick={()=>{setEdit(row);setError("");setNotice("")}}>Edit listing</button></>}</article>)}
      {result.total>20&&<nav><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.ceil(result.total/20)}</span><button disabled={page*20>=result.total} onClick={()=>setPage(p=>p+1)}>Next</button></nav>}</>}
  </section>;
}
