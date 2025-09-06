import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from './LanguageSwitcher.module.css';

// простые emoji-флаги, можно заменить на svg-иконки
const langs = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'pl', label: 'Polski',  flag: '🇵🇱' },
  { code: 'ua', label: 'Українська', flag: '🇺🇦' }
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const cur = i18n.resolvedLanguage || i18n.language || 'en';
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentLang = langs.find(l => l.code === cur) || langs[0];

  const toggle = () => setOpen(o => !o);
  const changeLang = (lng) => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng;
    localStorage.setItem('lang', lng);
    setOpen(false);
  };

  // закрытие при клике вне
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={s.wrap} ref={ref}>
      <button className={s.trigger} onClick={toggle}>
        <span className={s.flag}>{currentLang.flag}</span>
        <span className={s.code}>{currentLang.code.toUpperCase()}</span>
        <span className={s.arrow}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={s.dropdown}>
          {langs.map(l => (
            <button
              key={l.code}
              onClick={() => changeLang(l.code)}
              className={`${s.item} ${l.code === cur ? s.active : ''}`}
            >
              <span className={s.flag}>{l.flag}</span>
              <span className={s.label}>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}