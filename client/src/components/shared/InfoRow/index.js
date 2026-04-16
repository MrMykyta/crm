import React from 'react';
import s from './InfoRow.module.css';

// Компонент InfoRow: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function InfoRow({ label, value, muted }) {
  return (
    <div className={s.row}>
      <div className={s.label}>{label}</div>
      <div className={`${s.value} ${muted ? s.muted : ''}`}>{value || '—'}</div>
    </div>
  );
}

