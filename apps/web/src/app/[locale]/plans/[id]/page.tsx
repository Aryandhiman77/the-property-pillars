import {notFound} from "next/navigation";
import {setRequestLocale} from "next-intl/server";
import {isAppLocale} from "@/i18n/config";
import {ListingPlanDetails} from "@/features/billing/plan-details";

export const metadata = {title:"Listing plan details",robots:{index:false,follow:false}};
export default async function PlanPage({params}:{params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  return <ListingPlanDetails id={id} locale={locale}/>;
}
