// components/dialogs/CreateTaskModal.jsx
import { useState, useMemo } from "react";
import Modal from "../../Modal";
import s from "../../../pages/styles/CrmUsers.module.css";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../../../config/taskOptions";

export default function CreateTaskModal({ onSubmit, onClose, currentUser }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: 3,           // число!
    dueDate: "",           // DATEONLY (YYYY-MM-DD)
    assigneeId: "",        // опционально
    counterpartyId: "",
    dealId: "",

    // Планирование (опционально)
    planOpen: false,
    isAllDay: false,       // null будет, если пользователь ничего не трогал (см. ниже)
    eventDate: "",         // YYYY-MM-DD (для allDay)
    startAt: "",           // YYYY-MM-DDTHH:mm
    endAt: "",             // YYYY-MM-DDTHH:mm
  });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [titleError, setTitleError] = useState("");
  const [descError, setDescError] = useState("");

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const busy = useMemo(() => sending, [sending]);

  const validateTitle = (v) => {
    const val = String(v || "").trim();
    if (!val) { setTitleError("Укажите название задачи"); return false; }
    if (val.length > 300) { setTitleError("Название слишком длинное (макс. 300)"); return false; }
    setTitleError(""); return true;
  };
  const validateDesc = (v) => {
    const val = String(v ?? "").trim();
    if (!val) { setDescError("Описание обязательно"); return false; }
    setDescError(""); return true;
  };

  const buildPayload = () => {
    // приоритет — число
    const priority = Number(form.priority) || 3;

    // дедлайн как DATEONLY
    const dueDate = form.dueDate || null;

    // планирование
    let isAllDay = null, eventDate = null, startAt = null, endAt = null;
    // если юзер раскрыл секцию — считаем, что хочет что-то запланировать
    if (form.planOpen) {
      if (form.isAllDay) {
        isAllDay = true;
        eventDate = form.eventDate || null; // YYYY-MM-DD
      } else if (form.startAt || form.endAt) {
        isAllDay = false;
        // datetime-local -> ISO
        if (form.startAt) startAt = new Date(form.startAt).toISOString();
        if (form.endAt)   endAt   = new Date(form.endAt).toISOString();
      } else {
        // пользователь открыл, но ничего не задал — оставим полностью незапланированной
        isAllDay = null;
      }
    } else {
      // полностью незапланированная
      isAllDay = null;
    }

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status || "todo",
      priority,
      dueDate,
      assigneeId: form.assigneeId || null,
      counterpartyId: form.counterpartyId || null,
      dealId: form.dealId || null,
      // планирование
      isAllDay,
      eventDate,
      startAt,
      endAt,
    };
  };

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");

    const okTitle = validateTitle(form.title);
    const okDesc  = validateDesc(form.description);
    if (!okTitle || !okDesc) return;
    if (busy) return;

    try {
      setSending(true);
      const payload = buildPayload();
      await onSubmit?.(payload);
    } catch (e2) {
      setErr(e2?.response?.data?.error || e2.message || "Ошибка создания задачи");
      setSending(false);
    }
  };

  const footer = (
    <>
      <Modal.Button onClick={onClose} disabled={busy}>Отмена</Modal.Button>
      <Modal.Button variant="primary" onClick={submit} disabled={busy || !!titleError || !!descError}>
        {busy ? "Создаём…" : "Создать"}
      </Modal.Button>
    </>
  );

  return (
    <Modal open title="Создать задачу" size="md" onClose={busy ? undefined : onClose} footer={footer}>
      <form className={s.form} onSubmit={submit} noValidate>
        <label className={s.label}>
          Название задачи *
          <input
            className={`${s.input} ${titleError ? s.inputError : ""}`}
            type="text"
            placeholder="Например: Перезвонить клиенту"
            value={form.title}
            onChange={(e) => change("title", e.target.value)}
            onBlur={(e) => validateTitle(e.target.value)}
            autoFocus
            required
            disabled={busy}
          />
          {titleError && <div className={s.fieldError}>{titleError}</div>}
        </label>

        <label className={s.label}>
          Описание *
          <textarea
            className={`${s.input} ${descError ? s.inputError : ""}`}
            rows={4}
            placeholder="Коротко о задаче…"
            value={form.description}
            onChange={(e) => change("description", e.target.value)}
            onBlur={(e) => validateDesc(e.target.value)}
            required
            disabled={busy}
          />
          {descError && <div className={s.fieldError}>{descError}</div>}
        </label>

        <div className={s.row2}>
          <label className={s.label}>
            Приоритет
            <select
              className={s.select}
              value={form.priority}
              onChange={(e) => change("priority", Number(e.target.value))}
              disabled={busy}
            >
              {PRIORITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className={s.label}>
            Статус
            <select
              className={s.select}
              value={form.status}
              onChange={(e) => change("status", e.target.value)}
              disabled={busy}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className={s.label}>
          Дедлайн (по дню)
          <input
            className={s.input}
            type="date"
            value={form.dueDate}
            onChange={(e) => change("dueDate", e.target.value)}
            disabled={busy}
          />
        </label>

        <div className={s.row3}>
          <label className={s.label}>
            Исполнитель (userId) — опц.
            <input
              className={s.input}
              placeholder="UUID пользователя"
              value={form.assigneeId}
              onChange={(e) => change("assigneeId", e.target.value)}
              disabled={busy}
            />
          </label>

          <label className={s.label}>
            Клиент (counterpartyId) — опц.
            <input
              className={s.input}
              placeholder="UUID контрагента"
              value={form.counterpartyId}
              onChange={(e) => change("counterpartyId", e.target.value)}
              disabled={busy}
            />
          </label>

          <label className={s.label}>
            Сделка (dealId) — опц.
            <input
              className={s.input}
              placeholder="UUID сделки"
              value={form.dealId}
              onChange={(e) => change("dealId", e.target.value)}
              disabled={busy}
            />
          </label>
        </div>

        {/* Планирование (опционально) */}
        <div className={s.block}>
          <button
            type="button"
            className={s.link}
            onClick={() => change("planOpen", !form.planOpen)}
            disabled={busy}
          >
            {form.planOpen ? "▾" : "▸"} Планирование (опционально)
          </button>

          {form.planOpen && (
            <div className={s.box}>
              <label className={s.checkbox}>
                <input
                  type="checkbox"
                  checked={!!form.isAllDay}
                  onChange={(e) => change("isAllDay", e.target.checked)}
                  disabled={busy}
                />
                Весь день
              </label>

              {form.isAllDay ? (
                <label className={s.label}>
                  Дата события (eventDate)
                  <input
                    className={s.input}
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => change("eventDate", e.target.value)}
                    disabled={busy}
                  />
                </label>
              ) : (
                <>
                  <label className={s.label}>
                    Начало (startAt)
                    <input
                      className={s.input}
                      type="datetime-local"
                      value={form.startAt}
                      onChange={(e) => change("startAt", e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <label className={s.label}>
                    Конец (endAt)
                    <input
                      className={s.input}
                      type="datetime-local"
                      value={form.endAt}
                      onChange={(e) => change("endAt", e.target.value)}
                      disabled={busy}
                    />
                  </label>
                </>
              )}
            </div>
          )}
        </div>

        {err ? <div className={s.error}>{err}</div> : null}
      </form>
    </Modal>
  );
}