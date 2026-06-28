import { useCallback, useEffect, useRef, useState } from "react";
import HoverFlyoutPanel from "./HoverFlyoutPanel";

export default function HoverFlyoutMenu({
  children,
  title,
  placement = "right-start",
  openOnHover = true,
  openOnFocus = true,
  openOnClick = true,
  closeDelayMs = 180,
  gap = 8,
  collapsedGap = 14,
  collapsed = false,
  width = 292,
  zIndex = 72,
  renderTrigger,
  onOpenChange,
}) {
  const anchorRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [open, setOpen] = useState(false);

  const setOpenState = useCallback((next) => {
    setOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);

  const openNow = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenState(true);
  }, [setOpenState]);

  const closeNow = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenState(false);
  }, [setOpenState]);

  const scheduleClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpenState(false);
      closeTimerRef.current = null;
    }, closeDelayMs);
  }, [closeDelayMs, setOpenState]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const triggerProps = {
    ref: anchorRef,
    ...(openOnHover ? { onMouseEnter: openNow, onMouseLeave: scheduleClose } : {}),
    ...(openOnFocus ? { onFocus: openNow, onBlur: scheduleClose } : {}),
    ...(openOnClick ? { onClick: openNow } : {}),
    "aria-haspopup": "menu",
    "aria-expanded": open,
  };

  return (
    <>
      {renderTrigger({
        open,
        close: closeNow,
        openNow,
        scheduleClose,
        ref: anchorRef,
        triggerProps,
      })}
      <HoverFlyoutPanel
        open={open}
        anchorEl={anchorRef.current}
        title={title}
        placement={placement}
        collapsed={collapsed}
        gap={gap}
        collapsedGap={collapsedGap}
        width={width}
        zIndex={zIndex}
        closeDelayMs={closeDelayMs}
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
        onClose={closeNow}
      >
        {typeof children === "function" ? children({ close: closeNow, open }) : children}
      </HoverFlyoutPanel>
    </>
  );
}
