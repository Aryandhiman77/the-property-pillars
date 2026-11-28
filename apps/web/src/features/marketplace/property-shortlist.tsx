"use client";

import MuiButton from "@mui/material/Button";

import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from "react";
import {Heart} from "lucide-react";
import {usePathname, useRouter} from "next/navigation";
import toast from "react-hot-toast";
import {loginHref} from "@/features/auth/login-return";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import type {AuthSession} from "@/features/auth/types";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import styles from "./directory.module.css";

type Saved = {id: string; propertyId: string; status: string};
const savedPath = "/workspace/savedProperties";
const ShortlistContext = createContext<{
  records: Saved[]; pending: string[]; loading: boolean; toggle: (id: string, title: string) => Promise<void>;
} | null>(null);

export function PropertyShortlistProvider({locale, children}: {locale: string; children: ReactNode}) {
  const auth = useMarketplaceAuth();
  const role = auth?.session?.role;
  const allowed = role === "BUYER" || role === "OWNER";
  const [loaded, setLoaded] = useState<{session: AuthSession; records: Saved[]}>();
  const [pending, setPending] = useState<string[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const running = useRef(new Set<string>());
  const current = useRef(auth?.session);
  current.current = auth?.session;
  const router = useRouter();
  const pathname = usePathname();
  const session = auth?.session;
  const records = loaded && loaded.session === session ? loaded.records : [];

  useEffect(() => {
    if (!allowed || !session) return;
    const abort = new AbortController();
    setLoadFailed(false);
    void apiRequest<Saved[]>(savedPath, {signal: abort.signal}).then((records) => {
      if (!abort.signal.aborted) setLoaded({session, records});
    }, () => {if (!abort.signal.aborted) setLoadFailed(true);});
    return () => abort.abort();
  }, [allowed, session]);

  async function toggle(id: string, title: string) {
    if (!session) {
      router.push(loginHref(locale, pathname + window.location.search));
      return;
    }
    if (!allowed) {
      toast.error("Saved properties are available in the Buyer account.");
      return;
    }
    if (running.current.has(id)) return;
    running.current.add(id);
    setPending([...running.current]);
    try {
      const known = loadFailed ? await apiRequest<Saved[]>(savedPath) : records;
      const saved = known.find((entry) => entry.propertyId === id);
      const status = saved?.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
      const result = saved
        ? await apiRequest<{id: string}>(savedPath + "/" + encodeURIComponent(saved.id), {method: "PATCH", body: {status}})
        : await apiRequest<{id: string}>(savedPath, {method: "POST", body: {title, data: {propertyId: id}}});
      if (current.current !== session) return;
      setLoaded((previous) => ({session, records: [...(previous?.session === session ? previous.records : known).filter(({propertyId}) => propertyId !== id),
        {id: result.id, propertyId: id, status}]}));
      setLoadFailed(false);
      toast.success(status === "ACTIVE" ? "Property saved." : "Property removed from your shortlist.");
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        const refreshed = await apiRequest<Saved[]>(savedPath).catch(() => null);
        if (current.current === session && refreshed) {
          setLoaded({session, records: refreshed});
          setLoadFailed(false);
        }
      }
      toast.error(cause instanceof Error ? cause.message : "Could not update saved properties.");
    } finally {
      running.current.delete(id);
      setPending([...running.current]);
    }
  }

  return <ShortlistContext.Provider value={{records, pending, loading: auth?.state === "loading" || (allowed && loaded?.session !== session && !loadFailed), toggle}}>{children}</ShortlistContext.Provider>;
}

export function SavePropertyHeart({id, title, className = "", label}: {id: string; title: string; className?: string; label?: string}) {
  const shortlist = useContext(ShortlistContext);
  if (!shortlist) return null;
  const active = shortlist.records.some(({propertyId, status}) => propertyId === id && status === "ACTIVE");
  return <MuiButton type="button" className={`${styles.shortlistHeart} ${className}`} title={active ? "Remove from shortlist" : "Shortlist"}
    aria-label={(active ? "Remove from shortlist: " : "Shortlist: ") + title} aria-pressed={active}
    disabled={shortlist.loading || shortlist.pending.includes(id)} onClick={() => void shortlist.toggle(id, title)}>
    <Heart size={19} fill={active ? "currentColor" : "none"} aria-hidden="true" />
    {label && <span>{label}</span>}
  </MuiButton>;
}
