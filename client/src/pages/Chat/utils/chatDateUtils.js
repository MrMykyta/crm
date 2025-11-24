// src/pages/Chat/utils/chatDateUtils.js

export const formatDayKey = (date) => {
  const d = new Date(date);
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
};

export const formatDayLabel = (date) => {
  const d = new Date(date);
  const today = new Date();

  const startOf = (x) => {
    const n = new Date(x);
    n.setHours(0, 0, 0, 0);
    return n.getTime();
  };

  const diffDays = Math.round(
    (startOf(today) - startOf(d)) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";

  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
};

export const groupMessagesByDay = (messages) => {
  if (!Array.isArray(messages)) return [];

  const byKey = new Map();

  messages.forEach((m) => {
    if (!m?.createdAt) return;
    const key = formatDayKey(m.createdAt);
    if (!byKey.has(key)) {
      byKey.set(key, []);
    }
    byKey.get(key).push(m);
  });

  const keys = Array.from(byKey.keys()).sort();
  return keys.map((key) => ({
    key,
    label: formatDayLabel(byKey.get(key)[0].createdAt),
    items: byKey.get(key),
  }));
};