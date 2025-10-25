import CompanySetup from '../../../components/company/CompanySetup';
import LanguageSwitcher from '../../../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import ThemeSwitcher from '../../../components/layout/ThemeSwitcher';
import s from '../../../styles/AuthPage.module.css';

export default function CompanySetupPage({setUser}) {
  const { t } = useTranslation();
  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.body}>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <LanguageSwitcher />
                <ThemeSwitcher />
            </div>
          <div className={s.cardHeader}>
            <h2 className={s.title}>{t('company.title')}</h2>
            <p className={s.subtitle}>{t('company.subtitle')}</p>
          </div>
          <CompanySetup setUser={setUser}/>
        </div>
      </div>
    </div>
  );
}