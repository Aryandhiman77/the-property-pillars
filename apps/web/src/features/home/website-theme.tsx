"use client";

import {useEffect, useState, type FormEvent} from "react";
import {Palette} from "lucide-react";
import toast from "react-hot-toast";
import {apiRequest} from "@/lib/api/client";
import styles from "@/features/dashboard/website-panels.module.css";

type Theme = {accentColor: string | null};
const defaultColor = "#226455";
const valid = /^#[0-9a-f]{6}$/i;

function readableText(hex: string) {
  const rgb = hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255)
    .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? "#000" : "#fff";
}

function applyTheme(accentColor: string | null) {
  const root = document.documentElement;
  if (accentColor && valid.test(accentColor)) {
    const foreground = readableText(accentColor);
    root.style.setProperty("--theme-accent", accentColor);
    root.style.setProperty("--theme-on-accent", foreground);
    root.style.setProperty("--theme-hover-shade", foreground === "#fff" ? "#000" : "#fff");
    root.dataset.customTheme = "true";
  } else {
    root.style.removeProperty("--theme-accent");
    root.style.removeProperty("--theme-on-accent");
    root.style.removeProperty("--theme-hover-shade");
    delete root.dataset.customTheme;
  }
}

export function WebsiteTheme() {
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<Theme>("/public/website-theme", {signal: abort.signal}).then(({accentColor}) => {
      if (!abort.signal.aborted) applyTheme(accentColor);
    }, () => {});
    return () => abort.abort();
  }, []);
  return null;
}

export function WebsiteThemePanel() {
  const [color, setColor] = useState(defaultColor);
  const [saved, setSaved] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setError("");
    void apiRequest<Theme>("/public/website-theme", {signal: abort.signal}).then(({accentColor}) => {
      if (abort.signal.aborted) return;
      setSaved(accentColor); setColor(accentColor ?? defaultColor); setReady(true);
    }, () => {if (!abort.signal.aborted) setError("Could not load the website theme.");});
    return () => abort.abort();
  }, [attempt]);

  async function save(accentColor: string | null) {
    setBusy(true); setError("");
    try {
      const theme = await apiRequest<Theme>("/workspace/website-theme", {method: "PATCH", body: {accentColor}});
      setSaved(theme.accentColor);
      setColor(theme.accentColor ?? defaultColor);
      applyTheme(theme.accentColor);
      toast.success("Website theme saved");
    } catch (failure) {setError(failure instanceof Error ? failure.message : "Could not save the website theme.");}
    finally {setBusy(false);}
  }

  function submit(event: FormEvent<HTMLFormElement>) {event.preventDefault(); void save(color);}

  return <section className={styles.themePanel} aria-labelledby="website-theme-heading">
    <h1 id="website-theme-heading"><Palette size={23} aria-hidden="true" /> Website theme</h1>
    <p>Choose the accent color used across the marketplace and dashboards.</p>
    {error && <p className={styles.formError} role="alert">{error} {!ready && <button type="button" onClick={() => setAttempt(attempt + 1)}>Retry</button>}</p>}
    {!ready && !error && <p role="status">Loading theme…</p>}
    {ready && <form className={styles.themeForm} onSubmit={submit}>
      <label>Accent color <input type="color" value={color} onChange={(event) => setColor(event.target.value)} disabled={busy} /></label>
      <output>{color.toUpperCase()}</output>
      <span className={styles.themePreview} style={{backgroundColor: color, color: readableText(color)}}>Button preview</span>
      <div><button type="submit" disabled={busy || color === saved}>{busy ? "Saving…" : "Save theme"}</button>
        <button type="button" disabled={busy || !saved} onClick={() => void save(null)}>Reset to default</button></div>
    </form>}
  </section>;
}
