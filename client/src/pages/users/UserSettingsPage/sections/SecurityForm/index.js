// src/pages/UserSettingsPage/sections/SecurityForm.jsx
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import s from "../../UserSettingsPage.module.css";
import { useTranslation } from "react-i18next";

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
        {({ isSubmitting }) => (
          <Form>
            <div className={s.grid}>
              <div className={s.field}>
                <label className={s.label}>{t("settings.security.current")}</label>
                <Field className={s.input} name="current" type="password" />
                <ErrorMessage name="current" component="div" className={s.err} />
              </div>

              <div className={s.field}>
                <label className={s.label}>{t("settings.security.new")}</label>
                <Field className={s.input} name="next" type="password" />
                <ErrorMessage name="next" component="div" className={s.err} />
              </div>

              <div className={`${s.field} ${s.full}`}>
                <label className={s.label}>{t("settings.security.confirm")}</label>
                <Field className={s.input} name="confirm" type="password" />
                <ErrorMessage name="confirm" component="div" className={s.err} />
              </div>
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