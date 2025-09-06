// src/pages/UserSettingsPage/sections/ProfileForm.jsx
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import s from "../../UserSettingsPage.module.css";
import { useTranslation } from "react-i18next";

export default function ProfileForm({ user, onSave }) {
  const { t } = useTranslation();

  const initial = {
    firstName: user?.firstName || "",
    lastName : user?.lastName  || "",
    email    : user?.email     || "",
  };

  const schema = Yup.object({
    firstName: Yup.string().max(64, t("common.tooShort")),
    lastName : Yup.string().max(64, t("common.tooShort")),
    email    : Yup.string().email(t("common.invalidEmail")).required(t("common.required")),
  });

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      await onSave?.(values); // ожидается api.updateProfile(values)
    } finally { setSubmitting(false); }
  };

  return (
    <section className={s.section}>
      <h3>{t("settings.profile.title")}</h3>
      <Formik initialValues={initial} validationSchema={schema} onSubmit={handleSubmit} enableReinitialize>
        {({ isSubmitting }) => (
          <Form>
            <div className={s.grid}>
              <div className={s.field}>
                <label className={s.label}>{t("settings.profile.firstName")}</label>
                <Field className={s.input} name="firstName" placeholder={t("settings.profile.firstNamePH")} />
                <ErrorMessage name="firstName" component="div" className={s.err} />
              </div>

              <div className={s.field}>
                <label className={s.label}>{t("settings.profile.lastName")}</label>
                <Field className={s.input} name="lastName" placeholder={t("settings.profile.lastNamePH")} />
                <ErrorMessage name="lastName" component="div" className={s.err} />
              </div>

              <div className={`${s.field} ${s.full}`}>
                <label className={s.label}>{t("common.email")}</label>
                <Field className={s.input} type="email" name="email" placeholder="email@example.com" />
                <ErrorMessage name="email" component="div" className={s.err} />
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
    </section>
  );
}