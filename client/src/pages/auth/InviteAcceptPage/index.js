import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import {
  checkInvitationByToken,
  acceptInvitation,
} from "../../../api/companyUsers";
import auth from '../../../styles/AuthPage.module.css';
import s from "./InviteAccept.module.css";

export default function InviteAcceptPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const hasToken = !!token;

  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState("");
  const [serverOk, setServerOk] = useState("");
  const [loading, setLoading] = useState(hasToken);
  const [inviteInfo, setInviteInfo] = useState(null); // { email, firstName, lastName, userExists, ... }

  // === Проверка токена ===
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasToken) return;
      setLoading(true);
      try {
        const info = await checkInvitationByToken(token);
        if (cancelled) return;

        if (!info || info.status !== "pending") {
          const reason =
            info?.status === "accepted" ? "Приглашение уже принято." :
            info?.status === "revoked"  ? "Приглашение отозвано." :
            info?.status === "expired"  ? "Срок действия приглашения истёк." :
                                          "Некорректная ссылка приглашения.";
          setServerError(reason);
          setInviteInfo(null);
        } else {
          setInviteInfo({
            firstName: info.firstName || info.existingUser?.firstName || "",
            lastName:  info.lastName  || info.existingUser?.lastName  || "",
            email: info.email || "",
            userExists: !!info.userExists,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setServerError(
            e?.response?.data?.error || e?.response?.data?.message || "Не удалось проверить приглашение"
          );
          setInviteInfo(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, hasToken]);

  const userExists = !!inviteInfo?.userExists;

  // === Валидация: если пользователь существует — пароль/confirm не требуем ===
  const Schema = useMemo(() => {
    if (userExists) {
      return Yup.object().shape({
        // можно позволить поправить имя/фамилию, но без обязательности
        firstName: Yup.string().max(64, "Максимум 64 символа"),
        lastName:  Yup.string().max(64, "Максимум 64 символа"),
      });
    }
    return Yup.object().shape({
      firstName: Yup.string().max(64, "Максимум 64 символа"),
      lastName:  Yup.string().max(64, "Максимум 64 символа"),
      password:  Yup.string().min(8, "Минимум 8 символов").required("Введите пароль"),
      confirm:   Yup.string()
        .oneOf([Yup.ref("password")], "Пароли не совпадают")
        .required("Повторите пароль"),
    });
  }, [userExists]);

  const init = useMemo(() => ({
    firstName: inviteInfo?.firstName || "",
    lastName:  inviteInfo?.lastName  || "",
    password:  "",
    confirm:   "",
  }), [inviteInfo]);

  const disabled = !hasToken || loading || !!serverError;

  return (
    <div className={`${auth.wrap} ${s.wrap}`}>
      <div className={`${auth.card} ${s.card}`}>
        <header className={auth.cardHeader}>
          <h1 className={auth.title}>Принятие приглашения</h1>
          <p className={auth.subtitle}>
            {userExists
              ? "Нажмите «Принять приглашение», чтобы присоединиться к рабочему пространству."
              : "Установите пароль. Имя и фамилию можете скорректировать при необходимости."
            }
          </p>
        </header>

        <Formik
          initialValues={init}
          enableReinitialize
          validationSchema={Schema}
          onSubmit={async (values, { setSubmitting }) => {
            setServerError(""); setServerOk("");
            try {
              const payload = { token };
              // если новый пользователь — отправляем пароль и ФИО
              if (!userExists) {
                payload.password  = values.password;
                payload.firstName = values.firstName?.trim();
                payload.lastName  = values.lastName?.trim();
              } else {
                // существующий: можно опционально передать патч ФИО (бэк это поддерживает)
                payload.firstName = values.firstName?.trim();
                payload.lastName  = values.lastName?.trim();
              }

              const res = await acceptInvitation(payload);

              if (res?.accessToken) {
                localStorage.setItem("accessToken", res.accessToken);
                if (res.refreshToken) localStorage.setItem("refreshToken", res.refreshToken);
                if (res.user) localStorage.setItem("user", JSON.stringify(res.user));
                if (res.companyId) localStorage.setItem("companyId", String(res.companyId));
                navigate("/main", { replace: true });
              } else {
                navigate("/auth", { replace: true });
              }
            } catch (e) {
              const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message;
              setServerError(msg || "Ошибка принятия приглашения");
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting, isValid }) => (
            <Form className={s.form} noValidate>
              {inviteInfo?.email && (
                <div className={s.emailLine}>
                  Приглашение на: <span className={s.email}>{inviteInfo.email}</span>
                </div>
              )}

              {/* Имя / Фамилия — показываем всегда, но не требуем, если userExists */}
              <div className={s.grid2}>
                <label className={s.label}>
                  <span className={s.caption}>Имя</span>
                  <Field className={s.input} name="firstName" placeholder="Иван" />
                  <ErrorMessage name="firstName" component="div" className={s.fieldError} />
                </label>
                <label className={s.label}>
                  <span className={s.caption}>Фамилия</span>
                  <Field className={s.input} name="lastName" placeholder="Иванов" />
                  <ErrorMessage name="lastName" component="div" className={s.fieldError} />
                </label>
              </div>

              {/* Пароль / Подтверждение — только для НОВОГО пользователя */}
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
                      <ErrorMessage name="password" component="div" className={s.fieldError} />
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
                      <ErrorMessage name="confirm" component="div" className={s.fieldError} />
                    </label>
                  </div>

                  <label className={s.checkboxLine}>
                    <input
                      type="checkbox"
                      checked={showPwd}
                      onChange={() => setShowPwd(v => !v)}
                    />
                    <span>Показать пароль</span>
                  </label>
                </>
              )}

              {loading && <div className={s.info}>Проверяем приглашение…</div>}
              {serverError && !loading && <div className={s.error}>{serverError}</div>}
              {!hasToken && (
                <div className={s.error}>Некорректная ссылка приглашения: отсутствует токен.</div>
              )}
              {serverOk && <div className={s.success}>{serverOk}</div>}

              <div className={s.actions}>
                <Link to="/auth" className={`${s.btn} ${s.linkAsBtn}`}>Отмена</Link>
                <button
                  className={s.primary}
                  type="submit"
                  disabled={disabled || isSubmitting || !isValid}
                >
                  {isSubmitting
                    ? "Сохраняем…"
                    : (userExists ? "Принять приглашение" : "Создать аккаунт и присоединиться")}
                </button>
              </div>

              {!hasToken && (
                <p className={s.helper}>
                  Проверьте, что перешли по полной ссылке из письма. Пример:{" "}
                  <code>http://localhost:3000/invite/accept?token=…</code>
                </p>
              )}
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}