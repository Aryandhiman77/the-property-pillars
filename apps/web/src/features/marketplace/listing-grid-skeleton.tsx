"use client";

import {useTranslations} from "next-intl";
import type {DirectoryKey} from "@/config/marketplace";
import {Skeleton, SkeletonStatus} from "@/components/ui/loading-skeleton";
import styles from "./directory.module.css";

export function ListingGridSkeleton({kind, count = 6, row = false}: {kind: DirectoryKey; count?: number; row?: boolean}) {
  const t = useTranslations("Site");
  const hasPhoto = kind !== "jobs" && kind !== "workers";
  return <SkeletonStatus label={t("loadingListings")} className={row ? styles.resultsList : styles.grid}>
    {Array.from({length: count}, (_, index) => <div className={`${styles.skeletonCard} ${row ? styles.rowCard : ""}`} key={index} aria-hidden="true">
      {hasPhoto && <Skeleton className={styles.skeletonPhoto} />}
      <div className={styles.skeletonBody}>
        <Skeleton className={styles.skeletonTag} />
        <Skeleton className={styles.skeletonTitle} />
        <Skeleton className={styles.skeletonShort} />
        <Skeleton />
        <Skeleton className={styles.skeletonShort} />
      </div>
    </div>)}
  </SkeletonStatus>;
}
