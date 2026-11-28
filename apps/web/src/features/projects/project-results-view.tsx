"use client";

import {useState, type ReactNode} from "react";
import {ListingViewToggle} from "@/features/marketplace/listing-view-toggle";
import design from "@/features/marketplace/listing-results.module.css";
import directory from "@/features/marketplace/directory.module.css";
import styles from "./projects.module.css";

export function ProjectResultsView({total, children}: {total: number; children: ReactNode}) {
  const [grid, setGrid] = useState(true);
  return <>
    <div className={design.toolbar}><strong role="status">{total} matching projects</strong>
      <div><ListingViewToggle grid={grid} onChange={setGrid} /></div>
    </div>
    <div data-grid={grid || undefined} className={`${directory.resultsList} ${styles.projectResults} ${grid ? design.propGrid : styles.projectList}`}>{children}</div>
  </>;
}
