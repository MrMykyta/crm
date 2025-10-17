// src/pages/UserSettingsPage/index.jsx
import { useNavigate } from "react-router-dom";
import { X, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import s from "./UserSettingsPage.module.css";

import { getMyPreferences, saveMyPreferences } from "../../api/user";
import { useTheme } from "../../Providers/ThemeProvider";

import { useTopbar } from "../../Providers/TopbarProvider";

import AppearanceForm from "./sections/AppearanceForm";
import PreferencesForm from "./sections/PreferencesForm";
import ProfileForm from "./sections/ProfileForm";
import SecurityForm from "./sections/SecurityForm";
import NotificationsForm from "./sections/NotificationsForm";

const DEFAULT_APPEARANCE = { fontScale: 100 };
export default function UserSettingsPage({ user }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("profile");
  const [prefs, setPrefs] = useState(null);
  const { setTitle, setSubtitle, reset } = useTopbar(); // ← получаем методы провайдера
    
  useEffect(() => {
    setTitle(t('userMenu.settings'));  // можно ключ перевода: 'company.settings'
    return () => reset();            // при выходе вернуть дефолтное значение
  }, [setTitle, setSubtitle, reset]);

  const { setAppearance, setBackground, setMode } = useTheme();

  const navigate = useNavigate();
  const handleClose = () => navigate(-1);

  useEffect(() => {
    (async () => {
      const p = await getMyPreferences().catch(() => null);
      setPrefs(p || {});
    })();
  }, []);

  const currentTheme =
    prefs?.themeMode || localStorage.getItem("theme") || "system";

  // reset → авто (system) + сброс фона и масштаба
  const handleFactoryReset = async () => {
    setAppearance(DEFAULT_APPEARANCE);
    setBackground(null);
    setMode("system");
    localStorage.setItem("theme", "system");

    const saved = await saveMyPreferences({
      ...prefs,
      appearance: DEFAULT_APPEARANCE,
      background: null,
      themeMode: "system",
    });
    setPrefs(saved);
  };

  // общие сейверы
  const savePrefs = async (next) => {
    const saved = await saveMyPreferences({ ...prefs, ...next });
    setPrefs(saved);
  };

  if (!prefs) {
    return (
      <div className={s.wrap}>
        <div className={s.card}><div style={{padding:12, color:"var(--muted)"}}>Loading…</div></div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <button className={s.closeBtn} onClick={handleClose} aria-label="Close">
          <X size={18}/>
        </button>

        <div className={s.tabs}>
          <button className={`${s.tab} ${tab==='profile'?s.active:''}`} onClick={()=>setTab('profile')}>
            {t('settings.tabs.profile')}
          </button>
          <button className={`${s.tab} ${tab==='security'?s.active:''}`} onClick={()=>setTab('security')}>
            {t('settings.tabs.security')}
          </button>
          <button className={`${s.tab} ${tab==='notifications'?s.active:''}`} onClick={()=>setTab('notifications')}>
            {t('settings.tabs.notifications')}
          </button>
          <button className={`${s.tab} ${tab==='appearance'?s.active:''}`} onClick={()=>setTab('appearance')}>
            {t('settings.tabs.appearance')}
          </button>
          <button className={`${s.tab} ${tab==='preferences'?s.active:''}`} onClick={()=>setTab('preferences')}>
            {t('settings.tabs.preferences') || 'Предпочтения'}
          </button>
        </div>

        <div className={s.body}>
          {tab==='profile' && (
            <ProfileForm
              user={user}
              onSave={async (payload)=>{/* await api.updateProfile(payload) */}}
            />
          )}

          {tab==='security' && <SecurityForm onSave={async ()=>{/* await api.changePassword */}} />}

          {tab==='notifications' && (
            <NotificationsForm
              initial={prefs?.notifications}
              onSave={async (values)=> savePrefs({ notifications: values })}
            />
          )}

          {tab==='appearance' && (
            <section className={s.section}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
                <h3 style={{margin:0}}>{t('settings.appearance.title')}</h3>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:12, color:'var(--muted)'}}>Текущая тема: {currentTheme}</span>
                  <button type="button" className={s.ghost} onClick={handleFactoryReset}>
                    <RotateCcw size={16}/> {t('common.reset') || 'Reset'}
                  </button>
                </div>
              </div>

              <AppearanceForm
                initial={{
                  fontScale: prefs?.appearance?.fontScale ?? 100,
                  backgroundUrl: prefs?.background?.url || "",
                }}
                onLiveChange={(partial) => {
                  if (partial.fontScale != null) setAppearance({ fontScale: partial.fontScale });
                  if (partial.backgroundUrl !== undefined) setBackground(partial.backgroundUrl ? { url: partial.backgroundUrl } : null);
                }}
                onSave={async (values)=>{
                  // фиксируем в БД
                  const next = {
                    appearance: { ...(prefs.appearance||{}), fontScale: values.fontScale },
                    background: values.backgroundUrl ? { url: values.backgroundUrl } : null,
                  };
                  await savePrefs(next);
                }}
              />
            </section>
          )}

          {tab==='preferences' && (
            <PreferencesForm
              initial={{
                language: prefs?.language,
                themeMode: currentTheme, // показываем что реально активно
              }}
              onSave={async (values)=>{
                // применяем сразу
                if (values.themeMode) {
                  setMode(values.themeMode);
                  localStorage.setItem('theme', values.themeMode);
                }
                if (values.language) {
                  // i18n.changeLanguage уже делаешь внутри формы
                }
                await savePrefs({ language: values.language, themeMode: values.themeMode });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}