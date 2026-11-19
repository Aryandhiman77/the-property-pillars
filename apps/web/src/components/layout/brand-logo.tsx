import styles from "./brand-logo.module.css";

export function BrandLogo({width = 188}: {width?: number}) {
  return <span className={styles.logo} role="img" aria-label="The Property Pillar" style={{width}} />;
}
