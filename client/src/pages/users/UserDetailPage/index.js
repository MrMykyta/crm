// src/pages/user/UserDetailTabs.jsx
import AppearanceForm from "../UserSettingsPage/sections/AppearanceForm";
import NotificationsForm from "../UserSettingsPage/sections/NotificationsForm";
import PreferencesForm from "../UserSettingsPage/sections/PreferencesForm";
import SecurityForm from "../UserSettingsPage/sections/SecurityForm";
import { getMyPreferences, saveMyPreferences } from "../../../api/user";
import { useEffect, useState } from "react";

export default function UserDetailTabs({ tab }) {
  const [prefs, setPrefs] = useState(null);

  useEffect(() => {
    (async () => {
      const p = await getMyPreferences().catch(()=> ({}));
      setPrefs(p || {});
    })();
  }, []);

  if (!prefs) return <div style={{padding:12, color:"var(--muted)"}}>Loading…</div>;

  const savePrefs = async (patch) => {
    const saved = await saveMyPreferences({ ...prefs, ...patch });
    setPrefs(saved);
  };

  if (tab === "appearance") {
    return (
      <AppearanceForm
        initial={{
          fontScale: prefs?.appearance?.fontScale ?? 100,
          backgroundPath: prefs?.appearance?.backgroundPath ?? prefs?.background?.url ?? "",
        }}
      />
    );
  }

  if (tab === "notifications") {
    return (
      <NotificationsForm
        initial={prefs?.notifications}
        onSave={(values)=> savePrefs({ notifications: values })}
      />
    );
  }

  if (tab === "preferences") {
    return (
      <PreferencesForm
        initial={{ language: prefs?.language, themeMode: prefs?.themeMode || "system" }}
        onSave={(values)=> savePrefs(values)}
      />
    );
  }

  if (tab === "security") {
    return <SecurityForm onSave={async ()=>{/* твоя реализация */}} />;
  }

  // дефолтная правая панель
  return <div style={{padding:16, color:"var(--muted)"}}>Тут будет описание пользователя.</div>;
}