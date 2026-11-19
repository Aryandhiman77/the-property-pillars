import {notFound, redirect} from "next/navigation";

import {isAppLocale} from "@/i18n/config";

export default async function NotificationsRedirect({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isAppLocale(locale)) notFound();
  redirect(`/${locale}/dashboard?view=notifications`);
}

