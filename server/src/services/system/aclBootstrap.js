const { v4: uuidv4 } = require('uuid');
const { Permission, Role, RolePermission, UserRole } = require('../../models');
const { PERMISSIONS } = require('../../constants/permissions');
const { DEFAULT_ROLE_SETS } = require('../../constants/aclDefaults');

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
        await Permission.bulkCreate(toInsert, { transaction });
    }

    const allPerms = await Permission.findAll({ attributes: ['id','name'], transaction });

    const permMap = new Map(allPerms.map(p => [p.name, p.id]));

    // 2) Create roles for company
    const roleRows = ['owner','admin','manager','employee'].map(name => ({
        id: uuidv4(), companyId, name, description: `Default ${name} role`
    }));
    await Role.bulkCreate(roleRows, { transaction });

    const roles = await Role.findAll({ where: { companyId }, transaction });

    const roleMap = new Map(roles.map(r => [r.name, r.id]));

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
    await UserRole.findOrCreate({
        where: { userId: ownerUserId, companyId, roleId: ownerRoleId },
        transaction
    });

    return { roleIds: Object.fromEntries([...roleMap.entries()]) };
};
