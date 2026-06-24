'use strict';

// ACL sync service — безопасная (additive-only, idempotent) синхронизация WMS-прав
// для уже существующих компаний/ролей.
//
// Гарантии:
//  - НИЧЕГО не удаляет: ни role_permissions, ни user_permissions (кастомные override).
//  - Только ДОБАВЛЯЕТ недостающие WMS-права ролям согласно их default-набору
//    (см. constants/wmsAclDefaults.js).
//  - Idempotent: повторный запуск не создаёт дубликатов и не добавляет ничего нового.
//  - Кастомные/неизвестные роли пропускаются — лишние права не выдаются.
//
// Используется script `npm run acl:sync:wms` и smoke-проверкой.
// Core sync ниже строже: default/system roles приводятся к seed matrix
// (add missing + prune obsolete grants), custom/unknown roles остаются нетронутыми.

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  sequelize,
  Company,
  Permission,
  Role,
  RolePermission,
  UserCompany,
  UserRole,
} = require('../../models');
const { PERMISSIONS } = require('../../constants/permissions');
const {
  DEFAULT_ROLE_META,
  DEFAULT_ROLE_SETS,
  canonicalMembershipRole,
  normalizeRoleSlug,
} = require('../../constants/aclDefaults');
const { WMS_PERMISSIONS, wmsDefaultsForRole } = require('../../constants/wmsAclDefaults');

const DEFAULT_ROLE_SLUGS = Object.keys(DEFAULT_ROLE_SETS);

function defaultSlugForRole(role) {
  const slug = normalizeRoleSlug(role.slug);
  if (slug === 'user') return 'employee';
  if (DEFAULT_ROLE_SETS[slug]) return slug;

  const legacyName = normalizeRoleSlug(role.name);
  if (legacyName === 'user') return 'employee';
  if (DEFAULT_ROLE_SETS[legacyName]) return legacyName;

  return null;
}

function canonicalRoleMap(roles) {
  const map = new Map();
  for (const role of roles) {
    const slug = defaultSlugForRole(role);
    if (slug && !map.has(slug)) {
      map.set(slug, role.id);
    }
  }
  return map;
}

async function ensureRoleMetadata(role, meta, report, transaction) {
  const patch = {};
  if (role.slug !== meta.slug) patch.slug = meta.slug;
  if (role.isSystem !== meta.isSystem) patch.isSystem = meta.isSystem;
  if (role.isDefault !== meta.isDefault) patch.isDefault = meta.isDefault;

  if (!Object.keys(patch).length) return false;

  await role.update(patch, { transaction });
  report.roleMetadataUpdated += 1;
  return true;
}

function membershipKey(userId, companyId) {
  return `${userId}:${companyId}`;
}

function userRoleKey(userId, companyId, roleId) {
  return `${userId}:${companyId}:${roleId}`;
}

/**
 * Гарантирует наличие полного core permission catalog.
 * @returns {Promise<{created: string[], permIdByName: Map<string,string>}>}
 */
async function ensureCorePermissionCatalog({ transaction } = {}) {
  const existing = await Permission.findAll({
    attributes: ['id', 'name'],
    where: { name: PERMISSIONS },
    transaction,
  });
  const existingNames = new Set(existing.map((p) => p.name));

  const toInsert = PERMISSIONS
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ id: uuidv4(), name, description: null }));

  if (toInsert.length) {
    await Permission.bulkCreate(toInsert, { ignoreDuplicates: true, transaction });
  }

  const all = await Permission.findAll({
    attributes: ['id', 'name'],
    where: { name: PERMISSIONS },
    transaction,
  });

  return {
    created: toInsert.map((r) => r.name),
    permIdByName: new Map(all.map((p) => [p.name, p.id])),
  };
}

