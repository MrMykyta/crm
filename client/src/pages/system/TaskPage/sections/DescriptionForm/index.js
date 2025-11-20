// src/pages/system/TaskPage/TaskDetailPage/sections/DescriptionForm.jsx
import { useEffect, useRef, useState } from "react";
import { useUpdateTaskMutation } from "../../../../../store/rtk/tasksApi";
// проверь путь к редактору; у тебя inputs/ чаще всего тут
import HTMLEditor from "../../../../../components/inputs/HTMLEditor";
import s from "../sections.module.css";

export default function DescriptionForm({ taskId, initialHtml = "", onSaved }) {
  const [html, setHtml] = useState(initialHtml);
  const [updateTask, { isLoading }] = useUpdateTaskMutation();
  const lastSavedRef = useRef(initialHtml);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // если деталь перезагрузилась снаружи — обновим состояние
    setHtml(initialHtml);
    lastSavedRef.current = initialHtml;
  }, [initialHtml]);

  const dirty = html !== lastSavedRef.current;

  const save = async () => {
    try {
      setMessage("");
      const saved = await updateTask({ id: taskId, payload: { description: html } }).unwrap();
      lastSavedRef.current = saved?.description ?? html;
      setMessage("Сохранено");
      onSaved?.(lastSavedRef.current);
    } catch (e) {
      setMessage(e?.message || "Ошибка сохранения");
    }
  };

  return (
    <div className={s.sectionCard}>

      <HTMLEditor
        value={html}
        onChange={setHtml}
        placeholder="Опишите задачу: суть, чек-лист, ссылки, упоминания…"
        minHeight={280}
      />

      <div className={s.actions}>
          <button
            type="button"
            className={s.primaryBtn}
            onClick={save}
            disabled={!dirty || isLoading}
          >
            {isLoading ? "Сохранение…" : "Сохранить"}
          </button>
        </div>

      <div className={s.footerRow}>
        <span className={dirty ? s.dirty : s.clean}>
          {isLoading ? "Сохранение…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}
        </span>
        {message && <span className={s.message}>{message}</span>}
      </div>
    </div>
  );
}