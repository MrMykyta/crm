'use strict';

// Smoke: Functional role templates.
// NON-DESTRUCTIVE: runs in a transaction and always rolls back.

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Permission,
  Role,
  User,
  UserCompany,
} = require('../src/models');
const { listRoleTemplates } = require('../src/constants/roleTemplates');
const aclService = require('../src/services/system/aclService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function permissionNames(role) {
  return new Set((role?.permissions || []).map((permission) => permission.name));
}

(async () => {
  const transaction = await sequelize.transaction();
  try {
    const templates = listRoleTemplates();
    const byId = new Map(templates.map((template) => [template.id, template]));
    const expectedIds = ['sales', 'accountant', 'warehouse', 'service', 'support'];

    check('all functional role templates exist',
      expectedIds.every((id) => byId.has(id)),
      `templates=${templates.map((template) => template.id).join(', ')}`
    );
    check('templates are plain config objects, not seeded roles',
      templates.every((template) => template.isSystem !== true && template.isDefault !== true)
    );

    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const canonicalRoleSlugs = ['owner', 'admin', 'manager', 'employee', 'viewer'];
    const canonicalRoleCountBefore = await Role.count({
      where: { slug: canonicalRoleSlugs },
      transaction,
    });
    const owner = await User.create({
      id: uuidv4(),
      email: `role-template-owner-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction });
    const company = await Company.create({
      id: uuidv4(),
      name: `Role Templates Smoke ${suffix}`,
      ownerUserId: owner.id,
    }, { transaction });
    await UserCompany.create({
      id: uuidv4(),
      userId: owner.id,
      companyId: company.id,
      role: 'owner',
      status: 'active',
    }, { transaction });

    const templatePermissionNames = [...new Set(templates.flatMap((template) => template.permissions))];
    const permissionRows = await Permission.findAll({
      attributes: ['name'],
      where: { name: templatePermissionNames },
      transaction,
    });
    const existingPermissionNames = new Set(permissionRows.map((permission) => permission.name));
    const missingPermissions = templatePermissionNames.filter((name) => !existingPermissionNames.has(name));
    check('template permissions exist in permission catalog',
      missingPermissions.length === 0,
      missingPermissions.join(', ')
    );

    const firstSales = await aclService.createRoleFromTemplate({
      companyId: company.id,
      templateId: 'sales',
      transaction,
    });
    const secondSales = await aclService.createRoleFromTemplate({
      companyId: company.id,
      templateId: 'sales',
      transaction,
    });

    check('create role from template creates custom role',
      firstSales &&
      firstSales.name === 'Sales' &&
      firstSales.slug === null &&
      firstSales.isSystem === false &&
      firstSales.isDefault === false
    );
    check('template permissions are copied to created role',
      byId.get('sales').permissions.every((name) => permissionNames(firstSales).has(name)),
      `copied=${permissionNames(firstSales).size}`
    );
    check('duplicate template create uses copy name',
      secondSales?.name === 'Sales (copy)',
      `name=${secondSales?.name || '<missing>'}`
    );

    const updated = await aclService.updateRole({
      companyId: company.id,
      roleId: firstSales.id,
      data: { name: 'Sales Team', description: 'Updated by smoke' },
      transaction,
    });
    check('created custom role remains editable',
      updated?.name === 'Sales Team' && updated?.description === 'Updated by smoke'
    );

    const templateSlugRoles = await Role.findAll({
      attributes: ['id', 'slug', 'isDefault', 'isSystem'],
      where: { companyId: company.id, slug: expectedIds },
      transaction,
    });
    check('templates did not create default/system role slugs',
      templateSlugRoles.length === 0
    );

    const canonicalRoleCountAfter = await Role.count({
      where: { slug: canonicalRoleSlugs },
      transaction,
    });
    check('default/system roles unchanged by templates',
      canonicalRoleCountAfter === canonicalRoleCountBefore,
      `before=${canonicalRoleCountBefore} after=${canonicalRoleCountAfter}`
    );

    const failed = results.filter((result) => !result.ok);
    await transaction.rollback();
    await sequelize.close();

    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error(`Role template smoke failed: ${failed.map((result) => result.name).join('; ')}`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log('Role template smoke passed.');
    process.exit(0);
  } catch (error) {
    await transaction.rollback().catch(() => {});
    await sequelize.close().catch(() => {});
    // eslint-disable-next-line no-console
    console.error('Role template smoke failed with exception:', error);
    process.exit(1);
  }
})();
