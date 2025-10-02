const { ContactPoint } = require('../../models');
const { Op } = require('sequelize');
const { normalizeEmail, normalizePhone } = require('../../utils/normalize');

// helpers — используй свои, если уже есть
const valueKey = (channel, valueNorm, valueRaw) => {
  // для email/phone используем нормализованное значение; иначе — lower(trim(raw))
  const base = (valueNorm && String(valueNorm).trim()) || String(valueRaw || '').trim().toLowerCase();
  return `${channel}::${base}`;
};


module.exports.list = async (companyId, query = {}) => {
    const where = { company_id: companyId };
    if (query.ownerType) {
        where.owner_type = query.ownerType;
    }
    if (query.ownerId) {
        where.owner_id = query.ownerId;
    }
    if (query.channel) {
        where.channel = query.channel;
    }
    if (query.q) {
        where[Op.or] = [
        { value_raw:  { [Op.iLike]: `%${query.q}%` } },
        { value_norm: { [Op.iLike]: `%${query.q}%` } },
        { label:      { [Op.iLike]: `%${query.q}%` } },
        ];
    }
    return await ContactPoint.findAll({ where, order: [['is_primary','DESC'], ['created_at','DESC']] });
};

module.exports.create = async (userId, companyId, p = {}) => {
    const base = {
        companyId: companyId,
        ownerType: p.ownerType,      // 'counterparty'|'contact'|'user'|'company'
        ownerId: p.ownerId,
        channel: p.channel,           // 'phone'|'email'
        valueRaw: String(p.value).trim(),
        label: p.label ?? null,
        departmentId: p.departmentId ?? null,
        isPrimary: !!p.isPrimary,
        isPublic: p.isPublic !== undefined ? !!p.isPublic : true,
        verifiedAt: p.verifiedAt ?? null,
        notes: p.notes ?? null,
        createdBy: userId
    };

    if (base.channel === 'email') {
        base.valueNorm = normalizeEmail(base.valueRaw);
    }
    if (base.channel === 'phone') {
        base.valueNorm = normalizePhone(base.valueRaw);
    }

    // если ставим is_primary=true — снимем "primary" с других по тому же owner/channel
    if (base.isPrimary) {
        await ContactPoint.update(
            { isPrimary: false },
            { where: {
                companyId: companyId,
                ownerType: base.ownerType,
                ownerId: base.ownerId,
                channel: base.channel,
                isPrimary: true
            }}
        );
    }

    return await ContactPoint.create(base);
};

