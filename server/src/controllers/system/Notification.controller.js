// src/controllers/system/notificationController.js
"use strict";

const notificationService = require("../../services/system/notificationService");

module.exports.listMy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    const data = await notificationService.listForUser(
      companyId,
      userId,
      req.query
    );

    res.status(200).send({ data });
  } catch (e) {
    console.error("[NotificationController.listMy]", e);
    res.status(500).send({ error: e.message });
  }
};

module.exports.markOneRead = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    const ok = await notificationService.markOneRead(companyId, userId, id);
    if (!ok) return res.status(404).send({ error: "Not found" });

    // фронт всё равно узнает по SSE из других мест,
    // здесь можно не шлать, но оставим на будущее, если надо
    // broadcast({ type: "notification.read", companyId, userIds: [userId], ids: [id] });

    res.status(200).send({ ok: true });
  } catch (e) {
    console.error("[NotificationController.markOneRead]", e);
    res.status(500).send({ error: e.message });
  }
};

module.exports.markAllRead = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    const n = await notificationService.markAllRead(companyId, userId);

    // broadcast({ type: "notification.readAll", companyId, userIds: [userId] });

    res.status(200).send({ ok: true, count: n });
  } catch (e) {
    console.error("[NotificationController.markAllRead]", e);
    res.status(500).send({ error: e.message });
  }
};

// HTTP-утилита, если захочешь дергать создание уведом снаружи
module.exports.createForUser = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { userId, type, title, body, entityType, entityId, meta } = req.body;

    const row = await notificationService.notifyUser({
      companyId,
      userId,
      type,
      title,
      body,
      entityType,
      entityId,
      meta,
    });

    res.status(201).send(row);
  } catch (e) {
    console.error("[NotificationController.createForUser]", e);
    res.status(400).send({ error: e.message });
  }
};
