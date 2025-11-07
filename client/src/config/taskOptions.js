// ui/taskOptions.js (новый небольшой хелпер, можно вставить в тот же файл страницы, если не хочешь выносить)
export const STATUS_OPTIONS = [
  { value: "backlog",     label: "Бэклог" },
  { value: "todo",        label: "К выполнению" },
  { value: "in_progress", label: "В работе" },
  { value: "blocked",     label: "Заблокировано" },
  { value: "done",        label: "Сделано" },
  { value: "cancelled",   label: "Отменено" },
];

export const PRIORITY_OPTIONS = [
  { value: 1, label: "1 — Низкий"    },
  { value: 2, label: "2 — Ниже ср."  },
  { value: 3, label: "3 — Средний"   },
  { value: 4, label: "4 — Выше ср."  },
  { value: 5, label: "5 — Высокий"   },
];

export const priorityToLabel = (n) => {
  const found = PRIORITY_OPTIONS.find(o => o.value === Number(n));
  return found?.label ?? String(n ?? "—");
};