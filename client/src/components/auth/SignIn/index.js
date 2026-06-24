// src/components/auth/SignIn/index.jsx
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../Providers/ThemeProvider";
import { useLoginMutation } from "../../../store/rtk/sessionApi";

import CompanySelect from "../../company/CompanySelect";
import ForgotPasswordModal from "../ForgotPasswordModal";
import { TextField, EmailField, PasswordField } from "../../ui/fields";
import s from "../../../styles/formGlass.module.css";

// Компонент InputField: оборачивает Formik-поле в стандартизированный field-компонент.
// dual-mode onChange: пробрасываем event в Formik (handleChange), чтобы touched/errors работали 1:1.
function InputField({ name, label, type = "text", autoComplete }) {
  const [field, meta] = useField(name);
  const Cmp = type === "email" ? EmailField : type === "password" ? PasswordField : TextField;
  return (
    <Cmp
      name={name}
      label={label}
      autoComplete={autoComplete}
      value={field.value}
      onChange={(value, event) => field.onChange(event)}
      onBlur={field.onBlur}
      error={meta.touched && meta.error ? meta.error : undefined}
    />
  );
}

function isI18nKey(value) {
  return /^[a-z][\w-]*(\.[\w-]+)+$/i.test(String(value || ''));
}

function resolveLoginErrorMessage(error, t) {
  const msgFromServer =
    error?.data?.error ||
    error?.data?.message ||
    error?.error ||
    error?.message ||
    null;

  if (!msgFromServer) return t("errors.loginFailed");

  if (isI18nKey(msgFromServer)) {
    const translated = t(msgFromServer);
    return translated && translated !== msgFromServer
      ? translated
      : t("errors.loginFailed");
  }

  if (/unauthorized|invalid credentials|login failed/i.test(msgFromServer)) {
    return t("errors.loginFailed");
  }

  return msgFromServer;
}

// Компонент SignIn: отвечает за отображение UI и обработку взаимодействий пользователя.
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

    // handleLogin: обработчик пользовательского действия.
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

      setStatus(resolveLoginErrorMessage(e, t));
    } finally {
      setSubmitting(false);
    }
  };

    // confirmCompany: вспомогательная логика компонента.
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
