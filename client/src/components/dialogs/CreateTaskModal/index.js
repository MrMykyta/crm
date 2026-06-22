import { useState, useMemo } from "react";
import Modal from "../../Modal";
import s from "../../../pages/styles/CrmUsers.module.css";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../../../config/taskOptions";
import {
  CheckboxField,
  DateField,
  DateTimeField,
  SelectField,
  TextField,
  TextareaField,
} from "../../ui/fields";

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
        <TextField
          className={s.label}
          inputClassName={s.input}
          label="Название задачи"
          placeholder="Например: Перезвонить клиенту"
          value={form.title}
          onValueChange={(value) => change("title", value)}
          onBlur={(e) => validateTitle(e.target.value)}
          error={titleError}
          autoFocus
          required
          disabled={busy}
        />

        <TextareaField
          className={s.label}
          inputClassName={s.input}
          label="Описание"
          rows={4}
          placeholder="Коротко о задаче…"
          value={form.description}
          onValueChange={(value) => change("description", value)}
          onBlur={(e) => validateDesc(e.target.value)}
          error={descError}
          required
          disabled={busy}
        />

        <div className={s.row2}>
          <SelectField
            className={s.label}
            inputClassName={s.select}
            label="Приоритет"
            value={form.priority}
            options={PRIORITY_OPTIONS}
            onValueChange={(val) => change("priority", Number(val))}
            placeholder="Выбрать приоритет"
            size="md"
            disabled={busy}
          />

          <SelectField
            className={s.label}
            inputClassName={s.select}
            label="Статус"
            value={form.status}
            options={STATUS_OPTIONS}
            onValueChange={(val) => change("status", String(val))}
            placeholder="Выбрать статус"
            size="md"
            disabled={busy}
          />
        </div>

        <DateField
          className={s.label}
          inputClassName={s.input}
          label="Дедлайн (по дню)"
          value={form.dueDate}
          onValueChange={(nextValue) => change("dueDate", nextValue)}
          disabled={busy}
        />

        <div className={s.row3}>
          <TextField
            className={s.label}
            inputClassName={s.input}
            label="Исполнитель (userId) — опц."
            placeholder="UUID пользователя"
            value={form.assigneeId}
            onValueChange={(value) => change("assigneeId", value)}
            disabled={busy}
          />

          <TextField
            className={s.label}
            inputClassName={s.input}
            label="Клиент (counterpartyId) — опц."
            placeholder="UUID контрагента"
            value={form.counterpartyId}
            onValueChange={(value) => change("counterpartyId", value)}
            disabled={busy}
          />

          <TextField
            className={s.label}
            inputClassName={s.input}
            label="Сделка (dealId) — опц."
            placeholder="UUID сделки"
            value={form.dealId}
            onValueChange={(value) => change("dealId", value)}
            disabled={busy}
          />
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
              <CheckboxField
                className={s.checkbox}
                label="Весь день"
                checked={!!form.isAllDay}
                onValueChange={(checked) => change("isAllDay", checked)}
                disabled={busy}
              />

              {form.isAllDay ? (
                <DateField
                  className={s.label}
                  inputClassName={s.input}
                  label="Дата события (eventDate)"
                  value={form.eventDate}
                  onValueChange={(nextValue) => change("eventDate", nextValue)}
                  disabled={busy}
                />
              ) : (
                <>
                  <DateTimeField
                    className={s.label}
                    inputClassName={s.input}
                    label="Начало (startAt)"
                    value={form.startAt}
                    onValueChange={(nextValue) => change("startAt", nextValue)}
                    disabled={busy}
                    withTime
                  />
                  <DateTimeField
                    className={s.label}
                    inputClassName={s.input}
                    label="Конец (endAt)"
                    value={form.endAt}
                    onValueChange={(nextValue) => change("endAt", nextValue)}
                    disabled={busy}
                    withTime
                  />
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
