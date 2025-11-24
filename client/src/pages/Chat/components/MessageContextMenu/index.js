// src/pages/Chat/components/MessageContextMenu.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import s from "../../ChatPage.module.css";

export default function MessageContextMenu({
  open,
  anchorRect,            // DOMRect пузыря
  boundsRect,            // DOMRect зоны сообщений (listRef)
  side = "other",        // 'me' | 'other'
  clickY,                // clientY клика
  message,
  onClose,
  onReply,
  onCopy,
  onEdit,
  onPin,
  onForward,
  onSelect,
  onDelete,
}) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x: -9999, y: -9999 });

  useEffect(() => {
    if (!open || !anchorRect) return;
    const el = menuRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;

    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const margin = 8;
    const gap = 8;

    setPos({ x: -9999, y: -9999 });

    const calc = () => {
      const menuRect = el.getBoundingClientRect();
      const menuW = menuRect.width || 220;
      const menuH = menuRect.height || 260;

      // ===== Y: вокруг клика, но внутри boundsRect (между header и input) =====
      const baseY =
        typeof clickY === "number"
          ? clickY
          : anchorRect.top + anchorRect.height / 2;

      let y = baseY - menuH / 2;

      // границы по Y
      let topLimit = margin;
      let bottomLimit = vh - menuH - margin;

      if (boundsRect) {
        topLimit = boundsRect.top + margin;
        bottomLimit = boundsRect.bottom - menuH - margin;
      }

      if (bottomLimit < topLimit) {
        bottomLimit = topLimit;
      }

      if (y < topLimit) y = topLimit;
      if (y > bottomLimit) y = bottomLimit;

      // ===== X: жёстко относительно пузыря =====
      let x;
      if (side === "me") {
        // мои: слева от пузыря
        x = anchorRect.left - gap - menuW;
        if (x < margin) x = margin;
        if (x + menuW + margin > vw) x = vw - menuW - margin;
      } else {
        // собеседник: справа от пузыря
        x = anchorRect.right + gap;
        if (x + menuW + margin > vw) x = vw - menuW - margin;
        if (x < margin) x = margin;
      }

      setPos({ x, y });
    };

    requestAnimationFrame(calc);
  }, [open, anchorRect, boundsRect, side, clickY]);

  if (!open || !message) return null;
  if (typeof document === "undefined") return null;

  const handle = (cb) => () => {
    if (cb) cb(message);
  };

  const menuNode = (
    <div className={s.ctxOverlay} onClick={onClose}>
      <div
        ref={menuRef}
        className={s.ctxMenu}
        data-side={side}
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={s.ctxMenuItem}
          onClick={handle(onReply)}
        >
          Ответить
        </button>

        <button
          type="button"
          className={s.ctxMenuItem}
          onClick={handle(onCopy)}
        >
          Копировать
        </button>

        <button
          type="button"
          className={s.ctxMenuItem}
          onClick={handle(onEdit)}
        >
          Изменить
        </button>

        <button
          type="button"
          className={s.ctxMenuItem}
          onClick={handle(onPin)}
        >
          Закрепить
        </button>

        <button
          type="button"
          className={s.ctxMenuItem}
          onClick={handle(onForward)}
        >
          Переслать
        </button>

        <button
          type="button"
          className={s.ctxMenuItem}
          onClick={handle(onSelect)}
        >
          Выбрать
        </button>

        <button
          type="button"
          className={`${s.ctxMenuItem} ${s.ctxMenuItemDanger}`}
          onClick={handle(onDelete)}
        >
          Удалить
        </button>
      </div>
    </div>
  );

  return createPortal(menuNode, document.body);
}