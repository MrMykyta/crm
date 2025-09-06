import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CompanySelect.module.css';

export default function CompanySelectModal({ open, companies = [], onConfirm, onCancel }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(companies[0]?.companyId || null);
  const firstBtnRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSelected(companies[0]?.companyId || null);
      setTimeout(() => firstBtnRef.current?.focus(), 0);
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open, companies]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="cmp-title">
      <div className={styles.modal}>
        <h3 id="cmp-title" className={styles.title}>{t('company.chooseTitle', 'Select a company')}</h3>
        <p className={styles.subtitle}>{t('company.chooseSubtitle', 'Pick a company to continue')}</p>

        <div className={styles.list} role="listbox" aria-label={t('company.chooseTitle')}>
          {companies.map((c) => (
            <label key={c.companyId} className={`${styles.item} ${selected === c.companyId ? styles.active : ''}`}>
              <input
                type="radio"
                name="company"
                value={c.companyId}
                checked={selected === c.companyId}
                onChange={() => setSelected(c.companyId)}
              />
              <div className={styles.meta}>
                <div className={styles.name}>{c.name}</div>
                <div className={styles.role}>{c.role}</div>
              </div>
            </label>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            ref={firstBtnRef}
            className={styles.primary}
            disabled={!selected}
            onClick={() => onConfirm?.(selected)}
          >
            {t('common.continue', 'Continue')}
          </button>
          <button className={styles.secondary} onClick={onCancel}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button className={styles.link} onClick={() => onConfirm?.('__create__')}>
            {t('company.createNew', 'Create new company')}
          </button>
        </div>
      </div>
    </div>
  );
}