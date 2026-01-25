// src/services/crm/counterpartyService.js
"use strict";

const {
  sequelize,
  Counterparty,
  ContactPoint,
  CompanyDepartment,
  UserCompany,
} = require("../../models");
const { Op } = require("sequelize");
const {
  parsePagination,
  packResult,
  applyCommonFilters,
} = require("../../utils/pagination");
const { addContacts } = require("./contactPointService");
const notificationService = require("../system/notificationService");

// какие поля разрешаем сортировать
const SORT_WHITELIST = [
  "createdAt",
  "updatedAt",
  "shortName",
  "status",
  "type",
];

/**
 * Получаем userId компании:
 *  - только активные (status = 'active')
 *  - по умолчанию без лидов (isLead = false)
 */
async function getCompanyUserIds(companyId, opts = {}) {
  if (!companyId) {
    const err = new Error("companyId is required");
    err.status = 400;
    throw err;
  }
  const { departmentId = null, includeLeads = false } = opts;

  const where = {
    companyId,
    status: "active", // поле из UserCompany
  };

  if (!includeLeads) {
    where.isLead = false; // поле из UserCompany
  }

  if (departmentId) {
    where.departmentId = departmentId;
  }

  const rows = await UserCompany.findAll({
    where,
    attributes: ["userId"],
  });

  return rows.map((r) => r.userId).filter(Boolean);
}

function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error("companyId is required");
    err.status = 400;
    throw err;
  }
}

async function assertDepartmentInCompany(departmentId, companyId, t) {
  if (!departmentId) return;
  const dept = await CompanyDepartment.findOne({
    where: { id: departmentId, companyId },
    transaction: t,
  });
  if (!dept) {
    const err = new Error("departmentId is invalid");
    err.status = 400;
    throw err;
  }
}

async function assertHoldingInCompany(holdingId, companyId, t) {
  if (!holdingId) return;
  const holding = await Counterparty.findOne({
    where: { id: holdingId, companyId },
    transaction: t,
  });
  if (!holding) {
    const err = new Error("holdingId is invalid");
    err.status = 400;
    throw err;
  }
}

async function assertMemberInCompany(userId, companyId, t) {
  if (!userId) return;
  const member = await UserCompany.findOne({
    where: { userId, companyId },
    transaction: t,
  });
  if (!member) {
    const err = new Error("mainResponsibleUserId is invalid");
    err.status = 400;
    throw err;
  }
}

/**
 * Утилита: название контрагента для title/meta
 */
function buildCounterpartyName(c) {
  return (
    c.shortName ||
    c.fullName ||
    [c.firstName, c.lastName].filter(Boolean).join(" ") ||
    `#${c.id}`
  );
}

/* ───────────────────────────────────────────────────────────
 *  LIST
 * ─────────────────────────────────────────────────────────── */

module.exports.list = async (companyId, query = {}) => {
  requireCompanyId(companyId);
  // разберём query и зададим дефолты
  const parsed = parsePagination(query, {
    sortWhitelist: SORT_WHITELIST,
    defaultSort: "createdAt",
    defaultDir: "DESC",
    defaultLimit: 25,
    maxLimit: 100,
  });

  const where = { companyId };

  // флаг: скрывать lead и client (используем на странице контрагентов)
  const excludeLeadClient =
    String(query.excludeLeadClient || "").toLowerCase() === "true" ||
    query.excludeLeadClient === "1";

  // одиночные фильтры (если прилетят)
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.isCompany != null) {
    where.isCompany = String(query.isCompany) === "true";
  }

  // множественные фильтры из parsePagination
  if (parsed.types?.length) where.type = { [Op.in]: parsed.types };
  if (parsed.statuses?.length) where.status = { [Op.in]: parsed.statuses };

  // 🔥 применяем excludeLeadClient
  if (excludeLeadClient) {
    const banned = ["lead", "client"];

    if (!where.type) {
      // типов не задавали — просто исключаем лидов и клиентов
      where.type = { [Op.notIn]: banned };
    } else if (where.type[Op.in]) {
      // типы заданы как IN (...) — вырежем запретные
      where.type[Op.in] = where.type[Op.in].filter((t) => !banned.includes(t));
      if (!where.type[Op.in].length) {
        // если всё вырезали — чтобы не сломать запрос, делаем NOT IN
        where.type = { [Op.notIn]: banned };
      }
    } else if (typeof where.type === "string") {
      // если явно просят lead/client — НЕ режем (страницы лидов/клиентов работают как раньше)
      if (banned.includes(where.type)) {
        // ничего не меняем, уважаем явный запрос
      }
    }
  }

  // общий поиск + диапазоны дат (createdAt)
  applyCommonFilters(where, parsed, [
    "shortName",
    "fullName",
    "nip",
    "regon",
    "krs",
  ]);

  // выбор колонок (если ?fields=id,shortName,status)
  const attributes = parsed.fields
    ? parsed.fields
    : {
        exclude: [
          "companyId",
          "mainResponsibleUserId",
          "createdBy",
          "updatedBy",
          "holdingId",
        ],
      };

  const data = await Counterparty.findAndCountAll({
    where,
    include: [
      {
        model: ContactPoint,
        as: "contacts",
        attributes: ["id", "channel", "valueNorm", "isPrimary", "createdAt"],
        where: { companyId },
        required: false,
      },
    ],
    attributes,
    order: [[parsed.sort, parsed.dir]],
    limit: parsed.limit,
    offset: parsed.offset,
    distinct: true,
  });

  return packResult(data, parsed);
};

