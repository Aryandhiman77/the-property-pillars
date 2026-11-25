import {useEffect, useState} from "react";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import {apiRequest} from "@/lib/api/client";

export function usePropertyContactProfile(enabled: boolean) {
  const auth = useMarketplaceAuth();
  const session = auth?.session;
  const [profile, setProfile] = useState<{session: typeof session; fullName: string; email: string | null; phone: string | null}>();
  useEffect(() => {
    if (!enabled || !session) return;
    const abort = new AbortController();
    void apiRequest<{fullName: string; email: string | null; phone: string | null}>("/account/profile", {signal: abort.signal}).then((contact) => {
      if (!abort.signal.aborted) setProfile({session, ...contact});
    }, () => {});
    return () => abort.abort();
  }, [enabled, session]);
  const current = profile?.session === session ? profile : undefined;
  return {auth, signedIn: Boolean(session), fullName: current?.fullName ?? session?.name ?? "", email: current?.email ?? "", phone: current?.phone ?? ""};
}
