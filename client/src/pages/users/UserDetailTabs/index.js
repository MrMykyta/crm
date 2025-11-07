// src/pages/users/UserDetailTabs.jsx
import { useGetMyPreferencesQuery, useSaveMyPreferencesMutation } from "../../../store/rtk/userApi";
import AppearanceForm from "../UserSettingsPage/sections/AppearanceForm";
import NotificationsForm from "../UserSettingsPage/sections/NotificationsForm";
import PreferencesForm from "../UserSettingsPage/sections/PreferencesForm";
import SecurityForm from "../UserSettingsPage/sections/SecurityForm";

export default function UserDetailTabs({ tab }) {
  const { data: prefs, isFetching } = useGetMyPreferencesQuery();
  const [saveMyPreferences] = useSaveMyPreferencesMutation();

  if (isFetching && !prefs) {
    return <div style={{padding:12, color:"var(--muted)"}}>Loading…</div>;
  }

  const savePrefs = async (patch) => {
    const next = { ...(prefs || {}), ...(patch || {}) };
    await saveMyPreferences(next).unwrap();
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
    return <SecurityForm onSave={async ()=>{/* реализуешь api.changePassword */}} />;
  }

  return <div style={{padding:16, color:"var(--muted)"}}>Тут будет описание пользователя.</div>;
}