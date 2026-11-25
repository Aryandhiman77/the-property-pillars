import Link from "next/link";
import {useTranslations} from "next-intl";
import {ChevronDown, Wrench} from "lucide-react";
import styles from "./profile-tools.module.css";

export function ProfileTools({locale, onNavigate}: {locale: string; onNavigate?: () => void}) {
  const t = useTranslations("Site");
  return <details className={styles.tools}>
    <summary><Wrench size={16} />{t("tools")}<ChevronDown size={14} /></summary>
    <Link href={`/${locale}/finance-services#emi-calculator`} onClick={onNavigate}>{t("loanCalculator")}</Link>
    <a href="#loan-enquiry" aria-haspopup="dialog" onClick={onNavigate}>{t("loanEnquiry")}</a>
    <Link href={`/${locale}/projects`} onClick={onNavigate}>{t("projects")}</Link>
    <Link href={`/${locale}/materials`} onClick={onNavigate}>{t("constructionMaterials")}</Link>
  </details>;
}
