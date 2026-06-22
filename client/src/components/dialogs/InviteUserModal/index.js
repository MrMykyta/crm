// src/components/modals/InviteUserModal/index.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import Modal from "../../Modal";
import { SelectField, TextField } from "../../../components/ui/fields";
import s from "../../../pages/styles/CrmUsers.module.css";
import { useLazyLookupUserByEmailQuery } from "../../../store/rtk/userApi";

// Компонент InviteUserModal: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function InviteUserModal({ roles, onSubmit, onClose }) {
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: roles?.[1]?.value || "admin",
  });

  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [exists, setExists] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [err, setErr] = useState("");

  const busy = sending || checking;

  const timerRef = useRef(null);
  const abortRef = useRef({ aborted: false });

  // lazy-lookup через RTK Query → уйдёт на /api/users/lookup?email=...
  const [triggerLookup] = useLazyLookupUserByEmailQuery();

  const isEmail = useMemo(() => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return (v) => re.test(String(v || "").trim());
  }, []);

    // validateEmail: валидирует введённые данные.
const validateEmail = (val) => {
    const v = String(val || "").trim();
    if (!v) {
      setEmailError("Укажите e-mail");
      return false;
    }
    if (!isEmail(v)) {
      setEmailError("Некорректный e-mail");
      return false;
    }
    setEmailError("");
    return true;
  };

    // change: вспомогательная логика компонента.
const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const value = form.email.trim();
    setErr("");

    if (!validateEmail(value)) {
      setExists(false);
      setChecking(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current.aborted = true;
    abortRef.current = { aborted: false };

    timerRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await triggerLookup(value).unwrap(); // { exists, user? }
        if (abortRef.current.aborted) return;

        const found = !!res?.exists;
        setExists(found);

        if (found) {
          const fn = res?.user?.firstName || "";
          const ln = res?.user?.lastName || "";
          setForm((f) => ({
            ...f,
            firstName: fn || f.firstName,
            lastName: ln || f.lastName,
          }));
        }
      } catch (e) {
        if (!abortRef.current.aborted) {
          setErr(e?.data?.error || e?.message || "Ошибка проверки e-mail");
          setExists(false);
        }
      } finally {
        if (!abortRef.current.aborted) setChecking(false);
      }
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current.aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email]);

    // submit: вспомогательная логика компонента.
const submit = async (e) => {
    e?.preventDefault();
    setErr("");

    if (!validateEmail(form.email)) return;
    if (busy) return;

    try {
      setSending(true);
      await onSubmit?.({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role,
      });
    } catch (e2) {
      setErr(e2?.message || "Ошибка отправки");
      setSending(false);
    }
  };

  const footer = (
    <>
      <Modal.Button onClick={onClose} disabled={busy}>
        Отмена
      </Modal.Button>
      <Modal.Button
        variant="primary"
        onClick={submit}
        disabled={busy || !!emailError}
      >
        {busy ? "Подождите…" : "Пригласить"}
      </Modal.Button>
    </>
  );

  const formDisabled = busy || !!emailError;

  return (
    <Modal
      open
      title="Пригласить пользователя"
      size="md"
      onClose={busy ? undefined : onClose}
      footer={footer}
    >
      <div className={`${s.formWrap} ${checking ? s.dimmed : ""}`}>
        <form className={s.form} onSubmit={submit} noValidate>
          <label className={s.label}>
            E-mail
            <TextField
              inputClassName={`${s.input} ${emailError ? s.inputError : ""}`}
              type="email"
              placeholder="user@company.com"
              value={form.email}
              onValueChange={(value) => change("email", value)}
              onBlur={(event) => validateEmail(event.target.value)}
              autoFocus
              required
              disabled={sending}
            />
            {emailError && <div className={s.fieldError}>{emailError}</div>}
          </label>

          <div className={s.row2}>
            <label className={s.label}>
              Имя
              <TextField
                inputClassName={s.input}
                value={form.firstName}
                onValueChange={(value) => change("firstName", value)}
                disabled={formDisabled}
                readOnly={exists}
              />
            </label>
            <label className={s.label}>
              Фамилия
              <TextField
                inputClassName={s.input}
                value={form.lastName}
                onValueChange={(value) => change("lastName", value)}
                disabled={formDisabled}
                readOnly={exists}
              />
            </label>
          </div>

          <label className={s.label}>
            Роль
            <SelectField
              inputClassName={s.select}
              value={form.role}
              options={roles}
              onValueChange={(role) => change("role", role)}
              disabled={formDisabled}
            />
          </label>

          {exists && !emailError && (
            <div className={s.note}>
              Пользователь с таким e-mail уже зарегистрирован. Имя и фамилию
              менять не нужно — просто отправьте приглашение.
            </div>
          )}

          {err ? <div className={s.error}>{err}</div> : null}
        </form>

        {checking && (
          <div className={s.centerSpinner}>
            <div className={s.bigSpin}></div>
            <div className={s.spinText}>Проверяем e-mail…</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
