// src/pages/UserSettingsPage/sections/NotificationsForm.jsx
import { Formik, Form, Field } from "formik";
import s from "../../UserSettingsPage.module.css";
import { useTranslation } from "react-i18next";

export default function NotificationsForm({ initial, onSave }) {
  const { t } = useTranslation();

  const init = {
    email: initial?.email ?? true,
    push : initial?.push  ?? false,
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      await onSave?.(values); // ожидается saveMyPreferences({ notifications: values })
    } finally { setSubmitting(false); }
  };

  return (
    <section className={s.section}>
      <h3>{t("settings.notifications.title")}</h3>
      <Formik initialValues={init} enableReinitialize onSubmit={handleSubmit}>
        {({ isSubmitting }) => (
          <Form>
            <label className={s.row}>
              <Field type="checkbox" name="email" /> {t("settings.notifications.email")}
            </label>
            <label className={s.row}>
              <Field type="checkbox" name="push" /> {t("settings.notifications.push")}
            </label>

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