async function ensureDefaultRolesForCompanies(companies, report, transaction) {
  const roleByCompany = new Map();

  for (const company of companies) {
    const companyId = company.id;
    const roles = await Role.findAll({
      attributes: ['id', 'companyId', 'name', 'slug', 'isSystem', 'isDefault', 'createdAt'],
      where: {
        companyId,
        [Op.or]: [
          { slug: DEFAULT_ROLE_SLUGS },
          { name: DEFAULT_ROLE_SLUGS },
        ],
      },
      order: [['slug', 'ASC'], ['name', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      transaction,
    });

    const bySlug = new Map();
    const duplicateSlugs = new Set();
    const legacyNameMatches = new Set();
    for (const role of roles) {
      const defaultSlug = defaultSlugForRole(role);
      if (!defaultSlug) {
        continue;
      }
      if (!role.slug && normalizeRoleSlug(role.name) === defaultSlug) {
        legacyNameMatches.add(defaultSlug);
      }
      if (bySlug.has(defaultSlug)) {
        duplicateSlugs.add(defaultSlug);
      } else {
        bySlug.set(defaultSlug, role);
      }
    }

    if (legacyNameMatches.size) {
      report.legacyRolesMatchedByName += legacyNameMatches.size;
    }

    if (duplicateSlugs.size) {
      report.warnings.push({
        companyId,
        type: 'duplicate_default_role_slug_or_name',
        roleSlugs: Array.from(duplicateSlugs),
        message: 'roles(company_id, slug/name) has duplicates; using the oldest role row',
      });
    }

    for (const [slug, role] of bySlug.entries()) {
      await ensureRoleMetadata(role, DEFAULT_ROLE_META[slug], report, transaction);
    }

    for (const slug of DEFAULT_ROLE_SLUGS) {
      if (bySlug.has(slug)) {
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
        description: `Default ${meta.slug} role`,
      }, { transaction });
      bySlug.set(slug, role);
      report.rolesCreated += 1;
      report.rolesCreatedByName[slug] = (report.rolesCreatedByName[slug] || 0) + 1;
      report.rolesCreatedBySlug[slug] = (report.rolesCreatedBySlug[slug] || 0) + 1;
    }

    const refreshed = await Role.findAll({
      attributes: ['id', 'companyId', 'name', 'slug', 'isSystem', 'isDefault', 'createdAt'],
      where: {
        companyId,
        [Op.or]: [
          { slug: DEFAULT_ROLE_SLUGS },
          { name: DEFAULT_ROLE_SLUGS },
        ],
      },
      order: [['slug', 'ASC'], ['name', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      transaction,
    });
    roleByCompany.set(String(companyId), canonicalRoleMap(refreshed));
  }

  return roleByCompany;
}

/**
 * Core ACL backfill для всех компаний.
 * Additive-only: создаёт недостающие default roles, grants и безопасные user_roles.
 */
async function backfillCoreAcl({ transaction } = {}) {
  const { created, permIdByName } = await ensureCorePermissionCatalog({ transaction });

  const companies = await Company.findAll({
    attributes: ['id', 'ownerUserId'],
    transaction,
  });

  const report = {
    permissionsCreated: created,
    companiesProcessed: companies.length,
    rolesCreated: 0,
    rolesCreatedByName: {},
    rolesCreatedBySlug: {},
    roleMetadataUpdated: 0,
    legacyRolesMatchedByName: 0,
    rolePermissionsInserted: 0,
    rolePermissionsDeleted: 0,
    userRolesInserted: 0,
    skippedCustomRoles: 0,
    skippedCustomRoleNames: [],
    warnings: [],
  };

  const roleByCompany = await ensureDefaultRolesForCompanies(companies, report, transaction);

  const allRoles = await Role.findAll({
    attributes: ['id', 'companyId', 'name', 'slug'],
    transaction,
  });

  const knownRoleIds = [];
  for (const role of allRoles) {
    const defaultSlug = defaultSlugForRole(role);
    if (defaultSlug) {
      knownRoleIds.push(role.id);
    } else {
      report.skippedCustomRoles += 1;
      if (!report.skippedCustomRoleNames.includes(role.name)) {
        report.skippedCustomRoleNames.push(role.name);
      }
    }
  }

  const existingRolePermissions = knownRoleIds.length
    ? await RolePermission.findAll({
      attributes: ['roleId', 'permissionId'],
      where: { roleId: knownRoleIds },
      transaction,
    })
    : [];

  const rpByRole = new Map();
  for (const row of existingRolePermissions) {
    const roleId = String(row.roleId);
    if (!rpByRole.has(roleId)) {
      rpByRole.set(roleId, new Set());
    }
    rpByRole.get(roleId).add(String(row.permissionId));
  }

  const rolePermissionRows = [];
  const obsoleteRolePermissionRows = [];
  for (const role of allRoles) {
    const defaultSlug = defaultSlugForRole(role);
    const permList = DEFAULT_ROLE_SETS[defaultSlug];
    if (!permList) {
      continue;
    }
    const existingSet = rpByRole.get(String(role.id)) || new Set();
    for (const permName of permList) {
      const permissionId = permIdByName.get(permName);
      if (!permissionId) {
        report.warnings.push({
          roleName: role.name,
          roleSlug: defaultSlug,
          permission: permName,
          type: 'missing_permission',
        });
        continue;
      }
      if (!existingSet.has(String(permissionId))) {
        rolePermissionRows.push({ roleId: role.id, permissionId });
        existingSet.add(String(permissionId));
      }
    }

    const seedPermissionIds = new Set(
      permList
        .map((permName) => permIdByName.get(permName))
        .filter(Boolean)
        .map((permissionId) => String(permissionId))
    );
    for (const permissionId of existingSet) {
      if (!seedPermissionIds.has(permissionId)) {
        obsoleteRolePermissionRows.push({ roleId: role.id, permissionId });
      }
    }
  }

  if (rolePermissionRows.length) {
    await RolePermission.bulkCreate(rolePermissionRows, { ignoreDuplicates: true, transaction });
    report.rolePermissionsInserted = rolePermissionRows.length;
  }

  for (const row of obsoleteRolePermissionRows) {
    const deleted = await RolePermission.destroy({
      where: {
        roleId: row.roleId,
        permissionId: row.permissionId,
      },
      transaction,
    });
    report.rolePermissionsDeleted += deleted;
  }

  const memberships = await UserCompany.findAll({
    attributes: ['userId', 'companyId', 'role', 'status'],
    where: { status: 'active' },
    transaction,
  });

  const existingUserRoles = await UserRole.findAll({
    attributes: ['userId', 'companyId', 'roleId'],
    transaction,
  });
  const anyUserRoleByMembership = new Set();
  const existingUserRoleSet = new Set();
  for (const row of existingUserRoles) {
    anyUserRoleByMembership.add(membershipKey(row.userId, row.companyId));
    existingUserRoleSet.add(userRoleKey(row.userId, row.companyId, row.roleId));
  }

  const userRoleRows = [];
  const queuedUserRoleSet = new Set();
  const queueUserRole = ({ userId, companyId, roleId }) => {
    if (!userId || !companyId || !roleId) return;
    const key = userRoleKey(userId, companyId, roleId);
    if (existingUserRoleSet.has(key) || queuedUserRoleSet.has(key)) return;
    userRoleRows.push({ userId, companyId, roleId });
    queuedUserRoleSet.add(key);
  };

  // Owner fallback: owners always get the owner ACL role, without removing anything else.
  for (const company of companies) {
    const roleId = roleByCompany.get(String(company.id))?.get('owner');
    if (company.ownerUserId && roleId) {
      queueUserRole({ userId: company.ownerUserId, companyId: company.id, roleId });
    }
  }

  for (const membership of memberships) {
    const roles = roleByCompany.get(String(membership.companyId));
    const defaultMembershipRole = canonicalMembershipRole(membership.role);
    const roleId = roles?.get(defaultMembershipRole);
    if (!roleId) {
      report.warnings.push({
        companyId: membership.companyId,
        userId: membership.userId,
        role: membership.role,
        defaultRole: defaultMembershipRole,
        type: 'missing_default_role_for_membership',
      });
      continue;
    }

    if (membership.role === 'owner') {
      queueUserRole({ userId: membership.userId, companyId: membership.companyId, roleId });
      continue;
    }

    // Materialize only when a membership has no ACL roles at all; custom grants stay untouched.
    if (!anyUserRoleByMembership.has(membershipKey(membership.userId, membership.companyId))) {
      queueUserRole({ userId: membership.userId, companyId: membership.companyId, roleId });
    }
  }

  if (userRoleRows.length) {
    await UserRole.bulkCreate(userRoleRows, { ignoreDuplicates: true, transaction });
    report.userRolesInserted = userRoleRows.length;
  }

  return report;
}

async function syncCoreAcl() {
  return sequelize.transaction((transaction) => backfillCoreAcl({ transaction }));
}

/**
 * Гарантирует наличие всех WMS-прав в глобальном каталоге `permissions`.
 * @returns {Promise<{created: string[], permIdByName: Map<string,string>}>}
 */
async function ensureWmsPermissionCatalog({ transaction } = {}) {
  const existing = await Permission.findAll({
    attributes: ['id', 'name'],
    where: { name: WMS_PERMISSIONS },
    transaction,
  });
  const existingNames = new Set(existing.map((p) => p.name));

  const toInsert = WMS_PERMISSIONS
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ id: uuidv4(), name, description: null }));

  if (toInsert.length) {
    // ignoreDuplicates на случай гонки/повторного запуска (name UNIQUE).
    await Permission.bulkCreate(toInsert, { ignoreDuplicates: true, transaction });
  }

  const all = await Permission.findAll({
    attributes: ['id', 'name'],
    where: { name: WMS_PERMISSIONS },
    transaction,
  });

  return {
    created: toInsert.map((r) => r.name),
    permIdByName: new Map(all.map((p) => [p.name, p.id])),
  };
}