module.exports.addContacts = async ({
  companyId,
  ownerType,
  ownerId,
  contacts = [],
  actorUserId = null,
  t,
}) => {
  // 1) Подготовка входящих: нормализация + дедуп по ключу
  //    (последнее вхождение выигрывает, чтобы можно было «перекрыть» предыдущие)
  const mapByKey = new Map();
  for (const c of Array.isArray(contacts) ? contacts : []) {
    if (!c || !c.channel) continue;
    const valueRaw = String(c.value ?? '').trim();
    if (!valueRaw) continue;

    const valueNorm =
      c.channel === 'email' ? normalizeEmail(valueRaw)
      : c.channel === 'phone' ? normalizePhone(valueRaw)
      : null;

    const key = valueKey(c.channel, valueNorm, valueRaw);
    mapByKey.set(key, {
      key,
      channel: c.channel,
      valueRaw,
      valueNorm,
      label: c.label ?? null,
      isPrimary: !!c.isPrimary,
      isPublic: c.isPublic !== undefined ? !!c.isPublic : true,
      verifiedAt: c.verifiedAt ?? null,
      notes: c.notes ?? null,
    });
  }
  const prepared = Array.from(mapByKey.values());

  // 2) Текущее состояние ВСЕХ контактов владельца (по всем каналам)
  //    Так мы корректно удалим то, чего нет во входящем массиве.
  const existing = await ContactPoint.findAll({
    where: { companyId, ownerType, ownerId },
    transaction: t,
  });

  const existingByKey = new Map(
    existing.map(row => [valueKey(row.channel, row.valueNorm, row.valueRaw), row])
  );

  // 3) Если во входящих есть флаги primary — сбросим прежние primary по ЭТИМ каналам
  const incomingPrimaryChannels = new Set(prepared.filter(p => p.isPrimary).map(p => p.channel));
  if (incomingPrimaryChannels.size > 0) {
    await ContactPoint.update(
      { isPrimary: false },
      {
        where: {
          companyId,
          ownerType,
          ownerId,
          channel: Array.from(incomingPrimaryChannels),
          isPrimary: true,
        },
        transaction: t,
      }
    );
  }

  const createdPayloads = [];
  const updated = [];
  const skipped = [];

  // 4) Upsert: создаём отсутствующие, обновляем изменившиеся
  for (const p of prepared) {
    const found = existingByKey.get(p.key);
    if (!found) {
      createdPayloads.push({
        companyId,
        ownerType,
        ownerId,
        channel: p.channel,
        valueRaw: p.valueRaw,
        valueNorm: p.valueNorm,
        label: p.label,
        isPrimary: p.isPrimary,
        isPublic: p.isPublic,
        verifiedAt: p.verifiedAt,
        notes: p.notes,
        createdBy: actorUserId,
      });
      continue;
    }

    const patch = {};
    if ((found.label ?? null) !== (p.label ?? null)) patch.label = p.label ?? null;
    if (Boolean(found.isPublic) !== Boolean(p.isPublic)) patch.isPublic = Boolean(p.isPublic);
    if (Boolean(found.isPrimary) !== Boolean(p.isPrimary)) patch.isPrimary = Boolean(p.isPrimary);
    if ((found.notes ?? null) !== (p.notes ?? null)) patch.notes = p.notes ?? null;

    const incomingVerified = p.verifiedAt ? new Date(p.verifiedAt).toISOString() : null;
    const existingVerified = found.verifiedAt ? new Date(found.verifiedAt).toISOString() : null;
    if (incomingVerified !== existingVerified) patch.verifiedAt = p.verifiedAt ?? null;

    if (Object.keys(patch).length > 0) {
      await ContactPoint.update(patch, { where: { id: found.id }, transaction: t });
      Object.assign(found, patch);
      updated.push({ id: found.id, ...patch });
    } else {
      skipped.push({ id: found.id, channel: found.channel, value: found.valueNorm || found.valueRaw });
    }
  }

  // 5) Массово создаём новые
  let created = [];
  if (createdPayloads.length > 0) {
    created = await ContactPoint.bulkCreate(createdPayloads, { transaction: t, validate: true });
  }

  // 6) Удаление отсутствующих:
  //    всё, что есть у владельца, но НЕТ среди входящих ключей — удаляем.
  const incomingKeys = new Set(prepared.map(p => p.key));
  const toDeleteIds = existing
    .filter(row => !incomingKeys.has(valueKey(row.channel, row.valueNorm, row.valueRaw)))
    .map(row => row.id);

  let deleted = 0;
  if (toDeleteIds.length > 0) {
    deleted = await ContactPoint.destroy({
      where: { id: toDeleteIds },
      transaction: t,
    });
  }

  // 7) Гарантия единственного primary на канал (последний выигрывает)
  //    Мы уже сбрасывали primary по каналам, где входящие содержали primary.
  //    На выходе по этим каналам останется тот, кому выставили isPrimary=true.
  //    Если по каналу не пришло ни одного primary, оставляем как есть
  //    (или можно добавить правило выставлять primary первому — тогда допиши тут).

  return {
    created,
    updated,
    skipped,
    deletedIds: toDeleteIds,
    deletedCount: deleted,
  };
};

module.exports.update = async (companyId, id, p = {}) => {
    const row = await ContactPoint.findOne({ where: { id, companyId: companyId } });
    if (!row) {
        return null;
    }

    const patch = {};
    if (p.value !== undefined) {
        patch.valueRaw = String(p.value).trim();
        patch.valueNorm = row.channel === 'email'
            ? normalizeEmail(patch.valueRaw)
            : row.channel === 'phone'
                ? normalizePhone(patch.valueRaw)
                : null;
    }
    if (p.label !== undefined) {
        patch.label = p.label;
    }
    if (p.isPublic !== undefined) {
        patch.isPublic = !!p.isPublic;
    }
    if (p.verifiedAt !== undefined) {
        patch.verifiedAt = p.verifiedAt;
    }
    if (p.notes !== undefined) {
        patch.notes = p.notes;
    }

    // переключение primary
    if (p.isPrimary === true) {
        await ContactPoint.update(
            { isPrimary: false },
            { where: {
                companyId: companyId,
                ownerType: row.ownerType,
                ownerId: row.ownerId,
                channel: row.channel,
                isPrimary: true
            }}
        );
        patch.isPrimary = true;
    } else if (p.isPrimary === false) {
        patch.isPrimary = false;
    }

    await row.update(patch);
    return row;
};

module.exports.remove = async (companyId, id) => {
    const row = await ContactPoint.findOne(
        { where: { 
            id, 
            companyId: companyId 
        } 
    });
    if (!row) {
        return false;
    }
    await row.destroy();
    return true;
};
