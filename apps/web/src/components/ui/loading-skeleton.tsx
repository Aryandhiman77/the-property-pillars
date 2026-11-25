import MuiSkeleton from "@mui/material/Skeleton";
import type {ReactNode} from "react";
import styles from "./loading-skeleton.module.css";

export function Skeleton({className = ""}: {className?: string}) {
  return <MuiSkeleton variant="rounded" animation={false} aria-hidden="true" className={`${styles.block} ${className}`} />;
}

export function SkeletonStatus({label, className, children}: {label: string; className?: string; children: ReactNode}) {
  return <div className={className} role="status">
    <span className={styles.visuallyHidden}>{label}</span>
    {children}
  </div>;
}

export function LoadingRows({label, count = 3}: {label: string; count?: number}) {
  return <SkeletonStatus className={styles.rows} label={label}>
    {Array.from({length: count}, (_, index) => <div key={index} className={styles.row} aria-hidden="true">
      <Skeleton className={styles.icon} />
      <div className={styles.lines}>
        <Skeleton />
        <Skeleton />
      </div>
    </div>)}
  </SkeletonStatus>;
}