/* ───────────────────────────────────────────────────────────
 *  CREATE
 * ─────────────────────────────────────────────────────────── */

module.exports.create = async (userId, companyId, data = {}) => {
  requireCompanyId(companyId);
  const t = await sequelize.transaction();
  let counterparty;

  try {
    await assertHoldingInCompany(data.holdingId, companyId, t);
    await assertDepartmentInCompany(data.departmentId, companyId, t);
    await assertMemberInCompany(data.mainResponsibleUserId, companyId, t);

    counterparty = await Counterparty.create(
      {
        companyId,
        holdingId: data.holdingId ?? null,
        departmentId: data.departmentId ?? null,
        mainResponsibleUserId: data.mainResponsibleUserId ?? null,

        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        fullName: data.fullName ?? null,
        shortName: data.shortName ?? null,

        regon: data.regon ?? null,
        nip: data.nip ?? null,
        krs: data.krs ?? null,
        bdo: data.bdo ?? null,

        type: data.type ?? "lead",
        status: data.status ?? "potential",

        country: data.country ?? null,
        city: data.city ?? null,
        postalCode: data.postalCode ?? null,
        street: data.street ?? null,
        isCompany: data.isCompany ?? true,

        description: data.description ?? null,

        createdBy: userId,
        updatedBy: userId,
      },
      { transaction: t }
    );

    await addContacts({
      companyId,
      ownerType: "counterparty",
      ownerId: counterparty.id,
      contacts: data.contacts,
      actorUserId: userId,
      t,
    });

    await t.commit();
  } catch (e) {
    await t.rollback();
    throw e;
  }

  // ───────── уведомления уже ВНЕ транзакции ─────────
  try {
    const userIds = await getCompanyUserIds(companyId);

    if (userIds.length) {
      await notificationService.notifyManyUsers({
        companyId,
        userIds,
        type: "counterparty.created",
        title: "Counterparty created",
        body: null,
        entityType: "counterparty",
        entityId: counterparty.id,
        meta: {
          action: "created",
          counterpartyId: counterparty.id,
          name: buildCounterpartyName(counterparty),
          city: counterparty.city || null,
          type: counterparty.type,
          status: counterparty.status,
        },
      });
    }
  } catch (notifyErr) {
    console.error("notifyManyUsers failed:", notifyErr);
    // базу не ломаем
  }

  return counterparty;
};

/* ───────────────────────────────────────────────────────────
 *  GET ONE
 * ─────────────────────────────────────────────────────────── */

module.exports.getOne = async (companyId, id) => {
  requireCompanyId(companyId);
  return Counterparty.findOne({
    where: { id, companyId },
    include: [
      {
        model: ContactPoint,
        as: "contacts",
        attributes: ["id", "channel", "valueNorm", "isPrimary", "createdAt"],
        where: { companyId },
        required: false,
      },
    ],
    attributes: {
      exclude: [
        "companyId",
        "mainResponsibleUserId",
        "createdBy",
        "updatedBy",
        "holdingId",
      ],
    },
  });
};

/* ───────────────────────────────────────────────────────────
 *  UPDATE
 * ─────────────────────────────────────────────────────────── */

