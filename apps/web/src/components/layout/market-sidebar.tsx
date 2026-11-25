"use client";

import IconButton from "@mui/material/IconButton";
import {X} from "lucide-react";
import {useEffect, useRef, type ReactNode} from "react";
import {createPortal} from "react-dom";
import ui from "./market-sidebar.module.css";

export function MarketSidebar({label, closeLabel, close, children, compact}: {
  label: string; closeLabel: string; close: () => void; children: ReactNode; compact?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return createPortal(<dialog ref={ref} className={ui.drawer} data-compact={compact || undefined}
    aria-label={label} onCancel={event => {event.preventDefault(); close();}}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
    <header className={ui.header}><strong>{label}</strong>
      <IconButton aria-label={closeLabel} onClick={close} autoFocus><X size={20} /></IconButton>
    </header>
    <div className={ui.body}>{children}</div>
  </dialog>, document.body);
}
