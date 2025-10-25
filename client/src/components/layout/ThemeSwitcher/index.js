import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from './ThemeSwitcher.module.css';

const THEME_KEY = 'theme'; // 'system' | 'light' | 'dark'

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode) {
  localStorage.setItem(THEME_KEY, 'system');
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.background =
    getComputedStyle(document.documentElement).getPropertyValue('--bg');
}

export default function ThemeSwitcher() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(() => localStorage.getItem(THEME_KEY) || 'system');
  const [resolved, setResolved] = useState(() => (mode === 'system' ? getSystemTheme() : mode));
  const ref = useRef(null);

  // первичное применение
  useEffect(() => {
    applyTheme(mode);
    setResolved(mode === 'system' ? getSystemTheme() : mode);
  }, [mode]); 

  // слушаем смену системной темы, если выбран system
  useEffect(() => {
    if (mode !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const sys = getSystemTheme();
      setResolved(sys);
      applyTheme('system');
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [mode]);

  // закрытие при клике вне
  useEffect(() => {
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

  const change = (m) => {
    setMode(m);
    localStorage.setItem(THEME_KEY, m);
    applyTheme(m);
    setResolved(m === 'system' ? getSystemTheme() : m);
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