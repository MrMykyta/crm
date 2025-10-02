import React, { useEffect, useRef } from 'react';
import s from './Modal.module.css';

/** Локальная кнопка: variant="primary"|"secondary" */
function Button({ variant = 'secondary', children, className = '', ...props }) {
  const cls = variant === 'primary' ? s.primary : s.btn;
  return (
    <button className={`${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

export default function Modal({
  open,
  onClose,
  title,
  size = 'md',
  footer,
  closeOnOverlay = true,
  children,
}) {
  const overlayRef = useRef(null);

  // Body lock (без сдвига и скролла фона)
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // компенсируем исчезновение скроллбара, чтобы контент не дёргался
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeCls = s[size] || s.md;

  // Закрытие по клику на подложку
  const handleOverlayClick = (e) => {
    if (!closeOnOverlay) return;
    // кликаем именно по overlay, а не по контенту
    if (e.target === overlayRef.current) onClose?.();
  };

  return (
    <div className={s.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={s.content} onClick={(e)=>e.stopPropagation()}>
        <div className={`${s.inner} ${sizeCls}`} role="dialog" aria-modal="true">
          <div className={s.header}>
            <div className={s.title}>{title}</div>
            <button className={s.closeBtn} onClick={onClose} aria-label="Close">×</button>
          </div>

          <div className={s.body}>
            {children}
          </div>

          <div className={s.footer}>
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

Modal.Button = Button;