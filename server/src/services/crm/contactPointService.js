const { ContactPoint } = require('../../models');
const { Op } = require('sequelize');
const { normalizeEmail, normalizePhone } = require('../../utils/normalize');

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

module.exports.addContacts = async ({ companyId, ownerType, ownerId, contacts = [], actorUserId = null, t }) => {
    
    console.log(contacts)
    
    if (!Array.isArray(contacts) || contacts.length === 0) {
        return [];
    }

    // Снимем старые primary в пределах владельца для каналов, где ставим новый primary
    const primaryChannels = new Set(contacts.filter(c => c?.isPrimary).map(c => c.channel));
    if (primaryChannels.size) {
        await ContactPoint.update(
        { isPrimary: false },
        {
            where: {
            companyId: companyId,
            ownerType: ownerType,
            ownerId: ownerId,
            channel: Array.from(primaryChannels),
            isPrimary: true
            },
            transaction: t
        }
        );
    }

    const rows = contacts
        .filter(c => c?.channel && c?.value)
        .map(c => {
        const valueRaw = String(c.value).trim();
        const valueNorm = c.channel === 'email'
            ? normalizeEmail(valueRaw)
            : c.channel === 'phone'
            ? normalizePhone(valueRaw)
            : null;

        return {
            companyId,
            ownerType,
            ownerId,
            channel: c.channel,
            valueRaw,
            valueNorm,
            label: c.label ?? null,
            isPrimary: !!c.isPrimary,
            isPublic: c.isPublic !== undefined ? !!c.isPublic : true,
            verifiedAt: c.verifiedAt ?? null,
            notes: c.notes ?? null,
            createdBy: actorUserId
        };
        });

    if (!rows.length) {
        return [];
    }
    return ContactPoint.bulkCreate(rows, { transaction: t, validate: true });
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
