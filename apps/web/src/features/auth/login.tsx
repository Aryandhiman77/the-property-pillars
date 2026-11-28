"use client";

import {MobileDialog} from "./mobile-auth";
import {useRouter} from "next/navigation";
import {useEffect} from "react";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {isPublicTask, publicTasks} from "@/config/public-tasks";
import {getCollectionDescriptor} from "@/features/dashboard/collection-config";
import {roleConfigs} from "@/features/dashboard/role-config";
import {userRoles, type RegisterRole} from "./types";
import {useSession} from "./use-session";
import styles from "./auth-access.module.css";

export function Login({locale, next}: {locale: string; next: string; google?: string}) {
  const router = useRouter();
  const auth = useSession();
  useEffect(() => {
    if (auth.session) router.replace(safeLoginReturn(next, locale));
  }, [auth.session, next, locale, router]);
  const destination = new URL(next, "https://login-return.invalid");
  const taskPath = destination.pathname.split("/").slice(2).join("/");
  const allowed = isPublicTask(taskPath) ? getCollectionDescriptor(publicTasks[taskPath].collection).createRoles : userRoles;
  const roles = userRoles.filter((role): role is RegisterRole => role !== "ADMIN" && allowed.some(value => value === role)).map((role) => ({
    role, label: roleConfigs[role].label, description: roleConfigs[role].description, icon: roleConfigs[role].icon,
  }));
  const listingIntent = taskPath === "post-property" || (taskPath === "dashboard" && destination.searchParams.get("create") === "property");
  if (auth.state === "loading" || auth.session) return <main className={styles.oauthStatus} role="status">Checking account…</main>;
  return <main><MobileDialog mode="sign-in" roles={roles} requireEmail={listingIntent}
    close={result => router.replace(result ? safeLoginReturn(next,locale) : "/"+locale)}/></main>;
}
