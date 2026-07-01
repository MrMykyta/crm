import { useTranslation } from 'react-i18next';
import { User2 } from 'lucide-react';

import s from './MyAccountPage.module.css';

export default function MyAccountPage() {
  const { t } = useTranslation();

  return (
    <main className={s.page}>
      <section className={s.card}>
        <div className={s.icon} aria-hidden="true">
          <User2 size={24} />
        </div>
        <div>
          <p className={s.eyebrow}>{t('myAccount.eyebrow', 'Account')}</p>
          <h1>{t('myAccount.title', 'Личный кабинет')}</h1>
          <p>{t('myAccount.placeholder', 'Раздел находится в разработке.')}</p>
        </div>
      </section>
    </main>
  );
}
