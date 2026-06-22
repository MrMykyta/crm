// src/pages/UserSettingsPage/sections/NotificationsForm.jsx
import { Formik, Form } from "formik";
import s from "../../UserSettingsPage.module.css";
import { useTranslation } from "react-i18next";
import { CheckboxField } from "../../../../../components/ui/fields";

// Компонент NotificationsForm: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function NotificationsForm({ initial, onSave }) {
  const { t } = useTranslation();

  const init = {
    email: initial?.email ?? true,
    push : initial?.push  ?? false,
  };

    // handleSubmit: обработчик пользовательского действия.
const handleSubmit = async (values, { setSubmitting }) => {
    try {
      await onSave?.(values); // ожидается saveMyPreferences({ notifications: values })
    } finally { setSubmitting(false); }
  };

  return (
    <section className={s.section}>
      <h3>{t("settings.notifications.title")}</h3>
      <Formik initialValues={init} enableReinitialize onSubmit={handleSubmit}>
        {({ values, handleChange, handleBlur, isSubmitting }) => (
          <Form>
            <CheckboxField
              name="email"
              label={t("settings.notifications.email")}
              checked={values.email}
              onChange={(value, event) => handleChange(event)}
              onBlur={handleBlur}
              disabled={isSubmitting}
              className={s.row}
            />
            <CheckboxField
              name="push"
              label={t("settings.notifications.push")}
              checked={values.push}
              onChange={(value, event) => handleChange(event)}
              onBlur={handleBlur}
              disabled={isSubmitting}
              className={s.row}
            />

            <div className={s.actions} style={{ marginTop: 12 }}>
              <button className={s.primary} type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </section>
  );
}
