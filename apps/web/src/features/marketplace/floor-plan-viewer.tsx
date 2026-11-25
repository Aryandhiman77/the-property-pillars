"use client";

import MuiButton from "@mui/material/Button";
import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./property-assets.module.css";

export type Drawing = {
  id: string;
  title: string;
  planType: string;
  image?: string | null;
  pdf?: string | null;
  areaValue?: number | string | null;
  areaUnit?: string | null;
};
export function FloorPlanViewer({
  image,
  title,
  onClose,
}: {
  image: string;
  title: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.zoom}
      onClose={onClose}
      aria-label={title}
    >
      <div className={styles.viewerHeader}>
        <h3>{title}</h3>
        <a href={image} target="_blank" rel="noreferrer">Open full size</a>
        <MuiButton autoFocus type="button" onClick={() => dialog.current?.close()}>Close</MuiButton>
      </div>
      <Image
        unoptimized
        width={1200}
        height={900}
        style={{ objectFit: "contain" }}
        src={image}
        alt={title}
      />
    </dialog>
  );
}
