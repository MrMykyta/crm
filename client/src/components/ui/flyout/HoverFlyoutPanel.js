import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./HoverFlyout.module.css";

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export default function HoverFlyoutPanel({
  open,
  anchorEl,
  children,
  title,
  placement = "right-start",
  collapsed = false,
  gap = 8,
  collapsedGap = 14,
  width = 292,
  zIndex = 72,
  closeDelayMs = 180,
  onMouseEnter,
  onMouseLeave,
  onClose,
}) {
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 480 });

  useEffect(() => {
    if (!open || !anchorEl) return undefined;
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      const maxH = Math.max(240, window.innerHeight - 32);
      const panelRect = panelRef.current?.getBoundingClientRect();
      const panelH = panelRect ? panelRect.height : Math.min(maxH, 420);
      const panelW = panelRect ? panelRect.width : width;
      const bottom = window.innerHeight - 16;
      const right = window.innerWidth - 16;
      let left = 16;
      let top = 16;

      if (placement === "bottom-center") {
        const centered = Math.round(r.left + (r.width / 2) - (panelW / 2));
        left = clamp(centered, 16, Math.max(16, right - panelW));
        top = Math.round(r.bottom + gap);
      } else if (placement === "bottom-start") {
        left = clamp(Math.round(r.left), 16, Math.max(16, right - panelW));
        top = Math.round(r.bottom + gap);
      } else {
        left = Math.round(r.right + (collapsed ? collapsedGap : gap));
        top = Math.round(r.top + (r.height / 2) - (panelH / 2));
      }

      top = clamp(top, 16, Math.max(16, bottom - panelH));
      setPosition({ top, left, maxHeight: maxH });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorEl, collapsed, collapsedGap, gap, mounted, placement, width]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const tm = setTimeout(() => setMounted(false), closeDelayMs);
    return () => clearTimeout(tm);
  }, [closeDelayMs, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const onDocClick = (event) => {
      if (panelRef.current && panelRef.current.contains(event.target)) return;
      if (anchorEl && anchorEl.contains(event.target)) return;
      onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [anchorEl, onClose, open]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={`${styles.flyout} ${visible ? styles.flyoutVisible : ""}`}
      style={{
        top: position.top,
        left: position.left,
        maxHeight: position.maxHeight,
        width,
        zIndex,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="menu"
      aria-label={title}
    >
      {title ? <div className={styles.flyoutTitle}>{title}</div> : null}
      <div className={styles.flyoutGroups}>{children}</div>
    </div>,
    document.body
  );
}
