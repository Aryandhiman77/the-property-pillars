import type { ReactNode } from "react";
import styles from "./dashboard.module.css";

export function ListingQuantity({
  label,
  input,
  unit,
}: {
  label: string;
  input: ReactNode;
  unit: ReactNode;
}) {
  return (
    <div className={styles.quantity}>
      <span>{label}</span>
      <div>
        {input}
        {unit}
      </div>
    </div>
  );
}
