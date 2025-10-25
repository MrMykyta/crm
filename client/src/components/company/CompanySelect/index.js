import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CompanySelect.module.css';

export default function CompanySelectModal({ open, companies = [], onConfirm, onCancel }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(companies[0]?.companyId || null);
  const firstBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setSelected(companies[0]?.companyId || null);
    setTimeout(() => firstBtnRef.current?.focus(), 0);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open, companies]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="cmp-title">
      <div className={styles.modal}>
        <h3 id="cmp-title" className={styles.title}>
          {t('company.chooseTitle', 'Выберите компанию')}
        </h3>
        <p className={styles.subtitle}>
          {t('company.chooseSubtitle', 'Выберите компанию для продолжения')}
        </p>

        <div className={styles.list} role="listbox" aria-label={t('company.chooseTitle')}>
          {companies.map((c) => {
            const active = selected === c.companyId;
            return (
              <label
                key={c.companyId}
                className={`${styles.item} ${active ? styles.active : ''}`}
                role="option"
                aria-selected={active}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelected(c.companyId);
                    e.preventDefault();
                  }
                }}
              >
                {/* скрытый нативный радио */}
                <input
                  className={styles.inputHidden}
                  type="radio"
                  name="company"
                  value={c.companyId}
                  checked={active}
                  onChange={() => setSelected(c.companyId)}
                  aria-hidden="true"
                  tabIndex={-1}
                />
                {/* кастомный кружок */}
                <span className={`${styles.radio} ${active ? styles.radioChecked : ''}`} aria-hidden="true" />
                <div className={styles.meta}>
                  <div className={styles.name}>{c.name}</div>
                  <div className={styles.role}>{c.role}</div>
                </div>
              </label>
            );
          })}
        </div>

        <div className={styles.actions}>
          <button
            ref={firstBtnRef}
            className={styles.primary}
            disabled={!selected}
            onClick={() => onConfirm?.(selected)}
          >
            {t('common.continue', 'Продолжить')}
          </button>
          <button className={styles.secondary} onClick={onCancel}>
            {t('common.cancel', 'Отмена')}
          </button>
        </div>
      </div>
    </div>
  );
}