import { useEffect, useRef, useState, useMemo } from "react";
import Modal from "../../Modal";
import RoleSelectCell from "../../cells/RoleSelectCell";
import s from "../../../pages/styles/CrmUsers.module.css";
import { lookupUserByEmail } from "../../../api/user";

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
  const [emailError, setEmailError] = useState(""); // ← новое
  const [err, setErr] = useState("");

  const busy = sending || checking;

  const timerRef = useRef(null);
  const abortRef = useRef({ aborted: false });

  const isEmail = useMemo(() => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return (v) => re.test(String(v || "").trim());
  }, []);

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

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /** === Debounced проверка email (только если валиден) === */
  useEffect(() => {
    const value = form.email.trim();
    setErr("");

    // мгновенная валидация на вводе (уберём подсказку, когда станет валидным)
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
        const res = await lookupUserByEmail(value);
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
          setErr(
            e?.response?.data?.message ||
              e?.message ||
              "Ошибка проверки e-mail"
          );
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
  }, [form.email]); // validateEmail уже обновляет emailError

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");

    // финальная проверка
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
      setErr(e2?.response?.data?.message || e2.message || "Ошибка отправки");
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

  const formDisabled = busy || !!emailError; // блокируем остальные поля, пока e-mail не валиден

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
            <input
              className={`${s.input} ${emailError ? s.inputError : ""}`}
              type="email"
              placeholder="user@company.com"
              value={form.email}
              onChange={(e) => change("email", e.target.value)}
              onBlur={(e) => validateEmail(e.target.value)}   // ← показываем ошибку при уходе с поля
              autoFocus
              required
              disabled={sending} // можно печатать при checking, но нельзя при отправке
            />
            {emailError && <div className={s.fieldError}>{emailError}</div>}
          </label>

          <div className={s.row2}>
            <label className={s.label}>
              Имя
              <input
                className={s.input}
                value={form.firstName}
                onChange={(e) => change("firstName", e.target.value)}
                disabled={formDisabled}
                readOnly={exists}
              />
            </label>
            <label className={s.label}>
              Фамилия
              <input
                className={s.input}
                value={form.lastName}
                onChange={(e) => change("lastName", e.target.value)}
                disabled={formDisabled}
                readOnly={exists}
              />
            </label>
          </div>

          <label className={s.label}>
            Роль
            <RoleSelectCell
              className={s.select}
              value={form.role}
              options={roles}
              onChange={(role) => change("role", role)}
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