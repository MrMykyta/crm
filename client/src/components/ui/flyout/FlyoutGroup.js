import styles from "./HoverFlyout.module.css";

export default function FlyoutGroup({ children, label }) {
  return (
    <section className={styles.flyoutGroup}>
      {label ? <div className={styles.flyoutGroupTitle}>{label}</div> : null}
      <div className={styles.flyoutList}>{children}</div>
    </section>
  );
}
