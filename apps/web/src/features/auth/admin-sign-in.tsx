"use client";
import {useRouter} from "next/navigation";
import {useEffect,useState,type FormEvent} from "react";
import {apiRequest} from "@/lib/api/client";
import styles from "@/features/site-pages/contact-form.module.css";

export function AdminSignIn({locale}:{locale:string}){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;
    const fields=new FormData(event.currentTarget);setBusy(true);setError("");
    try{await apiRequest("/auth/sign-in",{method:"POST",body:{email:fields.get("email"),password:fields.get("password")}});router.replace("/"+locale+"/dashboard");}
    catch(cause){setError(cause instanceof Error?cause.message:"Sign-in failed.");setBusy(false);}
  }
  return <main style={{maxWidth:480,margin:"10vh auto",padding:24}}><h1>Administrator sign-in</h1><form method="post" onSubmit={submit} className={styles.form}>
    <label>Administrator email or username<input name="email" required autoComplete="username"/></label>
    <label>Password<input name="password" type="password" required autoComplete="current-password"/></label>
    {error&&<p role="alert">{error}</p>}<button disabled={!ready || busy}>{busy?"Signing in…":"Sign in"}</button></form></main>;
}
