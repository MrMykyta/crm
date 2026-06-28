// src/services/crm/counterpartyService.js
"use strict";

const crypto = require("crypto");
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

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// какие поля разрешаем сортировать
const SORT_WHITELIST = [
  "createdAt",
  "updatedAt",
  "shortName",
  "status",
  "type",
];
const REGISTRY_TRACKED_FIELDS = [
  "nip",
  "regon",
  "krs",
  "fullName",
  "shortName",
  "country",
  "city",
  "postalCode",
  "street",
  "isCompany",
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

// requireCompanyId: выполняет вспомогательную бизнес-логику сервиса.
function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error("companyId is required");
    err.status = 400;
    throw err;
  }
}

// assertDepartmentInCompany: выполняет вспомогательную бизнес-логику сервиса.
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

// assertHoldingInCompany: выполняет вспомогательную бизнес-логику сервиса.
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

// assertMemberInCompany: выполняет вспомогательную бизнес-логику сервиса.
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

function asText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeTaxId(value, maxLength) {
  const text = asText(value).replace(/\D/g, "");
  return maxLength ? text.slice(0, maxLength) : text;
}

function normalizePesel(value) {
  return asText(value).replace(/\D/g, "").slice(0, 11);
}

function isValidPesel(value) {
  const pesel = normalizePesel(value);
  if (pesel.length !== 11) return false;
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = weights.reduce((acc, weight, index) => acc + Number(pesel[index]) * weight, 0);
  const checksum = (10 - (sum % 10)) % 10;
  return checksum === Number(pesel[10]);
}

function normalizeDateOnly(value) {
  const text = asText(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const err = new Error("birthDate is invalid");
    err.status = 400;
    throw err;
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    const err = new Error("birthDate is invalid");
    err.status = 400;
    throw err;
  }
  return text;
}

function normalizePeselOrNull(value) {
  const pesel = normalizePesel(value);
  if (!pesel) return null;
  if (!/^\d{11}$/.test(pesel) || !isValidPesel(pesel)) {
    const err = new Error("Invalid PESEL");
    err.status = 400;
    err.code = "INVALID_PESEL";
    throw err;
  }
  return pesel;
}

function normalizeCountry(value) {
  return asText(value).toUpperCase().slice(0, 2);
}

function compactObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined || raw === null) continue;
    if (typeof raw === "string") {
      const text = raw.trim();
      if (text) out[key] = text;
    } else if (Array.isArray(raw)) {
      if (raw.length) out[key] = raw;
    } else if (typeof raw === "object") {
      const nested = compactObject(raw);
      if (nested && Object.keys(nested).length) out[key] = nested;
    } else {
      out[key] = raw;
    }
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeRegistrySnapshot(rawSnapshot = {}) {
  if (!rawSnapshot || typeof rawSnapshot !== "object" || Array.isArray(rawSnapshot)) return null;
  const taxIds = compactObject({
    nip: normalizeTaxId(rawSnapshot.taxIds?.nip || rawSnapshot.nip, 10),
    regon: normalizeTaxId(rawSnapshot.taxIds?.regon || rawSnapshot.regon, 14),
    krs: normalizeTaxId(rawSnapshot.taxIds?.krs || rawSnapshot.krs, 14),
  });
  const address = compactObject({
    country: normalizeCountry(rawSnapshot.address?.country || rawSnapshot.country || "PL"),
    city: rawSnapshot.address?.city,
    postalCode: rawSnapshot.address?.postalCode,
    street: rawSnapshot.address?.street,
  });
  const snapshot = compactObject({
    country: normalizeCountry(rawSnapshot.country || rawSnapshot.address?.country || "PL"),
    legalName: rawSnapshot.legalName,
    shortName: rawSnapshot.shortName,
    taxIds,
    address,
    legalForm: rawSnapshot.legalForm,
    pkd: Array.isArray(rawSnapshot.pkd) ? rawSnapshot.pkd.map(asText).filter(Boolean) : undefined,
    source: Array.isArray(rawSnapshot.source)
      ? rawSnapshot.source.map(asText).filter(Boolean)
      : asText(rawSnapshot.source || "GUS"),
    registryEnv: asText(rawSnapshot.registryEnv),
    fetchedAt: rawSnapshot.fetchedAt ? new Date(rawSnapshot.fetchedAt).toISOString() : undefined,
    mock: Boolean(rawSnapshot.mock),
  });
  return snapshot;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashSnapshot(snapshot) {
  if (!snapshot) return null;
  return crypto.createHash("sha256").update(stableJson(snapshot)).digest("hex");
}

function sourceToString(source) {
  if (Array.isArray(source)) return source.map(asText).filter(Boolean).join(", ");
  return asText(source || "GUS") || "GUS";
}

function registrySnapshotToTrackedValues(snapshot = {}) {
  const taxIds = snapshot.taxIds || {};
  const address = snapshot.address || {};
  const legalName = asText(snapshot.legalName);
  const shortName = asText(snapshot.shortName) || legalName;
  return {
    nip: normalizeTaxId(taxIds.nip || snapshot.nip, 10),
    regon: normalizeTaxId(taxIds.regon || snapshot.regon, 14),
    krs: normalizeTaxId(taxIds.krs || snapshot.krs, 14),
    fullName: legalName || shortName,
    shortName,
    country: normalizeCountry(address.country || snapshot.country || "PL"),
    city: asText(address.city),
    postalCode: asText(address.postalCode),
    street: asText(address.street),
    isCompany: snapshot.isCompany === false ? false : true,
  };
}

function comparableFieldValue(field, value) {
  if (field === "isCompany") return Boolean(value);
  if (field === "nip") return normalizeTaxId(value, 10);
  if (field === "regon" || field === "krs") return normalizeTaxId(value, 14);
  if (field === "country") return normalizeCountry(value);
  return asText(value);
}

function fieldsMatchRegistrySnapshot(values, snapshot) {
  if (!snapshot) return false;
  const expected = registrySnapshotToTrackedValues(snapshot);
  return REGISTRY_TRACKED_FIELDS.every((field) => {
    const expectedValue = comparableFieldValue(field, expected[field]);
    if (expectedValue === "" && field !== "isCompany") return true;
    return comparableFieldValue(field, values[field]) === expectedValue;
  });
}

function buildRegistryVerificationFields(data, values) {
  const verification = data?.registryVerification;
  if (!verification || verification.verified !== true) return null;
  const snapshot = sanitizeRegistrySnapshot(verification.snapshot || {});
  if (!fieldsMatchRegistrySnapshot(values, snapshot)) return null;
  const verifiedAt = verification.verifiedAt ? new Date(verification.verifiedAt) : new Date();
  return {
    registryVerified: true,
    registryVerifiedAt: Number.isNaN(verifiedAt.getTime()) ? new Date() : verifiedAt,
    registryVerifiedSource: sourceToString(verification.source || snapshot?.source),
    registryVerifiedEnv: asText(verification.registryEnv || snapshot?.registryEnv) || null,
    registryVerifiedMock: Boolean(verification.mock || snapshot?.mock),
    registrySnapshot: snapshot,
    registrySnapshotHash: hashSnapshot(snapshot),
  };
}

function clearRegistryVerificationFields() {
  return {
    registryVerified: false,
    registryVerifiedAt: null,
    registryVerifiedSource: null,
    registryVerifiedEnv: null,
    registryVerifiedMock: false,
    registrySnapshot: null,
    registrySnapshotHash: null,
  };
}

function shouldClearRegistryVerification(counterparty, nextValues) {
  if (!counterparty?.registryVerified) return false;
  if (!counterparty.registrySnapshot) return true;
  return !fieldsMatchRegistrySnapshot(nextValues, counterparty.registrySnapshot);
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
    "firstName",
    "lastName",
    "nip",
    "regon",
    "krs",
    "pesel",
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
    const isCompany = data.isCompany ?? true;

    const createValues = {
      companyId,
      holdingId: data.holdingId ?? null,
      departmentId: data.departmentId ?? null,
      mainResponsibleUserId: data.mainResponsibleUserId ?? null,

      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      pesel: isCompany ? null : normalizePeselOrNull(data.pesel),
      birthDate: isCompany ? null : normalizeDateOnly(data.birthDate),
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
      isCompany,

      description: data.description ?? null,

      createdBy: userId,
      updatedBy: userId,
    };
    Object.assign(createValues, buildRegistryVerificationFields(data, createValues) || clearRegistryVerificationFields());

    counterparty = await Counterparty.create(
      createValues,
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
    const isCompany = data.isCompany ?? counterparty.isCompany;

    // снимок до изменений — для meta.old*
    beforeSnapshot = {
      type: counterparty.type,
      status: counterparty.status,
      city: counterparty.city,
    };

    const updateValues = {
      holdingId: data.holdingId ?? counterparty.holdingId,
      departmentId: hasOwn(data, "departmentId")
        ? data.departmentId
        : counterparty.departmentId,
      mainResponsibleUserId:
        data.mainResponsibleUserId ?? counterparty.mainResponsibleUserId,

      firstName: hasOwn(data, "firstName") ? data.firstName : counterparty.firstName,
      lastName: hasOwn(data, "lastName") ? data.lastName : counterparty.lastName,
      pesel: isCompany
        ? null
        : (hasOwn(data, "pesel") ? normalizePeselOrNull(data.pesel) : counterparty.pesel),
      birthDate: isCompany
        ? null
        : (hasOwn(data, "birthDate") ? normalizeDateOnly(data.birthDate) : counterparty.birthDate),
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
      isCompany,

      description: data.description ?? counterparty.description,
      updatedBy: userId,
    };
    const nextVerification = buildRegistryVerificationFields(data, updateValues);
    if (nextVerification) {
      Object.assign(updateValues, nextVerification);
    } else if (shouldClearRegistryVerification(counterparty, updateValues)) {
      Object.assign(updateValues, clearRegistryVerificationFields());
    }

    await counterparty.update(
      updateValues,
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
