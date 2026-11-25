import Link from "next/link";
import {useTranslations} from "next-intl";
import {ChevronDown, Wrench} from "lucide-react";
import {publicTaskHref} from "@/config/public-tasks";
import styles from "./profile-tools.module.css";

export function ProfileTools({locale, onNavigate}: {locale: string; onNavigate?: () => void}) {
  const t = useTranslations("Site");
  return <details className={styles.tools}>
    <summary><Wrench size={16} />{t("tools")}<ChevronDown size={14} /></summary>
    <Link href={`/${locale}/finance-services#emi-calculator`} onClick={onNavigate}>{t("loanCalculator")}</Link>
    <Link href={publicTaskHref(locale, "finance-services/apply")} onClick={onNavigate}>{t("loanEnquiry")}</Link>
    <Link href={`/${locale}/projects`} onClick={onNavigate}>{t("projects")}</Link>
    <Link href={`/${locale}/materials`} onClick={onNavigate}>{t("constructionMaterials")}</Link>
  </details>;
}
