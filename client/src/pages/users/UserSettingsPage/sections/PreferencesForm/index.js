// src/pages/UserSettingsPage/sections/PreferencesForm.jsx
import React from "react";
import { Formik, Form } from "formik";
import s from "../../UserSettingsPage.module.css";
import { useTranslation } from "react-i18next";
import { SelectField } from "../../../../../components/ui/fields";

// Компонент PreferencesForm: отвечает за отображение UI и обработку взаимодействий пользователя.
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
            <SelectField
              name="language"
              label={t("settings.preferences.language")}
              className={s.field}
              value={values.language || i18n.language}
              options={languageOptions}
              onValueChange={async (val) => {
                setFieldValue("language", val);
                await i18n.changeLanguage(val); // применяем сразу
              }}
              placeholder={t("common.select")}
            />

            {/* Тема оформления */}
            <SelectField
              name="themeMode"
              label={t("settings.preferences.theme")}
              className={s.field}
              value={values.themeMode || "system"}
              options={themeOptions}
              onValueChange={(val) => setFieldValue("themeMode", val)}
              placeholder={t("common.select")}
            />
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
