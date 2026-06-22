// src/pages/UserSettingsPage/sections/ProfileForm.jsx
import { Formik, Form } from "formik";
import * as Yup from "yup";
import s from "../../UserSettingsPage.module.css";
import { useTranslation } from "react-i18next";
import { EmailField, TextField } from "../../../../../components/ui/fields";

// Компонент ProfileForm: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ProfileForm({ user, onSave }) {
  const { t } = useTranslation();

  const initial = {
    firstName: user?.firstName || "",
    lastName : user?.lastName  || "",
    email    : user?.emailRaw     || "",
  };

  const schema = Yup.object({
    firstName: Yup.string().max(64, t("common.tooShort")),
    lastName : Yup.string().max(64, t("common.tooShort")),
    email    : Yup.string().email(t("common.invalidEmail")).required(t("common.required")),
  });

    // handleSubmit: обработчик пользовательского действия.
const handleSubmit = async (values, { setSubmitting }) => {
    try {
      await onSave?.(values); // ожидается api.updateProfile(values)
    } finally { setSubmitting(false); }
  };

  return (
    <section className={s.section}>
      <h3>{t("settings.profile.title")}</h3>
      <Formik initialValues={initial} validationSchema={schema} onSubmit={handleSubmit} enableReinitialize>
        {({ values, touched, errors, handleChange, handleBlur, isSubmitting }) => (
          <Form>
            <div className={s.grid}>
              <TextField
                name="firstName"
                label={t("settings.profile.firstName")}
                value={values.firstName}
                onChange={(value, event) => handleChange(event)}
                onBlur={handleBlur}
                placeholder={t("settings.profile.firstNamePH")}
                error={touched.firstName && errors.firstName}
                disabled={isSubmitting}
                className={s.field}
                inputClassName={s.input}
              />

              <TextField
                name="lastName"
                label={t("settings.profile.lastName")}
                value={values.lastName}
                onChange={(value, event) => handleChange(event)}
                onBlur={handleBlur}
                placeholder={t("settings.profile.lastNamePH")}
                error={touched.lastName && errors.lastName}
                disabled={isSubmitting}
                className={s.field}
                inputClassName={s.input}
              />

              <EmailField
                name="email"
                label={t("common.email")}
                value={values.email}
                onChange={(value, event) => handleChange(event)}
                onBlur={handleBlur}
                placeholder="email@example.com"
                error={touched.email && errors.email}
                disabled={isSubmitting}
                className={`${s.field} ${s.full}`}
                inputClassName={s.input}
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
    </section>
  );
}
