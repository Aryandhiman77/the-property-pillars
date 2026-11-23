import {Repeat2} from "lucide-react";
import styles from "./manual-uat-link.module.css";

export function ManualUatLink() {
  if (process.env.NODE_ENV !== "development") return null;
  // eslint-disable-next-line @next/next/no-html-link-for-pages -- The UAT service returns HTML outside the Next page router.
  return <a className={styles.link} href="/__uat" title="Switch account" aria-label="Switch account">
    <Repeat2 size={16} aria-hidden="true" />
    <span>Switch account</span>
  </a>;
}
