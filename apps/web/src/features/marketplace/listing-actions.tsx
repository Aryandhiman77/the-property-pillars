"use client";

import MuiButton from "@mui/material/Button";

import Link from "next/link";
import {Copy, Phone, Send} from "lucide-react";
import {apiRequest} from "@/lib/api/client";
import {useSession} from "@/features/auth/use-session";
import {useEffect,useState} from "react";
import type {DirectoryKey} from "@/config/marketplace";
import {publicTaskHref, type PublicTaskPath} from "@/config/public-tasks";
import styles from "./directory.module.css";

const actions: Partial<Record<DirectoryKey, {path: PublicTaskPath; label: string}>> = {
  projects: {path: "properties/enquire", label: "Enquire about this project"},
  professionals: {path: "professionals/request", label: "Request a service"},
  jobs: {path: "jobs/apply", label: "Apply for this job"},
  materials: {path: "materials/request-quote", label: "Request material quotes"},
};

function SaveJob({id}:{id:string}) {
  const {session}=useSession();
  const [saved,setSaved]=useState<boolean|null>(null),[error,fail]=useState(""),[busy,setBusy]=useState(false);
  const role=session?.role;
  useEffect(()=>{
    if(role!=="WHITE_COLLAR_SEEKER")return;
    const c=new AbortController();
    apiRequest<{saved:boolean}>("/profiles/saved-jobs/"+id,{signal:c.signal}).then(r=>setSaved(r.saved)).catch(e=>{if(!c.signal.aborted)fail(e.message);});
    return ()=>c.abort();
  },[id,role]);
  if(role!=="WHITE_COLLAR_SEEKER")return null;
  return <><MuiButton type="submit" className={styles.secondaryButton} disabled={busy || saved===null} aria-pressed={saved??false} onClick={async()=>{
    setBusy(true);try{const r=await apiRequest<{saved:boolean}>("/profiles/saved-jobs/"+id,{method:saved?"DELETE":"PUT"});setSaved(r.saved);fail("");}
    catch(e){fail(e instanceof Error?e.message:"Could not save this job.");}finally{setBusy(false);}
  }}>{saved?"Remove saved job":"Save job"}</MuiButton>{error&&<small role="alert">{error}</small>}</>;
}

export function ListingActions({kind, id, title, locale, phone, whatsapp, acceptingApplications}: {
  kind: DirectoryKey; id: string; title: string; locale: string; phone?: string; whatsapp?: string; acceptingApplications?: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const applicationsClosed = kind === "jobs" && acceptingApplications === false;
  const action = applicationsClosed ? undefined : actions[kind];
  const params = new URLSearchParams({title});
  if (kind !== "materials") params.set("record", id);
  if (kind === "projects") params.set("kind", "project");
  const directPhone = kind !== "properties" && phone && /^\+?[0-9]{8,15}$/.test(phone) ? phone : "";
  const whatsAppNumber = kind !== "properties" && whatsapp && /^\+[0-9]{8,15}$/.test(whatsapp) ? whatsapp.slice(1) : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFeedback("Link copied.");
    } catch {
      setFeedback("Copy the page address from your browser to share it.");
    }
  }

  return (
    <div className={styles.actions}>
      {kind==="jobs" && <SaveJob id={id}/>}
      {applicationsClosed && <p>Applications have closed.</p>}
      {action && <Link className={styles.primaryButton} href={publicTaskHref(locale, action.path, params)}>
        <Send size={16} aria-hidden="true" />{action.label}
      </Link>}
      {directPhone && <a href={"tel:" + directPhone} className={styles.secondaryButton}><Phone size={16} aria-hidden="true" />Call</a>}
      {whatsAppNumber && <a href={"https://wa.me/" + whatsAppNumber} target="_blank" rel="noopener noreferrer" className={styles.secondaryButton}>WhatsApp</a>}
      {kind === "dealers" && !directPhone && !whatsAppNumber && <a href="#dealer-properties" className={styles.secondaryButton}><Send size={16} aria-hidden="true" /> Enquire about a listing</a>}
      <MuiButton onClick={() => void copyLink()} type="button" className={styles.clearButton}><Copy size={16} aria-hidden="true" />Copy page link</MuiButton>
      {feedback && <div className={styles.feedback} role="status">{feedback}</div>}
    </div>
  );
}
