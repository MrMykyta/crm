// src/components/layout/SidebarTooltip.jsx
import { createPortal } from "react-dom";
import styles from "./SidebarTooltip.module.css";

export default function SidebarTooltip({ visible, text, x, y }) {
  if (!visible) return null;
  return createPortal(
    <div className={styles.tooltip} style={{ top: y, left: x }}>
      {text}
      <span className={styles.arrow} />
    </div>,
    document.body
  );
}