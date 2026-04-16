import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../Providers/ThemeProvider';
import s from './ThemeSwitcher.module.css';

// Компонент ThemeSwitcher: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ThemeSwitcher() {
  const { t } = useTranslation();
  const { mode, setMode, resolved } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // закрытие при клике вне
  useEffect(() => {
        // onClick: вспомогательная логика компонента.
const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const items = [
    { key: 'system', label: t('theme.auto','System'), icon: '🖥️' },
    { key: 'light',  label: t('theme.light','Light'), icon: '☀️' },
    { key: 'dark',   label: t('theme.dark','Dark'),   icon: '🌙' }
  ];

  const current = items.find(i => i.key === (mode === 'system' ? resolved : mode)) || items[0];

    // change: вспомогательная логика компонента.
const change = (m) => {
    setMode(m);
    setOpen(false);
  };

  return (
    <div className={s.wrap} ref={ref}>
      <button className={s.trigger} onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={s.flag}>{current.icon}</span>
        <span className={s.code}>{(mode === 'system' ? t('theme.auto') : current.label).toUpperCase()}</span>
        <span className={s.arrow}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={s.dropdown} role="listbox" aria-label="Theme">
          {items.map(i => (
            <button
              key={i.key}
              className={`${s.item} ${mode === i.key ? s.active : ''}`}
              onClick={() => change(i.key)}
            >
              <span className={s.flag}>{i.icon}</span>
              <span className={s.label}>{i.label}</span>
              {mode === i.key && <span className={s.check}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

