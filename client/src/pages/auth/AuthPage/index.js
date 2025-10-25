import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SignIn from '../../../components/auth/SignIn';
import SignUp from '../../../components/auth/SignUp';
import LanguageSwitcher from '../../../components/LanguageSwitcher';
import ThemeSwitcher from '../../../components/layout/ThemeSwitcher';
import s from '../../../styles/AuthPage.module.css';

export default function AuthPage({ setUser }) {
  const [tab, setTab] = useState('signin');
  const { t } = useTranslation();

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>

        <div className={s.tabs}>
          <button
            className={`${s.tab} ${tab==='signup' ? s.active : ''}`}
            onClick={() => setTab('signup')}
          >
            {t('auth.signup')}
          </button>
          <button
            className={`${s.tab} ${tab==='signin' ? s.active : ''}`}
            onClick={() => setTab('signin')}
          >
            {t('auth.signin')}
          </button>
        </div>

        <div className={s.body}>
          {tab === 'signup'
            ? <SignUp onLogin={setUser} /> 
            : <SignIn onSwitch={() => setTab('signup')} onLogin={setUser} />}
        </div>
      </div>
    </div>
  );
}