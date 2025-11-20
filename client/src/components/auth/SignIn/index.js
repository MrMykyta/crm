// src/components/auth/SignIn/index.jsx
import { Formik, Form, useField, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../Providers/ThemeProvider";
import { useLoginMutation } from "../../../store/rtk/sessionApi";

import CompanySelect from "../../company/CompanySelect";
import ForgotPasswordModal from "../ForgotPasswordModal";
import s from "../../../styles/formGlass.module.css";

function InputField({ name, label, type = "text", autoComplete }) {
  const [field] = useField(name);
  const filled = (field.value ?? "") !== "";
  return (
    <div className={`${s.field} ${filled ? s.filled : ""}`}>
      <input
        {...field}
        type={type}
        autoComplete={autoComplete}
        placeholder=" "
      />
      <label>{label}</label>
      <ErrorMessage name={name} component="div" className={s.err} />
    </div>
  );
}

export default function SignIn({ onSwitch }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hydrateFromServer } = useTheme();

  const [companiesModal, setCompaniesModal] = useState({
    open: false,
    list: [],
    creds: null,
  });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [emailForForgot, setEmailForForgot] = useState("");

  const [login, { isLoading }] = useLoginMutation();

  const schema = Yup.object({
    email: Yup.string()
      .email(t("common.invalidEmail"))
      .required(t("common.required")),
    password: Yup.string()
      .min(6, t("common.tooShort"))
      .required(t("common.required")),
  });

  const initialValues = { email: "", password: "" };

  // единый "финиш логина"
  const finishLogin = async () => {
    try {
      await hydrateFromServer();
    } catch {
      // не блокируем логин, если темы нет
    }
    window.dispatchEvent(new Event("auth:logged-in"));
    navigate("/main/pulpit", { replace: true });
  };

  const handleLogin = async (values, { setSubmitting, setStatus }) => {
    setStatus(null);
    try {
      const res = await login({
        email: values.email,
        password: values.password,
      }).unwrap();

      // нормализуем payload (учёт варианта { data: {...} })
      const payload = res?.data ?? res;

      // кейс выбора компании
      if (payload?.selectCompany && Array.isArray(payload.companies)) {
        setCompaniesModal({
          open: true,
          list: payload.companies,
          creds: values,
        });
        return;
      }

      await finishLogin();
    } catch (e) {
      console.error("[SignIn] login error", e);

      // аккуратно собираем текст ошибки
      const msgFromServer =
        e?.data?.error ||
        e?.error ||
        e?.message ||
        null;

      // если пришёл понятный текст — показываем как есть,
      // если нет — берём локализованный дефолт.
      const finalMsg =
        msgFromServer && !msgFromServer.startsWith("auth.")
          ? msgFromServer
          : t("errors.loginFailed");

      setStatus(finalMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCompany = async (choice) => {
    if (!choice) {
      setCompaniesModal((m) => ({ ...m, open: false }));
      return;
    }

    if (choice === "__create__") {
      setCompaniesModal((m) => ({ ...m, open: false }));
      navigate("/auth/company-setup");
      return;
    }

    try {
      const { creds } = companiesModal;
      setCompaniesModal((m) => ({ ...m, open: false }));
      await login({
        email: creds.email,
        password: creds.password,
        companyId: choice,
      }).unwrap();
      await finishLogin();
    } catch (e) {
      console.error("[SignIn] company confirm error", e);
      // если упало — снова открываем выбор
      setCompaniesModal((m) => ({ ...m, open: true }));
    }
  };

  return (
    <>
      <Formik
        initialValues={initialValues}
        validationSchema={schema}
        onSubmit={handleLogin}
      >
        {({ isSubmitting, status, values }) => (
          <Form className={s.form}>
            <InputField
              name="email"
              label={t("common.email")}
              type="email"
              autoComplete="email"
            />
            <InputField
              name="password"
              label={t("common.password")}
              type="password"
              autoComplete="current-password"
            />

            {status && <div className={s.err}>{status}</div>}

            <button
              className={s.btn}
              type="submit"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading
                ? t("common.signingIn")
                : t("auth.signIn")}
            </button>

            <div className={s.footerRow}>
              <button type="button" className={s.link} onClick={onSwitch}>
                {t("auth.createAccount")}
              </button>
              <button
                type="button"
                className={s.ghost}
                onClick={() => {
                  setEmailForForgot(values.email);
                  setForgotOpen(true);
                }}
              >
                {t("auth.forgot")}
              </button>
            </div>
          </Form>
        )}
      </Formik>

      <ForgotPasswordModal
        open={forgotOpen}
        initialEmail={emailForForgot}
        onClose={() => setForgotOpen(false)}
      />

      <CompanySelect
        open={companiesModal.open}
        companies={companiesModal.list}
        onConfirm={confirmCompany}
        onCancel={() =>
          setCompaniesModal((m) => ({ ...m, open: false }))
        }
      />
    </>
  );
}