/**
 * Бэкфилл WMS-прав для всех существующих ролей всех компаний.
 * Additive-only: добавляются только недостающие grants.
 *
 * @returns {Promise<object>} отчёт о выполнении
 */
async function backfillWmsRolePermissions({ transaction } = {}) {
  const { created, permIdByName } = await ensureWmsPermissionCatalog({ transaction });

  const roles = await Role.findAll({
    attributes: ['id', 'name', 'companyId'],
    transaction,
  });

  const report = {
    permissionsCreated: created,
    rolesProcessed: 0,
    rolesSkipped: 0,
    grantsAdded: 0,
    addedByRoleName: {},
    skippedRoleNames: [],
  };

  const companies = new Set();
  const newRows = [];

  for (const role of roles) {
    const wmsPerms = wmsDefaultsForRole(role.name);
    if (!wmsPerms.length) {
      // неизвестная/кастомная роль — не выдаём лишних прав
      report.rolesSkipped += 1;
      if (!report.skippedRoleNames.includes(role.name)) {
        report.skippedRoleNames.push(role.name);
      }
      continue;
    }

    report.rolesProcessed += 1;
    companies.add(String(role.companyId));

    // Существующие права роли — чтобы добавить только diff и не перетереть кастомные.
    const existing = await RolePermission.findAll({
      attributes: ['permissionId'],
      where: { roleId: role.id },
      transaction,
    });
    const existingSet = new Set(existing.map((rp) => String(rp.permissionId)));

    let added = 0;
    for (const permName of wmsPerms) {
      const permissionId = permIdByName.get(permName);
      if (permissionId && !existingSet.has(String(permissionId))) {
        newRows.push({ roleId: role.id, permissionId });
        added += 1;
      }
    }
    if (added) {
      report.addedByRoleName[role.name] = (report.addedByRoleName[role.name] || 0) + added;
    }
  }

  if (newRows.length) {
    // composite PK (role_id, permission_id) → ignoreDuplicates = ON CONFLICT DO NOTHING.
    await RolePermission.bulkCreate(newRows, { ignoreDuplicates: true, transaction });
    report.grantsAdded = newRows.length;
  }

  report.companiesAffected = companies.size;
  return report;
}

/**
 * Точка входа: выполняет полный WMS ACL backfill в одной транзакции.
 * @returns {Promise<object>} отчёт
 */
async function syncWmsAcl() {
  return sequelize.transaction((transaction) => backfillWmsRolePermissions({ transaction }));
}

module.exports = {
  ensureCorePermissionCatalog,
  backfillCoreAcl,
  syncCoreAcl,
  ensureWmsPermissionCatalog,
  backfillWmsRolePermissions,
  syncWmsAcl,
};
