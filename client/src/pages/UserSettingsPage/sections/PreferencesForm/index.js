// src/pages/UserSettingsPage/sections/PreferencesForm.jsx
import { Formik, Form } from "formik";
import s from "../../UserSettingsPage.module.css";
import { useTranslation } from "react-i18next";

export default function PreferencesForm({ initial, onSave }) {
  const { t, i18n } = useTranslation();

  return (
    <Formik initialValues={initial} enableReinitialize onSubmit={onSave}>
      {({ values, setFieldValue, isSubmitting }) => (
        <Form>
          <div className={s.grid}>
            <div className={s.field}>
              <label className={s.label}>{t('settings.preferences.language')}</label>
              <select
                className={s.input}
                value={values.language || i18n.language}
                onChange={async (e)=>{
                  setFieldValue("language", e.target.value);
                  await i18n.changeLanguage(e.target.value); // применяем сразу
                }}
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
                <option value="pl">Polski</option>
                <option value="ua">Українська</option>
              </select>
            </div>

            <div className={s.field}>
              <label className={s.label}>{t('settings.preferences.theme')}</label>
              <select
                className={s.input}
                value={values.themeMode || "system"}
                onChange={(e)=> setFieldValue("themeMode", e.target.value)}
              >
                <option value="system">{t('theme.auto')}</option>
                <option value="dark">{t('theme.dark')}</option>
                <option value="light">{t('theme.light')}</option>
              </select>
            </div>
          </div>

          <div className={s.actions}>
            <button className={s.primary} type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
}