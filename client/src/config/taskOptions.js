import {
  PRIORITY_I18N_KEYS,
  PRIORITY_LEVELS,
  normalizePriority,
} from './priority';

// ui/taskOptions.js (новый небольшой хелпер, можно вставить в тот же файл страницы, если не хочешь выносить)
export const STATUS_OPTIONS = [
  { value: "backlog",     label: "Бэклог" },
  { value: "todo",        label: "К выполнению" },
  { value: "in_progress", label: "В работе" },
  { value: "blocked",     label: "Заблокировано" },
  { value: "done",        label: "Сделано" },
  { value: "cancelled",   label: "Отменено" },
];

export const PRIORITY_OPTIONS = PRIORITY_LEVELS.map((value) => ({
  value,
  labelKey: PRIORITY_I18N_KEYS[value],
}));

export // priorityToLabel : priority to label.
// priorityToLabel: вспомогательная логика модуля.
const priorityToLabel = (n) => {
  const value = normalizePriority(n);
  const found = PRIORITY_OPTIONS.find(o => o.value === value);
  return found?.labelKey ?? String(value);
};
