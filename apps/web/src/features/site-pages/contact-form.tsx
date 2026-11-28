"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {isValidPhoneNumber} from "libphonenumber-js/min";
import {Mail,Send} from "lucide-react";
import {PhoneInput,formPhone} from "@/components/ui/phone-input";
import {ApiClientError,apiRequest} from "@/lib/api/client";
import styles from "./contact-form.module.css";

export function ContactForm(){
  const key=useRef("");
  const [ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]);
  const [sending,setSending]=useState(false),[done,setDone]=useState(false);
  const [error,setError]=useState(""),[fields,setFields]=useState<Record<string,string>>({});
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(sending)return;
    const form=event.currentTarget,values=new FormData(form);
    const text=(key:string)=>String(values.get(key)??"").trim();
    const invalid:Record<string,string>={};
    const whatsapp=formPhone(values,"whatsapp"),phone=formPhone(values);
    if(text("name").length<2)invalid.name="Enter your full name.";
    if(!/^\S+@\S+\.\S+$/.test(text("email")))invalid.email="Enter a valid email address.";
    if(!whatsapp || !isValidPhoneNumber(whatsapp))invalid.whatsapp="Enter a valid WhatsApp number.";
    if(text("phone")&&(!phone || !isValidPhoneNumber(phone)))invalid.phone="Enter a valid phone number.";
    if(text("message").length<10)invalid.message="Enter at least 10 characters.";
    setFields(invalid);setError("");
    if(Object.keys(invalid).length){form.querySelector<HTMLElement>('[name="'+Object.keys(invalid)[0]+'"]')?.focus();return;}
    setSending(true);key.current ||= crypto.randomUUID();
    try {await apiRequest("/public/contact-messages",{method:"POST",body:{requestId:key.current,name:text("name"),email:text("email"),message:text("message"),phone:phone||undefined,whatsapp}});
      form.reset();key.current="";setDone(true);
    }catch(e){setError(e instanceof Error?e.message:"Your message could not be sent.");if(e instanceof ApiClientError)setFields(e.fieldErrors);}finally{setSending(false);}
  }
  const attrs=(name:string)=>({"aria-invalid":!!fields[name],"aria-describedby":fields[name]?"contact-"+name:undefined});
  const issue=(name:string)=>fields[name]&&<small role="alert" id={"contact-"+name}>{fields[name]}</small>;
  if(done)return <div className={styles.form} role="status"><Mail/><h2>Message received</h2><p>Our team will follow up using the contact details you provided.</p><button onClick={()=>setDone(false)}>Send another message</button></div>;
  return <form method="post" className={styles.form} onSubmit={submit} noValidate aria-busy={sending}>
    <h2><Mail size={22}/> Send us a message</h2><div className={styles.fields}>
    <label>Name<input name="name" required autoComplete="name" maxLength={120} {...attrs("name")}/>{issue("name")}</label>
    <label>Email address<input type="email" required name="email" autoComplete="email" maxLength={254} {...attrs("email")}/>{issue("email")}</label>
    <label>Phone number (optional)<PhoneInput name="phone" {...attrs("phone")}/>{issue("phone")}</label>
    <label>WhatsApp number<PhoneInput required name="whatsapp" {...attrs("whatsapp")}/>{issue("whatsapp")}</label></div>
    <label>Message<textarea name="message" rows={5} required minLength={10} maxLength={4000} {...attrs("message")}/>{issue("message")}</label>
    {error&&<p role="alert">{error}</p>}<button type="submit" disabled={!ready || sending}><Send size={16}/>{sending?"Sending…":"Send message"}</button>
  </form>;
}
