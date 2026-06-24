const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { Permission, Role, RolePermission, UserRole } = require('../../models');
const { PERMISSIONS } = require('../../constants/permissions');
const { DEFAULT_ROLE_META, DEFAULT_ROLE_SETS, normalizeRoleSlug } = require('../../constants/aclDefaults');

const DEFAULT_ROLE_SLUGS = Object.keys(DEFAULT_ROLE_SETS);

function roleDefaultSlug(role) {
    const slug = normalizeRoleSlug(role.slug);
    if (DEFAULT_ROLE_SETS[slug]) return slug;

    const legacyName = normalizeRoleSlug(role.name);
    if (DEFAULT_ROLE_SETS[legacyName]) return legacyName;

    return null;
}

function canonicalRoleMap(roles) {
    const map = new Map();
    for (const role of roles) {
        const slug = roleDefaultSlug(role);
        if (slug && !map.has(slug)) {
            map.set(slug, role.id);
        }
    }
    return map;
}

async function ensureRoleMetadata(role, meta, transaction) {
    const patch = {};
    if (role.slug !== meta.slug) patch.slug = meta.slug;
    if (role.isSystem !== meta.isSystem) patch.isSystem = meta.isSystem;
    if (role.isDefault !== meta.isDefault) patch.isDefault = meta.isDefault;

    if (Object.keys(patch).length) {
        await role.update(patch, { transaction });
    }
}

/**
 * Создаёт дефолтные роли, мапит права и назначает владельца.
 * Должно вызываться внутри транзакции.
 */
module.exports.bootstrapCompanyAcl = async ({ companyId, ownerUserId, transaction }) => {
    if (!companyId) {
        throw new Error('companyId is required');
    }
    if (!ownerUserId) {
        throw new Error('ownerUserId is required');
    }

    // 1) Ensure global permissions exist
    const existingPerms = await Permission.findAll({
        attributes: ['id','name'],
        where: { name: PERMISSIONS },
        transaction
    });

    const existingNames = new Set(existingPerms.map(p => p.name));

    const toInsert = PERMISSIONS.filter(n => !existingNames.has(n))
        .map(name => ({ id: uuidv4(), name, description: null }));

    if (toInsert.length) {
        await Permission.bulkCreate(toInsert, { ignoreDuplicates: true, transaction });
    }

    const allPerms = await Permission.findAll({ attributes: ['id','name'], transaction });

    const permMap = new Map(allPerms.map(p => [p.name, p.id]));

    // 2) Ensure default roles for company.
    // slug-first lookup with legacy name fallback; duplicate legacy rows are not deleted.
    let roles = await Role.findAll({
        where: {
            companyId,
            [Op.or]: [
                { slug: DEFAULT_ROLE_SLUGS },
                { name: DEFAULT_ROLE_SLUGS },
            ],
        },
        order: [['slug', 'ASC'], ['name', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
        transaction
    });
    let roleMap = canonicalRoleMap(roles);

    for (const role of roles) {
        const slug = roleDefaultSlug(role);
        const meta = slug ? DEFAULT_ROLE_META[slug] : null;
        if (meta) {
            await ensureRoleMetadata(role, meta, transaction);
        }
    }

    for (const slug of DEFAULT_ROLE_SLUGS) {
        if (roleMap.has(slug)) {
            continue;
        }
        const meta = DEFAULT_ROLE_META[slug];
        const role = await Role.create({
            id: uuidv4(),
            companyId,
            name: meta.name,
            slug: meta.slug,
            isSystem: meta.isSystem,
            isDefault: meta.isDefault,
            description: `Default ${meta.slug} role`
        }, { transaction });
        roleMap.set(slug, role.id);
    }

    roles = await Role.findAll({
        where: {
            companyId,
            [Op.or]: [
                { slug: DEFAULT_ROLE_SLUGS },
                { name: DEFAULT_ROLE_SLUGS },
            ],
        },
        order: [['slug', 'ASC'], ['name', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
        transaction
    });
    roleMap = canonicalRoleMap(roles);

    // 3) Map role -> permissions
    const rpRows = [];
    for (const [roleName, permList] of Object.entries(DEFAULT_ROLE_SETS)) {
        const roleId = roleMap.get(roleName);
        if (!roleId) {
            continue;
        }
        for (const permName of permList) {
            const permId = permMap.get(permName);
            if (permId) {
                rpRows.push({ roleId, permissionId: permId });
            }
        }
    }
    if (rpRows.length) {
        // уникализацию можно доверить PK/UNIQUE на таблице; здесь просто bulkInsert через модель
        await RolePermission.bulkCreate(rpRows, { ignoreDuplicates: true, transaction });
    }

    // 4) Assign owner role to creator
    const ownerRoleId = roleMap.get('owner');
    if (!ownerRoleId) {
        throw new Error('owner role was not created');
    }
    await UserRole.findOrCreate({
        where: { userId: ownerUserId, companyId, roleId: ownerRoleId },
        defaults: { userId: ownerUserId, companyId, roleId: ownerRoleId },
        transaction
    });

    return { roleIds: Object.fromEntries([...roleMap.entries()]) };
};
