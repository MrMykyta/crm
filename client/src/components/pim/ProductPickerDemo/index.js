import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProductPicker from '../ProductPicker';
import s from './ProductPickerDemo.module.css';

export default function ProductPickerDemo() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);

  return (
    <div className={s.shell}>
      <ProductPicker onSelect={setSelected} />
      <div className={s.result}>
        <div className={s.resultGrid}>
          <div className={s.cell}>
            <span className={s.label}>{t('productPicker.product')}</span>
            <span className={s.value}>{selected?.productName || '—'}</span>
          </div>
          <div className={s.cell}>
            <span className={s.label}>{t('productPicker.variant')}</span>
            <span className={s.value}>{selected?.variantLabel || '—'}</span>
          </div>
          <div className={s.cell}>
            <span className={s.label}>SKU</span>
            <span className={s.value}>{selected?.sku || '—'}</span>
          </div>
          <div className={s.cell}>
            <span className={s.label}>{t('productPicker.productId')}</span>
            <span className={s.value}>{selected?.productId || '—'}</span>
          </div>
          <div className={s.cell}>
            <span className={s.label}>{t('productPicker.variantId')}</span>
            <span className={s.value}>{selected?.variantId || '—'}</span>
          </div>
          <div className={s.cell}>
            <span className={s.label}>EAN</span>
            <span className={s.value}>{selected?.ean || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
