import {useEffect, useState} from "react";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import {apiRequest} from "@/lib/api/client";

export function usePropertyContactProfile(enabled: boolean) {
  const auth = useMarketplaceAuth();
  const session = auth?.session;
  const [profile, setProfile] = useState<{session: typeof session; phone: string}>();
  useEffect(() => {
    if (!enabled || !session) return;
    const abort = new AbortController();
    void apiRequest<{phone?: string | null}>("/account/profile", {signal: abort.signal}).then(({phone}) => {
      if (!abort.signal.aborted) setProfile({session, phone: phone ?? ""});
    }, () => {});
    return () => abort.abort();
  }, [enabled, session]);
  return {auth, signedIn: Boolean(session), fullName: session?.name ?? "", phone: profile && profile.session === session ? profile.phone : ""};
}
