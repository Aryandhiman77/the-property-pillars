import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import {Building2, House, Images, Send} from "lucide-react";
import {useTranslations} from "next-intl";
import {propertySteps} from "@the-property-pillar/contracts";
import {MaterialSelect} from "@/components/ui/material-fields";
import styles from "./dashboard.module.css";

const stages = [
  {start: 1, label: "listingBasics", icon: House},
  {start: 4, label: "listingDetailsPricing", icon: Building2},
  {start: 10, label: "listingMediaContact", icon: Images},
  {start: 17, label: "listingReviewSubmit", icon: Send},
] as const;

export function ListingProgress({step, completion, onStep}: {step: number; completion: number; onStep: (value: number) => void}) {
  const t = useTranslations("Site");
  return <aside className={styles.listingRail} aria-label={t("listingProgress")}>
    <h2>{t("listingProgress")}</h2>
    <div className={styles.progressLabel}><span>{t("requiredDetails")}</span><strong>{completion}%</strong></div>
    <LinearProgress variant="determinate" value={completion} aria-label={t("requiredDetails")} />
    <nav aria-label={t("listingStages")}>{stages.map(({start, label, icon: Icon}, index) => {
      const end = (stages[index + 1]?.start ?? propertySteps.length + 1) - 1;
      return <Button key={start} aria-current={step >= start && step <= end ? "step" : undefined}
        onClick={() => onStep(start)} startIcon={<Icon size={18} />}>{t(label)}</Button>;
    })}</nav>
    <label>{t("jumpListingStep")}
      <MaterialSelect aria-label="Listing step" value={step} onChange={event => onStep(Number(event.target.value))}>
        {propertySteps.map((label, i) => <option key={label} value={i + 1}>{i + 1}. {label}</option>)}
      </MaterialSelect>
    </label>
  </aside>;
}
