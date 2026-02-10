// src/pages/Chat/utils/chatDateUtils.js
// Date grouping helpers for chat messages (Today/Yesterday/localized date label).
import i18n from "../../../i18n";

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

  if (diffDays === 0) return i18n.t("chat.date.today");
  if (diffDays === 1) return i18n.t("chat.date.yesterday");

  const locale = i18n.language || "en";
  return d.toLocaleDateString(locale, {
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
