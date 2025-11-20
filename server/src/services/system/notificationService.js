// src/services/system/notificationService.js
"use strict";

const { Notification, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { broadcast } = require("../../routes/system/sseRouter");

/* ───────────────────────────────────────────────────────────
 *  CREATE — одна или много
 * ─────────────────────────────────────────────────────────── */

module.exports.createForUser = async function createForUser({
  companyId,
  userId,
  type,
  title,
  body = null,
  entityType = null,
  entityId = null,
  meta = null,
  t = null,
}) {
  const tx = t || (await sequelize.transaction());
  let created;
  try {
    created = await Notification.create(
      {
        companyId,
        userId,
        type,
        title,
        body,
        entityType,
        entityId,
        meta,
      },
      { transaction: tx }
    );
    if (!t) await tx.commit();
    return created;
  } catch (e) {
    if (!t) await tx.rollback();
    throw e;
  }
};

module.exports.createForManyUsers = async function createForManyUsers({
  companyId,
  userIds,
  type,
  title,
  body = null,
  entityType = null,
  entityId = null,
  meta = null,
}) {
  if (!Array.isArray(userIds) || !userIds.length) return [];
  const tx = await sequelize.transaction();
  try {
    const rows = await Notification.bulkCreate(
      userIds.map((uid) => ({
        companyId,
        userId: uid,
        type,
        title,
        body,
        entityType,
        entityId,
        meta,
      })),
      { transaction: tx }
    );
    await tx.commit();
    return rows;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
};

/* ───────────────────────────────────────────────────────────
 *  NOTIFY (с SSE)
 * ─────────────────────────────────────────────────────────── */

module.exports.notifyUser = async function notifyUser(params) {
  const row = await module.exports.createForUser(params);

  broadcast({
    type: "notification.created",
    companyId: params.companyId,
    userIds: [params.userId],
    ids: [row.id],
  });

  return row;
};

module.exports.notifyManyUsers = async function notifyManyUsers(params) {
  const rows = await module.exports.createForManyUsers(params);
  if (!rows.length) return rows;

  broadcast({
    type: "notification.created",
    companyId: params.companyId,
    userIds: params.userIds,
    ids: rows.map((r) => r.id),
  });

  return rows;
};

/* ───────────────────────────────────────────────────────────
 *  LIST — фильтры, пагинация, entityType
 * ─────────────────────────────────────────────────────────── */

module.exports.listForUser = async function listForUser(
  companyId,
  userId,
  query = {}
) {
  const { onlyUnread, limit = 20, offset = 0, beforeId, entityType } = query;

  const where = { companyId, userId };

  // только непрочитанные
  if (onlyUnread === "1" || onlyUnread === 1 || onlyUnread === true) {
    where.isRead = false;
  }

  // entityType filter
  if (entityType) {
    where.entityType = String(entityType).toLowerCase();
  }

  // beforeId → чтобы грузить "до" указанных id
  if (beforeId) {
    where.id = { [Op.lt]: Number(beforeId) || 0 };
  }

  const rows = await Notification.findAll({
    where,
    order: [["id", "DESC"]],
    limit: Math.min(Number(limit) || 20, 100),
    offset: Number(offset) || 0,
  });

  const unreadCount = await Notification.count({
    where: { ...where, isRead: false },
  });

  return {
    items: rows,
    unreadCount,
  };
};

/* ───────────────────────────────────────────────────────────
 *  READ — один или все
 * ─────────────────────────────────────────────────────────── */

module.exports.markOneRead = async function markOneRead(companyId, userId, id) {
  const [n] = await Notification.update(
    { isRead: true },
    { where: { id, companyId, userId, isRead: false } }
  );
  return n > 0;
};

module.exports.markAllRead = async function markAllRead(companyId, userId) {
  const [n] = await Notification.update(
    { isRead: true },
    { where: { companyId, userId, isRead: false } }
  );
  return n;
};
