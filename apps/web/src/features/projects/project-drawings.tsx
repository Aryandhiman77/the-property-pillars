"use client";

import MuiButton from "@mui/material/Button";
import Image from "next/image";
import { useState } from "react";
import {
  FloorPlanViewer,
  type Drawing,
} from "@/features/marketplace/floor-plan-viewer";
import styles from "./projects.module.css";

export type ProjectDrawing = Omit<Drawing, "areaUnit"> & {
  areaUnit?: { code: string } | null;
  configurationId?: string | null;
  configuration?: { name: string } | null;
  isPrimary?: boolean;
};
export function ProjectDrawings({ plans }: { plans: ProjectDrawing[] }) {
  const [zoom, setZoom] = useState<ProjectDrawing>();
  return (
    <>
      <div className={styles.grid}>
        {plans.map((p) => (
          <article id={"drawing-" + p.id} key={p.id} className={styles.tile}>
            {p.image && (
              <MuiButton
                type="button"
                className={styles.preview}
                onClick={() => setZoom(p)}
                aria-label={"Open " + p.title}
              >
                <Image
                  unoptimized
                  width={480}
                  height={300}
                  src={p.image}
                  alt={p.title}
                />
              </MuiButton>
            )}
            <h3>{p.title}</h3>
            <p>
              {[
                p.planType,
                p.configuration?.name,
                p.areaValue && [p.areaValue, p.areaUnit?.code].join(" "),
                p.isPrimary && "Primary plan",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.pdf && <a href={p.pdf}>Download PDF</a>}
          </article>
        ))}
      </div>
      {zoom?.image && (
        <FloorPlanViewer
          image={zoom.image}
          title={zoom.title}
          onClose={() => setZoom(undefined)}
        />
      )}
    </>
  );
}
