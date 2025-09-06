import { useTranslation } from 'react-i18next';
import s from './KpiCards.module.css';

export default function KpiCards() {
  const { t } = useTranslation();
  return (
    <div className={s.card}>
      <div className={s.header}>
        <div>{t('widgets.kpi', 'Показатели')}</div>
        <div className="widgetDrag">⋮</div>
      </div>

      <div className={s.kpiRow}>
        {[
          { val:'42', label:t('kpi.leads','Leads') },
          { val:'18', label:t('kpi.deals','Deals') },
          { val:'7',  label:t('kpi.orders','Orders') },
        ].map((k,i)=>(
          <div key={i} className={s.kpi}>
            <div className={s.kpiVal}>{k.val}</div>
            <div className={s.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}