module.exports.update = async (userId, companyId, id, data = {}) => {
  requireCompanyId(companyId);
  const t = await sequelize.transaction();
  let counterparty;
  let beforeSnapshot = null;

  try {
    await assertHoldingInCompany(data.holdingId, companyId, t);
    await assertDepartmentInCompany(data.departmentId, companyId, t);
    await assertMemberInCompany(data.mainResponsibleUserId, companyId, t);

    counterparty = await Counterparty.findOne({
      where: { id, companyId },
      transaction: t,
    });
    if (!counterparty) {
      await t.rollback();
      return null;
    }

    // снимок до изменений — для meta.old*
    beforeSnapshot = {
      type: counterparty.type,
      status: counterparty.status,
      city: counterparty.city,
    };

    await counterparty.update(
      {
        holdingId: data.holdingId ?? counterparty.holdingId,
        departmentId: data.departmentId ?? counterparty.departmentId,
        mainResponsibleUserId:
          data.mainResponsibleUserId ?? counterparty.mainResponsibleUserId,

        firstName: data.firstName ?? counterparty.firstName,
        lastName: data.lastName ?? counterparty.lastName,
        fullName: data.fullName ?? counterparty.fullName,
        shortName: data.shortName ?? counterparty.shortName,

        regon: data.regon,
        nip: data.nip,
        krs: data.krs,
        bdo: data.bdo,

        type: data.type ?? counterparty.type,
        status: data.status ?? counterparty.status,

        country: data.country ?? counterparty.country,
        city: data.city ?? counterparty.city,
        postalCode: data.postalCode ?? counterparty.postalCode,
        street: data.street ?? counterparty.street,
        isCompany: data.isCompany ?? counterparty.isCompany,

        description: data.description ?? counterparty.description,
        updatedBy: userId,
      },
      { transaction: t }
    );

    await addContacts({
      companyId,
      ownerType: "counterparty",
      ownerId: counterparty.id,
      contacts: data.contacts,
      actorUserId: userId,
      t,
    });

    await t.commit();
  } catch (e) {
    await t.rollback();
    console.log(e);
    throw e;
  }

  // ── уведомление об обновлении ──
  try {
    const userIds = await getCompanyUserIds(companyId);
    if (userIds.length) {
      const name = buildCounterpartyName(counterparty);

      const metaChanged = {
        type: data.type ?? null,
        status: data.status ?? null,
      };

      await notificationService.notifyManyUsers({
        companyId,
        userIds,
        type: "counterparty.updated",
        title: "Counterparty updated",
        body: null,
        entityType: "counterparty",
        entityId: counterparty.id,
        meta: {
          action: "updated",
          counterpartyId: counterparty.id,
          name,
          oldType: beforeSnapshot?.type ?? null,
          newType: counterparty.type,
          oldStatus: beforeSnapshot?.status ?? null,
          newStatus: counterparty.status,
          changed: metaChanged,
        },
      });
    }
  } catch (notifyErr) {
    console.error("notifyManyUsers (update) failed:", notifyErr);
  }

  return counterparty;
};

/* ───────────────────────────────────────────────────────────
 *  REMOVE
 * ─────────────────────────────────────────────────────────── */

module.exports.remove = async (companyId, id) => {
  requireCompanyId(companyId);
  const row = await Counterparty.findOne({ where: { id, companyId } });
  if (!row) return false;
  await row.destroy();

  // при желании можно тоже уведомить (counterparty.deleted), но обычно не надо
  return true;
};

/* ───────────────────────────────────────────────────────────
 *  CONVERT LEAD → CLIENT
 * ─────────────────────────────────────────────────────────── */

module.exports.convertLead = async (companyId, id, userId) => {
  requireCompanyId(companyId);
  const [n] = await Counterparty.update(
    { type: "client", status: "active", updatedBy: userId },
    { where: { id, companyId, type: "lead" } }
  );

  if (!n) return false;

  const cp = await Counterparty.findOne({ where: { id, companyId } });
  if (!cp) return false;

  try {
    const userIds = await getCompanyUserIds(companyId);
    if (userIds.length) {
      const name = buildCounterpartyName(cp);
      await notificationService.notifyManyUsers({
        companyId,
        userIds,
        type: "counterparty.converted",
        title: "Lead converted to client",
        body: null,
        entityType: "counterparty",
        entityId: cp.id,
        meta: {
          action: "converted",
          counterpartyId: cp.id,
          name,
          newType: cp.type, // client
          newStatus: cp.status, // active
        },
      });
    }
  } catch (notifyErr) {
    console.error("notifyManyUsers (convertLead) failed:", notifyErr);
  }

  return true;
};
