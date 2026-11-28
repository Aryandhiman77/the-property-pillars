import {notFound} from "next/navigation";
import {isAppLocale} from "@/i18n/config";
import {AdminSignIn} from "@/features/auth/admin-sign-in";

export default async function AdminLoginPage({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;
  if(!isAppLocale(locale))notFound();
  return <AdminSignIn locale={locale}/>;
}
