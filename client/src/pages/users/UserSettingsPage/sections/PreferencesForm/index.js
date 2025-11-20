// src/pages/UserSettingsPage/sections/PreferencesForm.jsx
import React from "react";
import { Formik, Form } from "formik";
import s from "../../UserSettingsPage.module.css";
import { useTranslation } from "react-i18next";
import ThemedSelect from "../../../../../components/inputs/RadixSelect";

export default function PreferencesForm({ initial, onSave }) {
  const { t, i18n } = useTranslation();

  const languageOptions = [
    { value: "ru", label: "Русский" },
    { value: "en", label: "English" },
    { value: "pl", label: "Polski" },
    { value: "ua", label: "Українська" },
  ];

  const themeOptions = [
    { value: "system", label: t("theme.auto") },
    { value: "dark", label: t("theme.dark") },
    { value: "light", label: t("theme.light") },
  ];

  return (
    <Formik initialValues={initial} enableReinitialize onSubmit={onSave}>
      {({ values, setFieldValue, isSubmitting }) => (
        <Form>
          <div className={s.grid}>
            {/* Язык интерфейса */}
            <div className={s.field}>
              <label className={s.label}>
                {t("settings.preferences.language")}
              </label>
              <ThemedSelect
                className={s.input}
                value={values.language || i18n.language}
                options={languageOptions}
                onChange={async (val) => {
                  setFieldValue("language", val);
                  await i18n.changeLanguage(val); // применяем сразу
                }}
                placeholder={t("common.select")}
              />
            </div>

            {/* Тема оформления */}
            <div className={s.field}>
              <label className={s.label}>
                {t("settings.preferences.theme")}
              </label>
              <ThemedSelect
                className={s.input}
                value={values.themeMode || "system"}
                options={themeOptions}
                onChange={(val) => setFieldValue("themeMode", val)}
                placeholder={t("common.select")}
              />
            </div>
          </div>

          <div className={s.actions}>
            <button className={s.primary} type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
}