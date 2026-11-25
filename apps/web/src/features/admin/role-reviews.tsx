"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import {useEffect,useState, type FormEvent} from "react";
import toast from "react-hot-toast";
import {apiRequest} from "@/lib/api/client";
import styles from "../dashboard/website-panels.module.css";

type Review = {userId:string;originalRole:string;reason:string;user:{fullName:string}};

export function RoleReviews() {
  const [rows,setRows] = useState<Review[]>();
  const [refresh,setRefresh] = useState(0);
  const [error,setError] = useState("");
  const [saving,setSaving] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    apiRequest<Review[]>("/workspace/role-reviews",{signal:abort.signal}).then(data => {
      if (!abort.signal.aborted) {setRows(data);setError("");}
    }).catch(e => {if (!abort.signal.aborted) setError(e.message);});
    return () => abort.abort();
  },[refresh]);
  async function decide(event:FormEvent<HTMLFormElement>,id:string) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await apiRequest("/workspace/role-reviews/"+encodeURIComponent(id),{method:"POST",body:{role:form.get("role"),note:form.get("note")}});
      toast.success("Role decision saved");
      setRefresh(n => n+1);
    } catch(e) {setError(e instanceof Error ? e.message : "Could not save decision.");}
    finally {setSaving(false);}
  }
  return <section className={styles.panel}><h1>Account role reviews</h1>
    {error && <p role="alert">{error} <MuiButton type="submit" onClick={() => setRefresh(n => n+1)}>Retry</MuiButton></p>}
    {!rows && !error && <p role="status">Loading accounts…</p>}
    {rows?.length === 0 && <p>All account roles have been reviewed.</p>}
    {rows?.map(row => <form className={styles.form} key={row.userId} onSubmit={e => decide(e,row.userId)}>
      <h2>{row.user.fullName}</h2><p>{row.reason}</p><label>Confirmed role<MaterialSelect name="role" defaultValue={row.originalRole}>
        {(row.originalRole === "WHITE_COLLAR_SEEKER" ? ["WHITE_COLLAR_SEEKER","BLUE_COLLAR_WORKER"] : ["BUYER","OWNER","DEALER"]).map(role => <option key={role}>{role}</option>)}</MaterialSelect></label>
      <label>Reason for decision<MaterialInput name="note" required minLength={10} maxLength={1000}/></label><footer><MuiButton variant="contained" type="submit" disabled={saving}>Confirm role</MuiButton></footer>
    </form>)}</section>;
}
