import { useState, useMemo } from "react";
import Modal from "../../Modal";
import s from "../../../pages/styles/CrmUsers.module.css";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../../../config/taskOptions";
import ThemedSelect from "../../inputs/RadixSelect"; // ← новый селект
import DateTimePicker from "../../inputs/DateTimePicker";

// Компонент CreateTaskModal: отвечает за отображение UI и обработку взаимодействий пользователя.
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
    planOpen: false,
    isAllDay: false,
    eventDate: "",
    startAt: "",
    endAt: "",
  });

  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [titleError, setTitleError] = useState("");
  const [descError, setDescError] = useState("");

    // change: вспомогательная логика компонента.
const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const busy = useMemo(() => sending, [sending]);

    // validateTitle: валидирует введённые данные.
const validateTitle = (v) => {
    const val = String(v || "").trim();
    if (!val) { setTitleError("Укажите название задачи"); return false; }
    if (val.length > 300) { setTitleError("Название слишком длинное (макс. 300)"); return false; }
    setTitleError(""); return true;
  };

    // validateDesc: валидирует введённые данные.
const validateDesc = (v) => {
    const val = String(v ?? "").trim();
    if (!val) { setDescError("Описание обязательно"); return false; }
    setDescError(""); return true;
  };

    // buildPayload: собирает структуру данных для рендера или запроса.
const buildPayload = () => {
    const priority = Number(form.priority) || 3;
    const dueDate = form.dueDate || null;

    let isAllDay = null, eventDate = null, startAt = null, endAt = null;
    if (form.planOpen) {
      if (form.isAllDay) {
        isAllDay = true;
        eventDate = form.eventDate || null;
      } else if (form.startAt || form.endAt) {
        isAllDay = false;
        if (form.startAt) startAt = new Date(form.startAt).toISOString();
        if (form.endAt)   endAt   = new Date(form.endAt).toISOString();
      } else {
        isAllDay = null;
      }
    } else {
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
      isAllDay,
      eventDate,
      startAt,
      endAt,
    };
  };

    // submit: вспомогательная логика компонента.
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
            <ThemedSelect
              className={s.select}
              value={form.priority}
              options={PRIORITY_OPTIONS}
              onChange={(val) => change("priority", Number(val))}
              placeholder="Выбрать приоритет"
              size="md"
              disabled={busy}
            />
          </label>

          <label className={s.label}>
            Статус
            <ThemedSelect
              className={s.select}
              value={form.status}
              options={STATUS_OPTIONS}
              onChange={(val) => change("status", String(val))}
              placeholder="Выбрать статус"
              size="md"
              disabled={busy}
            />
          </label>
        </div>

        <label className={s.label}>
          Дедлайн (по дню)
          <DateTimePicker
            className={s.input}
            value={form.dueDate}
            onChange={(nextValue) => change("dueDate", nextValue)}
            disabled={busy}
            withTime={false}
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
                  <DateTimePicker
                    className={s.input}
                    value={form.eventDate}
                    onChange={(nextValue) => change("eventDate", nextValue)}
                    disabled={busy}
                    withTime={false}
                  />
                </label>
              ) : (
                <>
                  <label className={s.label}>
                    Начало (startAt)
                    <DateTimePicker
                      className={s.input}
                      value={form.startAt}
                      onChange={(nextValue) => change("startAt", nextValue)}
                      disabled={busy}
                      withTime
                    />
                  </label>
                  <label className={s.label}>
                    Конец (endAt)
                    <DateTimePicker
                      className={s.input}
                      value={form.endAt}
                      onChange={(nextValue) => change("endAt", nextValue)}
                      disabled={busy}
                      withTime
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

