import { useState } from "react";
import clsx from "clsx";

/**
 * Универсальная select-ячейка с мини-лоадингом и onChange(value)
 * options: [{value,label}]
 */
export default function StatusSelectCell({
  value,
  options = [
    { value: "active",    label: "Активен" },
    { value: "suspended", label: "Заблокирован" },
  ],
  className = "",
  onChange,
  disabled = false,
  title,
}) {
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(value);

  const handle = async (e) => {
    const next = e.target.value;
    setLocal(next);        // оптимистично
    setBusy(true);
    try {
      await onChange?.(next);
    } catch (err) {
      // если ошибка — откатываем значение назад
      setLocal(value);
      // покажи пользователю причину (можно заменить на toast)
      const msg = err?.response?.data?.error || err?.message || "Не удалось изменить статус";
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <select
      className={clsx(className)}
      value={local}
      onChange={handle}
      disabled={disabled || busy}
      title={title}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}