import {useTranslations} from "next-intl";

export function FreeBadge() {
  const t = useTranslations("Site");
  return <span className="property-free-badge">{t("freeBadge")}</span>;
}
