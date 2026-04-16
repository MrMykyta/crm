import React from 'react';
import clsx from 'clsx';
import s from './LinkCell.module.css';

// Компонент LinkCell: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function LinkCell({
  primary,
  secondary,
  onClick,
  ariaLabel,
  showChevron = true,
  className,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={clsx(s.rowLink, className)}
    >
      <div className={s.primaryWrap}>
        <span className={s.primary}>{primary}</span>
        {showChevron && <span className={s.chevron} aria-hidden>›</span>}
      </div>
      {secondary ? <div className={s.secondary}>{secondary}</div> : null}
    </button>
  );
}
