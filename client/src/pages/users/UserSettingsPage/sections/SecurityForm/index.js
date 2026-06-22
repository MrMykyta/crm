// src/pages/UserSettingsPage/sections/SecurityForm.jsx
import { Formik, Form } from "formik";
import * as Yup from "yup";
import s from "../../UserSettingsPage.module.css";
import { useTranslation } from "react-i18next";
import { PasswordField } from "../../../../../components/ui/fields";

// Компонент SecurityForm: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function SecurityForm({ onSave }) {
  const { t } = useTranslation();

  const initial = { current: "", next: "", confirm: "" };

  const schema = Yup.object({
    current: Yup.string().required(t("common.required")),
    next: Yup.string().min(6, t("common.atLeast", { n: 6 })).required(t("common.required")),
    confirm: Yup.string()
      .oneOf([Yup.ref("next")], t("auth.passwordsMustMatch"))
      .required(t("common.required")),
  });

    // handleSubmit: обработчик пользовательского действия.
const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      await onSave?.(values); // ожидается api.changePassword(values)
      resetForm();
    } finally { setSubmitting(false); }
  };

  return (
    <section className={s.section}>
      <h3>{t("settings.security.title")}</h3>
      <Formik initialValues={initial} validationSchema={schema} onSubmit={handleSubmit}>
        {({ values, touched, errors, handleChange, handleBlur, isSubmitting }) => (
          <Form>
            <div className={s.grid}>
              <PasswordField
                name="current"
                label={t("settings.security.current")}
                value={values.current}
                onChange={(value, event) => handleChange(event)}
                onBlur={handleBlur}
                error={touched.current && errors.current}
                disabled={isSubmitting}
                autoComplete="current-password"
                className={s.field}
                inputClassName={s.input}
              />

              <PasswordField
                name="next"
                label={t("settings.security.new")}
                value={values.next}
                onChange={(value, event) => handleChange(event)}
                onBlur={handleBlur}
                error={touched.next && errors.next}
                disabled={isSubmitting}
                autoComplete="new-password"
                className={s.field}
                inputClassName={s.input}
              />

              <PasswordField
                name="confirm"
                label={t("settings.security.confirm")}
                value={values.confirm}
                onChange={(value, event) => handleChange(event)}
                onBlur={handleBlur}
                error={touched.confirm && errors.confirm}
                disabled={isSubmitting}
                autoComplete="new-password"
                className={`${s.field} ${s.full}`}
                inputClassName={s.input}
              />
            </div>

            <div className={s.actions}>
              <button className={s.primary} type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("common.saving") : t("settings.security.update")}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </section>
  );
}
