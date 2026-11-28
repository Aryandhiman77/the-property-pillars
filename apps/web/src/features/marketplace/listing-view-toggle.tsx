"use client";

import {Grid2X2, List} from "lucide-react";

export function ListingViewToggle({grid, onChange}: {grid: boolean; onChange: (grid: boolean) => void}) {
  return <>
    <button type="button" aria-label="List view" aria-pressed={!grid} onClick={() => onChange(false)}><List size={17} /></button>
    <button type="button" aria-label="Grid view" aria-pressed={grid} onClick={() => onChange(true)}><Grid2X2 size={17} /></button>
  </>;
}
