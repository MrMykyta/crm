// src/pages/auth/InviteAcceptPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";

import auth from "../../../styles/AuthPage.module.css";
import s from "./InviteAccept.module.css";

import {
  useCheckInvitationQuery,
  useAcceptInvitationMutation,
} from "../../../store/rtk/companyUsersApi";
import { setAuth } from "../../../store/slices/authSlice";
import { setApiSession } from "../../../store/rtk/crmApi";
import { bootstrapLoad } from "../../../store/slices/bootstrapSlice";

export default function InviteAcceptPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const token = params.get("token") || "";
  const hasToken = !!token;

  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState("");
  const [serverOk, setServerOk] = useState("");

  // Проверка инвайта через RTK Query (идёт через общий baseQueryWithReauth)
  const {
    data: checkData,
    isFetching: loading,
    error: checkError,
  } = useCheckInvitationQuery(token, { skip: !hasToken });

  // Мутация принятия инвайта
  const [acceptMutation] = useAcceptInvitationMutation();

  // Текст ошибки статуса
  useEffect(() => {
    if (!hasToken) return;

    if (checkError) {
      const msg =
        checkError?.data?.error ||
        checkError?.error ||
        "Не удалось проверить приглашение";
      setServerError(msg);
      return;
    }

    if (checkData && checkData.status && checkData.status !== "pending") {
      const reason =
        checkData.status === "accepted"
          ? "Приглашение уже принято."
          : checkData.status === "revoked"
          ? "Приглашение отозвано."
          : checkData.status === "expired"
          ? "Срок действия приглашения истёк."
          : "Некорректная ссылка приглашения.";
      setServerError(reason);
    } else {
      setServerError("");
    }
  }, [hasToken, checkError, checkData]);

  const userExists = !!checkData?.userExists;

  const Schema = useMemo(() => {
    if (userExists) {
      return Yup.object().shape({
        firstName: Yup.string().max(64, "Максимум 64 символа"),
        lastName: Yup.string().max(64, "Максимум 64 символа"),
      });
    }
    return Yup.object().shape({
      firstName: Yup.string().max(64, "Максимум 64 символа"),
      lastName: Yup.string().max(64, "Максимум 64 символа"),
      password: Yup.string()
        .min(8, "Минимум 8 символов")
        .required("Введите пароль"),
      confirm: Yup.string()
        .oneOf([Yup.ref("password")], "Пароли не совпадают")
        .required("Повторите пароль"),
    });
  }, [userExists]);

  const init = useMemo(
    () => ({
      firstName:
        checkData?.firstName || checkData?.existingUser?.firstName || "",
      lastName: checkData?.lastName || checkData?.existingUser?.lastName || "",
      password: "",
      confirm: "",
    }),
    [checkData]
  );

  const disabled = !hasToken || loading || !!serverError;

  return (
    <div className={`${auth.wrap} ${s.wrap}`}>
      <div className={`${auth.card} ${s.card}`}>
        <header className={auth.cardHeader}>
          <h1 className={auth.title}>Принятие приглашения</h1>
          <p className={auth.subtitle}>
            {userExists
              ? "Нажмите «Принять приглашение», чтобы присоединиться к рабочему пространству."
              : "Установите пароль. Имя и фамилию можете скорректировать при необходимости."}
          </p>
        </header>

        <Formik
          initialValues={init}
          enableReinitialize
          validationSchema={Schema}
          onSubmit={async (values, { setSubmitting }) => {
            setServerError("");
            setServerOk("");
            try {
              const payload = { token };
              if (!userExists) {
                payload.password = values.password;
                payload.firstName = values.firstName?.trim();
                payload.lastName = values.lastName?.trim();
              } else {
                payload.firstName = values.firstName?.trim();
                payload.lastName = values.lastName?.trim();
              }

              const res = await acceptMutation(payload).unwrap();

              if (res?.accessToken || res?.tokens?.accessToken) {
                const accessToken =
                  res.accessToken ?? res.token ?? res.tokens?.accessToken ?? null;
                const refreshToken =
                  res.refreshToken ?? res.tokens?.refreshToken ?? null;
                const companyId =
                  res.activeCompanyId ?? res.companyId ?? null;
                const user = res.user ?? null;

                // Кладём в Redux + sessionCtx, чтобы весь UI сразу «увидел» авторизацию
                dispatch(
                  setAuth({ accessToken, refreshToken, companyId, user })
                );
                setApiSession({ token: accessToken, companyId });
                dispatch(bootstrapLoad());

                navigate("/main", { replace: true });
              } else {
                navigate("/auth", { replace: true });
              }
            } catch (e) {
              const msg =
                e?.data?.error ||
                e?.error ||
                e?.message ||
                "Ошибка принятия приглашения";
              setServerError(msg);
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting, isValid }) => (
            <Form className={s.form} noValidate>
              {checkData?.email && (
                <div className={s.emailLine}>
                  Приглашение на:{" "}
                  <span className={s.email}>{checkData.email}</span>
                </div>
              )}

              <div className={s.grid2}>
                <label className={s.label}>
                  <span className={s.caption}>Имя</span>
                  <Field className={s.input} name="firstName" placeholder="Иван" />
                  <ErrorMessage
                    name="firstName"
                    component="div"
                    className={s.fieldError}
                  />
                </label>
                <label className={s.label}>
                  <span className={s.caption}>Фамилия</span>
                  <Field className={s.input} name="lastName" placeholder="Иванов" />
                  <ErrorMessage
                    name="lastName"
                    component="div"
                    className={s.fieldError}
                  />
                </label>
              </div>

              {!userExists && (
                <>
                  <div className={s.grid2}>
                    <label className={s.label}>
                      <span className={s.caption}>Пароль</span>
                      <Field
                        className={s.input}
                        type={showPwd ? "text" : "password"}
                        name="password"
                        placeholder="Введите пароль"
                        minLength={8}
                        required
                      />
                      <ErrorMessage
                        name="password"
                        component="div"
                        className={s.fieldError}
                      />
                    </label>

                    <label className={s.label}>
                      <span className={s.caption}>Подтверждение пароля</span>
                      <Field
                        className={s.input}
                        type={showPwd ? "text" : "password"}
                        name="confirm"
                        placeholder="Повторите пароль"
                        minLength={8}
                        required
                      />
                      <ErrorMessage
                        name="confirm"
                        component="div"
                        className={s.fieldError}
                      />
                    </label>
                  </div>

                  <label className={s.checkboxLine}>
                    <input
                      type="checkbox"
                      checked={showPwd}
                      onChange={() => setShowPwd((v) => !v)}
                    />
                    <span>Показать пароль</span>
                  </label>
                </>
              )}

              {loading && (
                <div className={s.info}>Проверяем приглашение…</div>
              )}
              {serverError && !loading && (
                <div className={s.error}>{serverError}</div>
              )}
              {!hasToken && (
                <div className={s.error}>
                  Некорректная ссылка приглашения: отсутствует токен.
                </div>
              )}
              {serverOk && <div className={s.success}>{serverOk}</div>}

              <div className={s.actions}>
                <Link to="/auth" className={`${s.btn} ${s.linkAsBtn}`}>
                  Отмена
                </Link>
                <button
                  className={s.primary}
                  type="submit"
                  disabled={disabled || isSubmitting || !isValid}
                >
                  {isSubmitting
                    ? "Сохраняем…"
                    : userExists
                    ? "Принять приглашение"
                    : "Создать аккаунт и присоединиться"}
                </button>
              </div>

              {!hasToken && (
                <p className={s.helper}>
                  Проверьте, что перешли по полной ссылке из письма. Пример:{" "}
                  <code>
                    http://localhost:3000/invite/accept?token=…
                  </code>
                </p>
              )}
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}