// src/utils/notificationHelpers.js

/**
 * Человекочитаемый label сущности (Task / Counterparty / Lead / Client / User)
 */
export function getNotificationEntityLabel(t, nOrType) {
  const et =
    typeof nOrType === "string" ? nOrType : nOrType?.entityType || nOrType?.meta?.entityType;

  if (!et) return "";
  const key = String(et).toLowerCase();

  switch (key) {
    case "task":
      return t("notifications.entity.task", "Задача");
    case "deal":
      return t("notifications.entity.deal", "Сделка");
    case "counterparty":
      return t("notifications.entity.counterparty", "Контрагент");
    case "lead":
      return t("notifications.entity.lead", "Лид");
    case "client":
      return t("notifications.entity.client", "Клиент");
    case "contact":
      return t("notifications.entity.contact", "Контакт");
    case "user":
      return t("notifications.entity.user", "Пользователь");
    default:
      return key;
  }
}

/**
 * Заголовок нотификации.
 * Стараемся игнорить server title и собирать из type + meta.
 */
export function formatNotificationTitle(t, n) {
  if (!n) return "";
  const type = n.type || "";
  const meta = n.meta || {};

  switch (type) {
    // ───────── TASKS ─────────
    case "task.created":
      return t("notifications.task.created.title", {
        defaultValue: "New task created",
      });

    case "task.statusChanged":
      return t("notifications.task.statusChanged.title", {
        defaultValue: "Task status updated",
      });

    // ───────── COUNTERPARTY ─────────
    case "counterparty.created":
      return t("notifications.counterparty.created.title", {
        defaultValue: "Counterparty created",
        name: meta.name || "",
      });

    case "counterparty.updated":
      return t("notifications.counterparty.updated.title", {
        defaultValue: "Counterparty updated",
        name: meta.name || "",
      });

    case "counterparty.converted":
      return t("notifications.counterparty.converted.title", {
        defaultValue: "Lead converted to client",
        name: meta.name || "",
      });

    default:
      // fallback на то, что прислал сервер
      return n.title || "";
  }
}

/**
 * Body/description нотификации.
 * Показываем ключевую инфу из meta, если есть.
 */
export function formatNotificationBody(t, n) {
  if (!n) return "";
  const type = n.type || "";
  const meta = n.meta || {};

  switch (type) {
    // ───────── TASKS ─────────
    case "task.created":
      return t("notifications.task.created.body", {
        defaultValue: "Priority: {{priority}}, status: {{status}}",
        priority: meta.priority ?? "—",
        status: meta.status ?? "todo",
      });

    case "task.statusChanged":
      return t("notifications.task.statusChanged.body", {
        defaultValue: "Status: {{old}} → {{next}}",
        old: meta.oldStatus ?? "—",
        next: meta.newStatus ?? "—",
      });

    // ───────── COUNTERPARTY ─────────
    case "counterparty.created":
      return t("notifications.counterparty.created.body", {
        defaultValue: "Type: {{type}}, status: {{status}}",
        type: meta.type ?? "—",
        status: meta.status ?? "—",
      });

    case "counterparty.updated":
      // если есть изменения статуса – подчёркиваем их
      if (meta.oldStatus || meta.newStatus) {
        return t("notifications.counterparty.updated.bodyStatus", {
          defaultValue: "Status: {{old}} → {{next}}",
          old: meta.oldStatus ?? "—",
          next: meta.newStatus ?? "—",
        });
      }
      if (meta.oldType || meta.newType) {
        return t("notifications.counterparty.updated.bodyType", {
          defaultValue: "Type: {{old}} → {{next}}",
          old: meta.oldType ?? "—",
          next: meta.newType ?? "—",
        });
      }
      return t("notifications.counterparty.updated.bodyGeneric", {
        defaultValue: "Counterparty updated",
      });

    case "counterparty.converted":
      return t("notifications.counterparty.converted.body", {
        defaultValue: "Status: {{status}}",
        status: meta.newStatus ?? "active",
      });

    default:
      // fallback: что прислал сервер
      return n.body || "";
  }
}